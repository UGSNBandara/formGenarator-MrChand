import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProcessService } from '../../../../core/services/process.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { DomainModelField, ProcessDefinition, WorkflowStep } from '../../../../core/models/process.model';

@Component({
  selector: 'app-start-workflow',
  templateUrl: './start-workflow.component.html',
  styleUrls: ['./start-workflow.component.css']
})
export class StartWorkflowComponent implements OnInit {
  domainSlug = '';
  appSlug = '';

  workflow: ProcessDefinition | null = null;
  startStep: WorkflowStep | null = null;
  modelFields: DomainModelField[] = [];
  formData: Record<string, any> = {};

  loading = false;
  submitting = false;
  error = '';

  themeColor = '#1a1a2e';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private processService: ProcessService,
    private themeService: ThemeService,
  ) {}

  ngOnInit(): void {
    this.domainSlug = this.route.snapshot.params['slug'];
    this.appSlug = this.route.snapshot.params['appSlug'];
    this.loadTheme();
    this.loadWorkflow();
  }

  private loadTheme() {
    this.themeColor = this.themeService.resolveThemeColor(this.domainSlug, this.appSlug);
  }

  private loadWorkflow(): void {
    this.loading = true;
    this.error = '';

    this.processService.listWorkflows(this.domainSlug, this.appSlug).subscribe({
      next: (workflows: ProcessDefinition[]) => {
        const published = (workflows || []).find(w => w.status === 'PUBLISHED');
        if (!published) {
          this.error = 'No published workflow found. Ask an app admin to publish one.';
          this.loading = false;
          return;
        }
        this.workflow = published;
        this.startStep = (published.steps || []).find(s => s.start) || null;
        if (!this.startStep) {
          this.error = 'Published workflow has no start step.';
          this.loading = false;
          return;
        }
        this.modelFields = (this.startStep.fields || []) as DomainModelField[];
        this.formData = this.buildInitialFormData();
        this.loading = false;
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load workflow';
        this.loading = false;
      }
    });
  }

  start(): void {
    if (!this.workflow) {
      return;
    }

    this.submitting = true;
    this.error = '';

    const payload = this.normalizePayloadByFieldType(this.formData);
    this.processService.startWorkflow(this.domainSlug, this.appSlug, this.workflow.slug, payload).subscribe({
      next: (res) => {
        this.submitting = false;
        this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug, 'instances', res.instanceId]);
      },
      error: (err: any) => {
        this.submitting = false;
        this.error = err?.error?.message || 'Failed to start workflow';
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug]);
  }

  fieldInputType(field: DomainModelField): string {
    if (field.type === 'NUMBER') {
      return 'number';
    }
    if (field.type === 'DATE') {
      return 'date';
    }
    if (field.type === 'DATETIME') {
      return 'datetime-local';
    }
    return 'text';
  }

  fieldIsCheckbox(field: DomainModelField): boolean {
    return field.type === 'BOOLEAN';
  }

  fieldIsJson(field: DomainModelField): boolean {
    return field.type === 'OBJECT' || field.type === 'ARRAY';
  }

  valueAsJsonText(key: string): string {
    const value = this.formData[key];
    if (value == null) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  updateJsonField(key: string, value: string): void {
    this.formData[key] = value;
  }

  private buildInitialFormData(): Record<string, any> {
    const map: Record<string, any> = {};
    for (const field of this.modelFields) {
      map[field.key] = this.defaultValue(field);
    }
    return map;
  }

  private defaultValue(field: DomainModelField): any {
    if (field.type === 'BOOLEAN') {
      return false;
    }
    if (field.type === 'ARRAY') {
      return '[]';
    }
    if (field.type === 'OBJECT') {
      return '{}';
    }
    return '';
  }

  private normalizePayloadByFieldType(source: Record<string, any>): Record<string, any> {
    const payload: Record<string, any> = {};

    for (const field of this.modelFields) {
      const raw = source[field.key];

      if (raw === undefined) {
        continue;
      }
      if (raw === '' && !field.required) {
        payload[field.key] = raw;
        continue;
      }

      switch (field.type) {
        case 'NUMBER': {
          const parsed = Number(raw);
          payload[field.key] = Number.isNaN(parsed) ? raw : parsed;
          break;
        }
        case 'BOOLEAN':
          payload[field.key] = !!raw;
          break;
        case 'ARRAY':
        case 'OBJECT':
          payload[field.key] = this.tryParseJson(raw);
          break;
        default:
          payload[field.key] = raw;
      }
    }

    return payload;
  }

  private tryParseJson(value: any): any {
    if (typeof value !== 'string') {
      return value;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
