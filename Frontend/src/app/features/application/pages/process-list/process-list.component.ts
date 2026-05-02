import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProcessService } from '../../../../core/services/process.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { ProcessDefinition, ProcessDefinitionResponse, STATUS_BADGE_CLASS } from '../../../../core/models/process.model';

@Component({
  selector: 'app-process-list',
  templateUrl: './process-list.component.html',
  styleUrls: ['./process-list.component.css']
})
export class ProcessListComponent implements OnInit {

  domainSlug = '';
  appSlug = '';

  workflows: ProcessDefinitionResponse[] = [];
  loading = false;
  error = '';
  actionLoading: Record<string, boolean> = {};
  actionError: Record<string, string> = {};

  statusBadge = STATUS_BADGE_CLASS;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private processService: ProcessService,
    private themeService: ThemeService,
  ) {}

  themeColor = '#1a1a2e';

  ngOnInit(): void {
    this.domainSlug = this.route.snapshot.params['slug'];
    this.appSlug = this.route.snapshot.params['appSlug'];
    this.themeColor = this.themeService.resolveThemeColor(this.domainSlug, this.appSlug);
    this.loadWorkflows();
  }

  loadWorkflows(): void {
    this.loading = true;
    this.error = '';
    this.processService.listWorkflows(this.domainSlug, this.appSlug).subscribe({
      next: (res: ProcessDefinition[]) => {
        this.workflows = Array.isArray(res)
          ? res.map((d: ProcessDefinition) => ({
              workflow: d,
              stepCount: d.steps?.length ?? 0,
              valid: false,
              validationErrors: [],
            }))
          : [];
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load workflows';
        this.loading = false;
      }
    });
  }

  createNew(): void {
    if (this.workflows.length > 0) {
      this.editWorkflow(this.workflows[0].workflow.slug);
      return;
    }
    this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug, 'workflows', 'builder']);
  }

  editWorkflow(slug: string): void {
    this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug, 'workflows', 'builder'], {
      queryParams: { wf: slug }
    });
  }

  startWorkflow(slug: string): void {
    this.setActionLoading(slug, true);
    this.processService.startWorkflow(this.domainSlug, this.appSlug, slug).subscribe({
      next: (res) => {
        this.setActionLoading(slug, false);
        const instanceId = res.instanceId;
        if (instanceId) {
          this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug, 'instances', instanceId]);
        }
      },
      error: (err: any) => {
        this.setActionLoading(slug, false);
        this.actionError[slug] = err?.error?.message || 'Failed to start workflow';
      }
    });
  }

  publishWorkflow(slug: string): void {
    this.setActionLoading(slug, true);
    this.processService.publishWorkflow(this.domainSlug, this.appSlug, slug).subscribe({
      next: () => { this.setActionLoading(slug, false); this.loadWorkflows(); },
      error: (err: any) => {
        this.setActionLoading(slug, false);
        this.actionError[slug] = err?.error?.message || 'Failed to publish';
      }
    });
  }

  archiveWorkflow(slug: string): void {
    if (!confirm('Archive this workflow? Running instances will continue but no new ones can start.')) return;
    this.setActionLoading(slug, true);
    this.processService.archiveWorkflow(this.domainSlug, this.appSlug, slug).subscribe({
      next: () => { this.setActionLoading(slug, false); this.loadWorkflows(); },
      error: (err: any) => {
        this.setActionLoading(slug, false);
        this.actionError[slug] = err?.error?.message || 'Failed to archive';
      }
    });
  }

  deleteWorkflow(slug: string): void {
    if (!confirm('Delete this draft workflow? This cannot be undone.')) return;
    this.setActionLoading(slug, true);
    this.processService.deleteWorkflow(this.domainSlug, this.appSlug, slug).subscribe({
      next: () => { this.setActionLoading(slug, false); this.loadWorkflows(); },
      error: (err: any) => {
        this.setActionLoading(slug, false);
        this.actionError[slug] = err?.error?.message || 'Failed to delete';
      }
    });
  }

  viewInstances(): void {
    this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug, 'instances']);
  }

  viewTasks(): void {
    this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug, 'tasks']);
  }

  goBack(): void {
    this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug]);
  }

  private setActionLoading(slug: string, val: boolean): void {
    this.actionLoading = { ...this.actionLoading, [slug]: val };
  }
}
