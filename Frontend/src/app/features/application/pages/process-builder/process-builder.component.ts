import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, NgZone, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomainService } from '../../../../core/services/domain.service';
import { ProcessService } from '../../../../core/services/process.service';
import { ThemeService } from '../../../../core/services/theme.service';
import {
  DomainModelField,
  DomainFieldType,
  ProcessDefinitionResponse,
  WorkflowEdge,
  WorkflowStatus,
  WorkflowStep,
} from '../../../../core/models/process.model';
import { Observable } from 'rxjs';

interface SvgEdge {
  id: string;
  path: string;
  midX: number;
  midY: number;
  name: string;
}

@Component({
  selector: 'app-process-builder',
  templateUrl: './process-builder.component.html',
  styleUrls: ['./process-builder.component.css']
})
export class ProcessBuilderComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('graphContainer') private graphContainer?: ElementRef<HTMLElement>;
  graphSvgEdges: SvgEdge[] = [];
  private _svgSig = '';
  private _svgInterval: ReturnType<typeof setInterval> | null = null;

  domainSlug = '';
  appSlug = '';
  workflowSlug = '';

  workflowStatus: WorkflowStatus | null = null;
  name = '';
  description = '';
  steps: WorkflowStep[] = [];
  globalEdges: WorkflowEdge[] = [];
  selectedStepId: string | null = null;
  selectedStepRef: WorkflowStep | null = null;
  editorOpen = false;
  private nextStepIndex = 1;

  availableRoles: string[] = [];
  fieldTypes: DomainFieldType[] = [
    'STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME',
    'REFERENCE', 'EMPLOYEE_REFERENCE', 'OBJECT', 'ARRAY',
  ];

  loading = false;
  saving = false;
  error = '';
  successMsg = '';
  publishErrors: string[] = [];

  themeColor = '#1a1a2e';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private processService: ProcessService,
    private domainService: DomainService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private themeService: ThemeService,
  ) {}

  ngOnInit(): void {
    this.domainSlug = this.route.snapshot.params['slug'];
    this.appSlug = this.route.snapshot.params['appSlug'];
    this.workflowSlug = this.route.snapshot.queryParamMap.get('wf') || '';
    this.themeColor = this.themeService.resolveThemeColor(this.domainSlug, this.appSlug);
    this.loadRoles();
    if (this.workflowSlug) {
      this.loadWorkflow(this.workflowSlug);
      return;
    }
    this.resolveWorkflowFromApp();
  }

  /** Run a lightweight poll entirely outside Angular's zone so it never
   *  triggers change detection by itself. Only re-enters the zone when
   *  edge positions actually change, which is rare after initial render. */
  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this._svgInterval = setInterval(() => this._pollEdges(), 200);
    });
  }

  ngOnDestroy(): void {
    if (this._svgInterval !== null) {
      clearInterval(this._svgInterval);
      this._svgInterval = null;
    }
  }

  private _pollEdges(): void {
    if (!this.graphContainer) return;
    const host = this.graphContainer.nativeElement;
    const hRect = host.getBoundingClientRect();
    if (!hRect.width) return;

    const rects = new Map<string, DOMRect>();
    host.querySelectorAll<HTMLElement>('[data-step-id]').forEach(el =>
      rects.set(el.getAttribute('data-step-id')!, el.getBoundingClientRect())
    );

    const edges: SvgEdge[] = [];
    for (const step of this.steps) {
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
          name: edge.name || 'Action',
          path: `M${x1},${y1} C${x1},${cp} ${x2},${cp} ${x2},${y2}`,
          midX: Math.round((x1 + x2) / 2),
          midY: cp,
        });
      }
    }

    const sig = edges.map(e => e.path).join('|');
    if (sig === this._svgSig) return;   // nothing changed — stay outside zone
    this._svgSig = sig;
    // Re-enter Angular zone only when edges actually changed
    this.ngZone.run(() => {
      this.graphSvgEdges = edges;
      this.cdr.markForCheck();
    });
  }

  private resolveWorkflowFromApp(): void {
    this.loading = true;
    this.processService.listWorkflows(this.domainSlug, this.appSlug).subscribe({
      next: (workflows) => {
        const existing = Array.isArray(workflows) && workflows.length > 0 ? workflows[0] : null;
        if (existing?.slug) {
          this.workflowSlug = existing.slug;
          this.loadWorkflow(existing.slug);
          return;
        }
        this.loading = false;
        this.initDraft();
      },
      error: () => { this.loading = false; this.initDraft(); }
    });
  }

  get isDraft(): boolean { return this.workflowStatus !== 'PUBLISHED'; }

  goBack(): void {
    this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug]);
  }

  loadRoles(): void {
    this.domainService.getWorkflowRoles(this.domainSlug).subscribe({
      next: (groups: any[]) => {
        this.availableRoles = Array.from(new Set(
          (groups || []).map((g: any) => g?.name).filter((n: string) => !!n)
        ));
      },
      error: () => { this.availableRoles = []; }
    });
  }

  loadWorkflow(slug: string): void {
    this.loading = true;
    this.error = '';
    this.publishErrors = [];
    this.selectedStepId = null;
    this.editorOpen = false;

    this.processService.getWorkflow(this.domainSlug, this.appSlug, slug).subscribe({
      next: (res: ProcessDefinitionResponse) => {
        const wf = res.workflow;
        this.workflowSlug = wf.slug;
        this.workflowStatus = wf.status;
        this.name = wf.name || '';
        this.description = wf.description || '';
        this.steps = (wf.steps || []).map(s => this.withStepDefaults(s));
        this.globalEdges = (wf.globalEdges || []).map(e => this.withEdgeDefaults(e));
        this.normalizeStepOrder();
        this.selectedStepRef = null;
        this.syncNextStepIndex(this.steps);
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load workflow';
        this.loading = false;
      }
    });
  }

  initDraft(): void {
    this.workflowStatus = null;
    this.name = '';
    this.description = '';
    this.steps = [];
    this.globalEdges = [];
    this.selectedStepId = null;
    this.selectedStepRef = null;
    this.editorOpen = false;
    this.nextStepIndex = 1;
    this.addStepAndEdit();
  }

  // ── Step management ─────────────────────────────────────────────────────────

  addStep(): WorkflowStep {
    const index = this.steps.length;
    const stepNumber = this.allocateStepIndex();
    const step: WorkflowStep = {
      id: `step_${stepNumber}`,
      name: `Step ${stepNumber}`,
      order: index,
      start: this.steps.length === 0,
      end: false,
      fields: [],
      readonlyFieldKeys: [],
      edges: [],
      positionX: 140 + index * 120,
      positionY: 180,
    };
    this.steps = [...this.steps, step];
    this.normalizeStepOrder();
    return step;
  }

  addStepAndEdit(): void {
    const step = this.addStep();
    this.openStepEditor(step);
  }

  removeStep(index: number): void {
    const removed = this.steps[index];
    this.steps.splice(index, 1);
    if (removed && (removed === this.selectedStepRef || removed.id === this.selectedStepId)) this.closeEditor();
    if (!this.steps.some(s => s.start) && this.steps.length > 0) this.steps[0].start = true;
    this.normalizeStepOrder();
  }

  setStartStep(index: number): void {
    this.steps.forEach((s, i) => { s.start = i === index; });
  }

  setStartStepById(stepId: string): void {
    const index = this.steps.findIndex(s => s.id === stepId);
    if (index >= 0) this.setStartStep(index);
  }

  openStepEditor(step: WorkflowStep): void {
    if (!step) return;
    if (!step.fields) step.fields = [];
    if (!step.readonlyFieldKeys) step.readonlyFieldKeys = [];
    this.selectedStepId = step.id;
    this.selectedStepRef = step;
    this.editorOpen = true;
  }

  closeEditor(): void {
    this.editorOpen = false;
    this.selectedStepRef = null;
  }

  get selectedStep(): WorkflowStep | null {
    if (this.selectedStepRef && this.steps.includes(this.selectedStepRef)) {
      return this.selectedStepRef;
    }
    return this.steps.find(s => s.id === this.selectedStepId) || null;
  }

  removeSelectedStep(): void {
    const step = this.selectedStep;
    if (!step) return;
    const index = this.steps.findIndex(s => s.id === step.id);
    if (index >= 0) this.removeStep(index);
  }

  orderedSteps(): WorkflowStep[] {
    return [...this.steps].sort((a, b) => a.order - b.order);
  }

  // ── Graph layout ────────────────────────────────────────────────────────────

  graphLevels(): WorkflowStep[][] {
    if (!this.steps.length) return [];
    const byId = new Map<string, WorkflowStep>();
    this.steps.forEach(s => byId.set(s.id, s));
    const start = this.steps.find(s => s.start) || this.steps[0];
    const levelById = new Map<string, number>();
    const queue: Array<{ id: string; level: number }> = [];
    if (start?.id) { levelById.set(start.id, 0); queue.push({ id: start.id, level: 0 }); }
    while (queue.length) {
      const current = queue.shift()!;
      const step = byId.get(current.id);
      if (!step?.edges) continue;
      for (const edge of step.edges) {
        if (!edge.targetStepId || edge.terminal) continue;
        if (!levelById.has(edge.targetStepId)) {
          levelById.set(edge.targetStepId, current.level + 1);
          queue.push({ id: edge.targetStepId, level: current.level + 1 });
        }
      }
    }
    // Any step not reached by BFS (orphaned / disconnected) goes to a floating row
    const maxReachable = levelById.size > 0 ? Math.max(...Array.from(levelById.values())) : -1;
    const floatingLevel = maxReachable + 1;
    for (const step of this.steps) {
      if (!levelById.has(step.id)) {
        levelById.set(step.id, floatingLevel);
      }
    }
    const maxLevel = Math.max(0, ...Array.from(levelById.values()));
    const levels: WorkflowStep[][] = Array.from({ length: maxLevel + 1 }, () => []);
    for (const step of this.steps) {
      const level = levelById.get(step.id);
      if (level !== undefined) levels[level].push(step);
    }
    return levels.filter(row => row.length > 0).map(row => row.sort((a, b) => a.order - b.order));
  }

  get orphanStepIds(): Set<string> {
    if (!this.steps.length) return new Set();
    const start = this.steps.find(s => s.start) || this.steps[0];
    const reachable = new Set<string>();
    const queue: string[] = start?.id ? [start.id] : [];
    while (queue.length) {
      const id = queue.shift()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      const step = this.steps.find(s => s.id === id);
      for (const edge of step?.edges || []) {
        if (edge.targetStepId && !edge.terminal) queue.push(edge.targetStepId);
      }
    }
    return new Set(this.steps.filter(s => !reachable.has(s.id)).map(s => s.id));
  }

  unlinkedSteps(): WorkflowStep[] {
    const ids = this.orphanStepIds;
    return this.steps.filter(s => ids.has(s.id));
  }

  edgeTargetLabel(edge: WorkflowEdge): string {
    if (edge.terminal) return 'Terminal';
    if (!edge.targetStepId) return 'Unset';
    const target = this.steps.find(s => s.id === edge.targetStepId);
    return target?.name ? `${target.name} (${target.id})` : edge.targetStepId;
  }

  edgeRoleLabel(edge: WorkflowEdge): string {
    const roles = (edge.allowedRoles || []).filter(Boolean);
    const roleText = roles.length ? `Roles: ${roles.join(', ')}` : '';
    const submitterText = edge.onlySubmitter ? 'Submitter only' : '';
    if (roleText && submitterText) return `${roleText} · ${submitterText}`;
    return roleText || submitterText || 'No role set';
  }

  // ── Field management ────────────────────────────────────────────────────────

  addField(step: WorkflowStep): void {
    if (!step.fields) step.fields = [];
    step.fields.push({ key: '', type: 'STRING', required: false, unique: false, config: {} });
  }

  removeField(step: WorkflowStep, index: number): void {
    if (!step.fields) return;
    const removedKey = step.fields[index].key;
    step.fields.splice(index, 1);
    // Remove from readonlyFieldKeys of all subsequent steps if it was referenced
    if (removedKey) {
      this.steps.forEach(s => {
        if (s.readonlyFieldKeys) {
          s.readonlyFieldKeys = s.readonlyFieldKeys.filter(k => k !== removedKey);
        }
      });
    }
  }

  /** All fields defined in steps BEFORE the given step, for use as readonly context. */
  getFieldsFromPreviousSteps(step: WorkflowStep): DomainModelField[] {
    const ordered = this.orderedSteps();
    const idx = ordered.findIndex(s => s.id === step.id);
    const result: DomainModelField[] = [];
    for (let i = 0; i < idx; i++) {
      (ordered[i].fields || []).forEach(f => {
        if (f.key && !result.some(r => r.key === f.key)) result.push(f);
      });
    }
    return result;
  }

  getFieldOptionLabel(field: DomainModelField): string {
    return `${field.key} (${field.type})`;
  }

  // ── Edge management ─────────────────────────────────────────────────────────

  addEdgeToStep(step: WorkflowStep): void {
    step.edges = [...step.edges, this.newEdge(step.id)];
  }

  removeEdgeFromStep(step: WorkflowStep, edgeIndex: number): void {
    step.edges.splice(edgeIndex, 1);
  }

  addGlobalEdge(): void {
    this.globalEdges = [...this.globalEdges, this.newEdge()];
  }

  removeGlobalEdge(index: number): void {
    this.globalEdges.splice(index, 1);
  }

  stepTargetOptions(currentStepId: string): WorkflowStep[] {
    return this.steps.filter(s => s.id !== currentStepId);
  }

  // ── List helpers (used by template) ─────────────────────────────────────────

  addListItem(list: string[]): void { list.push(''); }
  removeListItem(list: string[], index: number): void { list.splice(index, 1); }
  setListItem(list: string[], index: number, value: string): void { list[index] = value; }

  csv(values: string[] | undefined): string { return (values || []).join(', '); }
  parseCsv(input: string): string[] {
    return (input || '').split(',').map(v => v.trim()).filter(v => !!v);
  }

  // ── Save / Publish / Archive / Delete ───────────────────────────────────────

  saveDraft(): void {
    if (this.workflowStatus === 'PUBLISHED') { this.error = 'Archive the workflow before editing.'; return; }
    if (!this.name.trim()) { this.error = 'Workflow name is required.'; return; }
    if (this.steps.length === 0) { this.error = 'At least one step is required.'; return; }

    this.error = '';
    this.successMsg = '';
    this.publishErrors = [];
    this.saving = true;

    const payload = {
      name: this.name.trim(),
      description: this.description,
      steps: this.sanitizeSteps(this.steps),
      globalEdges: this.sanitizeEdges(this.globalEdges),
    };

    const request$: Observable<ProcessDefinitionResponse> = this.workflowSlug
      ? this.processService.updateWorkflow(this.domainSlug, this.appSlug, this.workflowSlug, payload)
      : this.processService.createWorkflow(this.domainSlug, this.appSlug, payload);

    request$.subscribe({
      next: (res: ProcessDefinitionResponse) => {
        this.saving = false;
        this.successMsg = 'Draft saved successfully.';
        this.workflowSlug = res.workflow.slug;
        this.workflowStatus = res.workflow.status;
        this.steps = (res.workflow.steps || []).map(s => this.withStepDefaults(s));
        this.globalEdges = (res.workflow.globalEdges || []).map(e => this.withEdgeDefaults(e));
        this.syncNextStepIndex(this.steps);
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { wf: this.workflowSlug },
          queryParamsHandling: 'merge',
        });
      },
      error: (err: any) => {
        this.saving = false;
        this.error = err?.error?.message || 'Failed to save draft';
      }
    });
  }

  publish(): void {
    if (!this.workflowSlug) { this.error = 'Save the draft first, then publish.'; return; }
    this.saving = true; this.error = ''; this.successMsg = ''; this.publishErrors = [];
    this.processService.publishWorkflow(this.domainSlug, this.appSlug, this.workflowSlug).subscribe({
      next: (res: ProcessDefinitionResponse) => {
        this.saving = false;
        this.workflowStatus = res.workflow.status;
        this.successMsg = 'Workflow published successfully.';
      },
      error: (err: any) => {
        this.saving = false;
        this.publishErrors = this.extractValidationErrors(err);
        this.error = this.publishErrors.length
          ? 'Publish failed. Hover the warning icon for details.'
          : err?.error?.message || 'Failed to publish workflow';
      }
    });
  }

  archive(): void {
    if (!this.workflowSlug || !confirm('Archive this workflow?')) return;
    this.saving = true; this.error = ''; this.successMsg = '';
    this.processService.archiveWorkflow(this.domainSlug, this.appSlug, this.workflowSlug).subscribe({
      next: () => { this.saving = false; this.workflowStatus = 'ARCHIVED'; this.successMsg = 'Workflow archived.'; },
      error: (err: any) => { this.saving = false; this.error = err?.error?.message || 'Failed to archive'; }
    });
  }

  deleteDraft(): void {
    if (!this.workflowSlug || !confirm('Delete this DRAFT workflow? This cannot be undone.')) return;
    this.saving = true; this.error = '';
    this.processService.deleteWorkflow(this.domainSlug, this.appSlug, this.workflowSlug).subscribe({
      next: () => {
        this.saving = false;
        this.successMsg = 'Draft workflow deleted.';
        this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug]);
      },
      error: (err: any) => { this.saving = false; this.error = err?.error?.message || 'Failed to delete'; }
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private extractValidationErrors(err: any): string[] {
    const details = err?.error?.details;
    if (Array.isArray(details)) return details.map((item: any) => String(item)).filter(Boolean);
    if (details && typeof details === 'object') return Object.values(details).map((item: any) => String(item)).filter(Boolean);
    const message = err?.error?.message;
    return message ? [String(message)] : [];
  }

  private withStepDefaults(step: WorkflowStep): WorkflowStep {
    return {
      ...step,
      fields: step.fields || [],
      readonlyFieldKeys: step.readonlyFieldKeys || [],
      edges: (step.edges || []).map(e => this.withEdgeDefaults(e)),
      start: !!step.start,
      end: !!step.end,
    };
  }

  private withEdgeDefaults(edge: WorkflowEdge): WorkflowEdge {
    return {
      id: edge.id || '',
      name: edge.name || '',
      targetStepId: edge.targetStepId || null,
      terminal: !!edge.terminal,
      allowedRoles: edge.allowedRoles || [],
      allowedUserIds: [],
      onlySubmitter: !!edge.onlySubmitter,
      requiredFields: edge.requiredFields || [],
      conditions: edge.conditions || [],
      autoActions: edge.autoActions || [],
      statusLabel: edge.statusLabel || '',
    };
  }

  private newEdge(currentStepId?: string): WorkflowEdge {
    const prefix = currentStepId ? `${currentStepId}_` : 'global_';
    return {
      id: `${prefix}edge_${Date.now()}`,
      name: 'Action',
      targetStepId: null,
      terminal: false,
      allowedRoles: [],
      allowedUserIds: [],
      onlySubmitter: false,
      requiredFields: [],
      conditions: [],
      autoActions: [],
      statusLabel: '',
    };
  }

  private normalizeStepOrder(): void {
    this.steps.forEach((step, index) => { step.order = index; });
  }

  private allocateStepIndex(): number {
    while (this.steps.some(step => step.id === `step_${this.nextStepIndex}`)) {
      this.nextStepIndex += 1;
    }
    const current = this.nextStepIndex;
    this.nextStepIndex += 1;
    return current;
  }

  private syncNextStepIndex(steps: WorkflowStep[]): void {
    let max = 0;
    for (const step of steps) {
      const match = /^step_(\d+)$/.exec(step.id || '');
      if (match) {
        const value = Number(match[1]);
        if (!Number.isNaN(value)) max = Math.max(max, value);
      }
    }
    this.nextStepIndex = Math.max(this.nextStepIndex, max + 1);
  }

  private sanitizeSteps(steps: WorkflowStep[]): WorkflowStep[] {
    return steps.map((step, index) => ({
      ...step,
      id: step.id.trim(),
      name: step.name.trim(),
      order: index,
      fields: step.fields || [],
      readonlyFieldKeys: (step.readonlyFieldKeys || []).filter(k => !!k),
      edges: this.sanitizeEdges(step.edges),
    }));
  }

  private sanitizeEdges(edges: WorkflowEdge[]): WorkflowEdge[] {
    return edges.map(edge => ({
      ...edge,
      id: edge.id.trim(),
      name: edge.name.trim(),
      targetStepId: edge.terminal ? null : (edge.targetStepId || null),
      allowedRoles: (edge.allowedRoles || []).map(v => v.trim()).filter(Boolean),
      allowedUserIds: [],
      requiredFields: (edge.requiredFields || []).map(v => v.trim()).filter(Boolean),
      conditions: edge.conditions || [],
      autoActions: edge.autoActions || [],
      statusLabel: edge.statusLabel || undefined,
    }));
  }
}
