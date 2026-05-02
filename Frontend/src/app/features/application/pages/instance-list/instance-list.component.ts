import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProcessService } from '../../../../core/services/process.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ThemeService } from '../../../../core/services/theme.service';
import {
  ProcessInstance,
  TaskResponse,
  WorkflowDefinition,
  WorkflowStep,
} from '../../../../core/models/process.model';

interface SvgEdge {
  id: string;
  path: string;
  midX: number;
  midY: number;
  name: string;
}



@Component({
  selector: 'app-instance-list',
  templateUrl: './instance-list.component.html',
  styleUrls: ['./instance-list.component.css']
})
export class InstanceListComponent implements OnInit, OnDestroy {

  /** One ref per tab — Angular updates whichever is currently in the DOM */
  @ViewChild('tasksGraphEl', { static: false }) tasksGraphEl?: ElementRef<HTMLElement>;
  @ViewChild('startedGraphEl', { static: false }) startedGraphEl?: ElementRef<HTMLElement>;

  domainSlug = '';
  appSlug = '';
  mode: 'tasks' | 'instances' = 'tasks';
  activeTab: 'tasks' | 'started' = 'tasks';

  instances: ProcessInstance[] = [];
  startedInstances: ProcessInstance[] = [];
  tasks: TaskResponse[] = [];
  loading = false;
  error = '';

  themeColor = '#1a1a2e';

  // ── Shared graph state ───────────────────────────────────────────────────
  workflowDefinitions: WorkflowDefinition[] = [];
  selectedWorkflowId = '';

  /** Pre-computed BFS levels (same workflow used by both tabs) */
  computedGraphLevels: WorkflowStep[][] = [];

  /** SVG bezier edges rendered over the active graph */
  graphSvgEdges: SvgEdge[] = [];
  private _svgSig = '';
  private _svgInterval: ReturnType<typeof setInterval> | null = null;

  // ── Tasks (My Tasks tab) ─────────────────────────────────────────────────
  tasksByStep = new Map<string, TaskResponse[]>();
  selectedNodeStepId: string | null = null;

  // ── Instances (Started By Me tab) ────────────────────────────────────────
  instancesByStep = new Map<string, ProcessInstance[]>();
  selectedStartedNodeId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private processService: ProcessService,
    private auth: AuthService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private themeService: ThemeService,
  ) {}

  ngOnInit(): void {
    this.domainSlug = this.route.snapshot.params['slug'];
    this.appSlug    = this.route.snapshot.params['appSlug'];
    this.mode = this.route.snapshot.data['mode'] || 'tasks';

    if (this.mode === 'tasks') {
      const requestedTab = this.route.snapshot.queryParamMap.get('tab');
      if (requestedTab === 'started') {
        this.activeTab = 'started';
      }
    }

    const ctx = this.auth.getContext();
    const isOwner = !!ctx && ctx.principalType === 'OWNER';
    if (this.mode === 'instances' && !isOwner) {
      this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug, 'tasks']);
      return;
    }

    this.loadTheme();
    this.load();

    this.ngZone.runOutsideAngular(() => {
      this._svgInterval = setInterval(() => this._pollSvgEdges(), 200);
    });
  }

  ngOnDestroy(): void {
    if (this._svgInterval !== null) {
      clearInterval(this._svgInterval);
      this._svgInterval = null;
    }
  }

  // ── SVG edge polling ─────────────────────────────────────────────────────

  private _pollSvgEdges(): void {
    // Use whichever graph is currently mounted
    const el = this.activeTab === 'tasks' ? this.tasksGraphEl : this.startedGraphEl;
    if (!el) return;
    const host = el.nativeElement;
    const hRect = host.getBoundingClientRect();
    if (!hRect.width) return;

    const wf = this.workflowDefinitions.find(w => w.id === this.selectedWorkflowId);
    if (!wf?.steps?.length) return;

    const rects = new Map<string, DOMRect>();
    host.querySelectorAll<HTMLElement>('[data-step-id]').forEach(el =>
      rects.set(el.getAttribute('data-step-id')!, el.getBoundingClientRect())
    );

    const edges: SvgEdge[] = [];
    for (const step of wf.steps) {
      for (const edge of step.edges ?? []) {
        if (edge.terminal || !edge.targetStepId) continue;
        const fr = rects.get(step.id);
        const to = rects.get(edge.targetStepId);
        if (!fr || !to) continue;
        const x1 = Math.round(fr.left + fr.width / 2 - hRect.left);
        const y1 = Math.round(fr.bottom - hRect.top);
        const x2 = Math.round(to.left + to.width / 2 - hRect.left);
        const y2 = Math.round(to.top - hRect.top);
        const cp = Math.round((y1 + y2) / 2);
        edges.push({
          id: edge.id,
          name: edge.name || '',
          path: `M${x1},${y1} C${x1},${cp} ${x2},${cp} ${x2},${y2}`,
          midX: Math.round((x1 + x2) / 2),
          midY: cp,
        });
      }
    }

    const sig = edges.map(e => e.path).join('|');
    if (sig === this._svgSig) return;
    this._svgSig = sig;
    this.ngZone.run(() => {
      this.graphSvgEdges = edges;
      this.cdr.markForCheck();
    });
  }

  // ── Theme ────────────────────────────────────────────────────────────────

  private loadTheme() {
    this.themeColor = this.themeService.resolveThemeColor(this.domainSlug, this.appSlug);
  }

  // ── Data loading ─────────────────────────────────────────────────────────

  load(): void {
    this.loading = true;
    this.error = '';

    if (this.mode === 'tasks') {
      this.loadTasksAndStarted();
      return;
    }

    this.processService.listInstances(this.domainSlug, this.appSlug).subscribe({
      next: (list) => { this.instances = list || []; this.loading = false; },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load instances';
        this.loading = false;
      }
    });
  }

  private loadTasksAndStarted(): void {
    this.loading = true;
    this.error = '';
    this.selectedNodeStepId = null;
    this.selectedStartedNodeId = null;

    let tasksDone = false, startedDone = false, wfDone = false;
    const finalize = () => {
      if (tasksDone && startedDone && wfDone) {
        this.buildGraphs();
        this.loading = false;
      }
    };

    this.processService.listMyTasks(this.domainSlug, this.appSlug).subscribe({
      next: (res) => { this.tasks = res?.tasks || []; tasksDone = true; finalize(); },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load tasks';
        tasksDone = true; finalize();
      }
    });

    this.processService.listMyStartedInstances(this.domainSlug, this.appSlug).subscribe({
      next: (list) => { this.startedInstances = list || []; startedDone = true; finalize(); },
      error: (err: any) => {
        if (!this.error) this.error = err?.error?.message || 'Failed to load your workflows';
        startedDone = true; finalize();
      }
    });

    this.processService.listWorkflows(this.domainSlug, this.appSlug).subscribe({
      next: (wfs) => {
        this.workflowDefinitions = (wfs || []).filter(w => w.status === 'PUBLISHED');
        wfDone = true; finalize();
      },
      error: () => { this.workflowDefinitions = []; wfDone = true; finalize(); }
    });
  }

  // ── Graph construction ───────────────────────────────────────────────────

  private buildGraphs(): void {
    this.tasksByStep.clear();
    this.instancesByStep.clear();
    this.selectedNodeStepId = null;
    this.selectedStartedNodeId = null;
    this.computedGraphLevels = [];
    this._svgSig = '';

    if (!this.workflowDefinitions.length) return;

    // ── Pick best workflow from tasks ────────────────────────────────────
    if (!this.workflowDefinitions.find(w => w.id === this.selectedWorkflowId)) {
      const tasksByWf = new Map<string, number>();
      for (const t of this.tasks) {
        if (t.workflowDefinitionId)
          tasksByWf.set(t.workflowDefinitionId, (tasksByWf.get(t.workflowDefinitionId) ?? 0) + 1);
      }
      // Fall back to first published workflow if no tasks or none matched
      let best = this.workflowDefinitions[0].id ?? '';
      let bestCount = 0;
      for (const [id, cnt] of tasksByWf) {
        if (cnt > bestCount) { best = id; bestCount = cnt; }
      }
      this.selectedWorkflowId = best;
    }

    // ── Tasks by step ────────────────────────────────────────────────────
    for (const task of this.tasks.filter(t => t.workflowDefinitionId === this.selectedWorkflowId)) {
      if (!task.currentStepId) continue;
      if (!this.tasksByStep.has(task.currentStepId)) this.tasksByStep.set(task.currentStepId, []);
      this.tasksByStep.get(task.currentStepId)!.push(task);
    }

    // ── Instances by step ────────────────────────────────────────────────
    for (const inst of this.startedInstances.filter(i => i.workflowDefinitionId === this.selectedWorkflowId)) {
      if (!inst.currentStepId) continue;
      if (!this.instancesByStep.has(inst.currentStepId)) this.instancesByStep.set(inst.currentStepId, []);
      this.instancesByStep.get(inst.currentStepId)!.push(inst);
    }

    this.computedGraphLevels = this.computeLevels(
      this.workflowDefinitions.find(w => w.id === this.selectedWorkflowId)
    );
  }

  private computeLevels(wf: WorkflowDefinition | undefined): WorkflowStep[][] {
    if (!wf?.steps?.length) return [];
    const steps = wf.steps;
    const byId = new Map(steps.map(s => [s.id, s]));
    const start = steps.find(s => s.start) || steps[0];
    const levelById = new Map<string, number>();
    const queue: { id: string; level: number }[] = [];
    if (start?.id) { levelById.set(start.id, 0); queue.push({ id: start.id, level: 0 }); }
    while (queue.length) {
      const cur = queue.shift()!;
      for (const edge of byId.get(cur.id)?.edges ?? []) {
        if (!edge.targetStepId || edge.terminal || levelById.has(edge.targetStepId)) continue;
        levelById.set(edge.targetStepId, cur.level + 1);
        queue.push({ id: edge.targetStepId, level: cur.level + 1 });
      }
    }
    const floatLevel = levelById.size > 0 ? Math.max(...levelById.values()) + 1 : 0;
    for (const s of steps) if (!levelById.has(s.id)) levelById.set(s.id, floatLevel);
    const maxLevel = Math.max(0, ...levelById.values());
    const levels: WorkflowStep[][] = Array.from({ length: maxLevel + 1 }, () => []);
    for (const s of steps) {
      const lvl = levelById.get(s.id);
      if (lvl !== undefined) levels[lvl].push(s);
    }
    return levels.filter(r => r.length > 0).map(r => r.sort((a, b) => a.order - b.order));
  }

  // ── Tab switching ────────────────────────────────────────────────────────

  setTab(tab: 'tasks' | 'started'): void {
    this.activeTab = tab;
    // Force SVG re-poll for newly visible graph
    this._svgSig = '';
  }

  // ── Workflow selector ────────────────────────────────────────────────────

  get selectedWorkflow(): WorkflowDefinition | undefined {
    return this.workflowDefinitions.find(w => w.id === this.selectedWorkflowId);
  }

  get workflowsWithActivity(): WorkflowDefinition[] {
    const ids = new Set([
      ...this.tasks.map(t => t.workflowDefinitionId),
      ...this.startedInstances.map(i => i.workflowDefinitionId),
    ].filter(Boolean));
    return this.workflowDefinitions.filter(w => ids.has(w.id));
  }

  selectWorkflow(wfId: string): void {
    this.selectedWorkflowId = wfId;
    this.buildGraphs();
  }

  // ── Tasks helpers ────────────────────────────────────────────────────────

  getStepTaskCount(stepId: string): number {
    return this.tasksByStep.get(stepId)?.length ?? 0;
  }

  getStepTasks(stepId: string): TaskResponse[] {
    return this.tasksByStep.get(stepId) ?? [];
  }

  selectNode(stepId: string): void {
    if (!this.getStepTaskCount(stepId)) return;
    this.selectedNodeStepId = this.selectedNodeStepId === stepId ? null : stepId;
  }

  closeNodePanel(): void { this.selectedNodeStepId = null; }

  // ── Started-by-me helpers ────────────────────────────────────────────────

  getStepInstanceCount(stepId: string): number {
    return this.instancesByStep.get(stepId)?.length ?? 0;
  }

  getStepInstances(stepId: string): ProcessInstance[] {
    return this.instancesByStep.get(stepId) ?? [];
  }

  /** Returns the dominant status color class for a step's instances */
  getStepInstanceColor(stepId: string): 'active' | 'completed' | 'cancelled' | 'mixed' {
    const insts = this.getStepInstances(stepId);
    if (!insts.length) return 'active';
    const counts = { ACTIVE: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const i of insts) counts[i.status as keyof typeof counts]++;
    if (counts.ACTIVE > 0 && counts.COMPLETED === 0 && counts.CANCELLED === 0) return 'active';
    if (counts.COMPLETED > 0 && counts.ACTIVE === 0 && counts.CANCELLED === 0) return 'completed';
    if (counts.CANCELLED > 0 && counts.ACTIVE === 0 && counts.COMPLETED === 0) return 'cancelled';
    return 'mixed';
  }

  selectStartedNode(stepId: string): void {
    if (!this.getStepInstanceCount(stepId)) return;
    this.selectedStartedNodeId = this.selectedStartedNodeId === stepId ? null : stepId;
  }

  closeStartedPanel(): void { this.selectedStartedNodeId = null; }

  // ── Shared helpers ───────────────────────────────────────────────────────

  getStepName(stepId: string): string {
    return this.selectedWorkflow?.steps?.find(s => s.id === stepId)?.name ?? stepId;
  }

  shortId(id: string): string {
    return id ? id.substring(0, 8) + '…' : '';
  }

  // ── Navigation ───────────────────────────────────────────────────────────

  viewInstance(id: string): void {
    this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug, 'instances', id]);
  }

  goBack(): void {
    this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug]);
  }

  goToTasks(): void {
    this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug, 'tasks']);
  }

  goToInstances(): void {
    this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug, 'instances']);
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  countByStatus(status: string): number {
    return this.instances.filter(i => i.status === status).length;
  }

  hasTasks(): boolean { return this.tasks.length > 0; }
  hasStarted(): boolean { return this.startedInstances.length > 0; }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
         + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
}
