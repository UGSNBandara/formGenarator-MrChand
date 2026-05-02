import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProcessService } from '../../../../core/services/process.service';
import { ThemeService } from '../../../../core/services/theme.service';
import {
  DomainModelField,
  ProcessInstance,
  StepEdgeView,
  StepViewResponse,
} from '../../../../core/models/process.model';

@Component({
  selector: 'app-instance-view',
  templateUrl: './instance-view.component.html',
  styleUrls: ['./instance-view.component.css']
})
export class InstanceViewComponent implements OnInit {

  domainSlug = '';
  appSlug = '';
  instanceId = '';

  instance: ProcessInstance | null = null;
  stepView: StepViewResponse | null = null;

  loading = false;
  submitting = false;
  error = '';
  successMsg = '';

  formData: Record<string, any> = {};
  selectedEdgeId = '';

  objectKeys = Object.keys;
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
    this.instanceId = this.route.snapshot.params['instanceId'];
    this.loadTheme();
    this.load();
  }

  private loadTheme() {
    this.themeColor = this.themeService.resolveThemeColor(this.domainSlug, this.appSlug);
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.successMsg = '';

    this.processService.getInstance(this.domainSlug, this.appSlug, this.instanceId).subscribe({
      next: (instance) => {
        this.instance = instance;
        if (instance.status === 'ACTIVE') {
          this.loadStepView();
        } else {
          this.stepView = null;
          this.loading = false;
        }
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load workflow instance';
        this.loading = false;
      }
    });
  }

  loadStepView(): void {
    this.processService.getStepView(this.domainSlug, this.appSlug, this.instanceId).subscribe({
      next: (view) => {
        this.stepView = view;
        this.formData = this.toEditableMap(view.currentData || {});

        const firstAvailable = (view.availableEdges || []).find(e => !e.disabled);
        this.selectedEdgeId = firstAvailable?.id || '';

        this.loading = false;
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load current workflow step';
        this.loading = false;
      }
    });
  }

  executeEdge(): void {
    if (!this.stepView || !this.selectedEdgeId) {
      return;
    }

    this.submitting = true;
    this.error = '';
    this.successMsg = '';

    const payload = {
      edgeId: this.selectedEdgeId,
      formData: this.normalizePayloadByFieldType(this.formData),
    };

    this.processService.executeEdge(this.domainSlug, this.appSlug, this.instanceId, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.successMsg = 'Workflow action executed successfully.';
        this.load();
      },
      error: (err: any) => {
        this.submitting = false;
        this.error = err?.error?.message || 'Failed to execute workflow edge';
      }
    });
  }

  goBackToApp(): void {
    this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug, 'tasks']);
  }

  get availableEdges(): StepEdgeView[] {
    return this.stepView?.availableEdges || [];
  }

  get modelFields(): DomainModelField[] {
    return this.stepView?.modelFields || [];
  }

  get editableFields(): DomainModelField[] {
    return this.modelFields.filter(f => !this.isReadOnlyField(f.key));
  }

  get readonlyContextFields(): DomainModelField[] {
    return this.modelFields.filter(f => this.isReadOnlyField(f.key));
  }

  get recordStatus(): string {
    return (this.stepView?.currentData?.['status'] as string) || '';
  }

  get historyRows() {
    return this.stepView?.history || this.instance?.history || [];
  }

  isReadOnlyField(key: string): boolean {
    return !!this.stepView?.readOnlyFields?.includes(key);
  }

  getEdgeDisabledReason(edgeId: string): string {
    const edge = this.availableEdges.find(e => e.id === edgeId);
    return edge?.disabledReason || '';
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

  prettyValue(value: any): string {
    if (value == null || value === '') {
      return '—';
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  private toEditableMap(data: Record<string, any>): Record<string, any> {
    const map: Record<string, any> = {};
    // Pre-fill ALL visible fields (editable + readonly) from the accumulated record
    for (const field of this.modelFields) {
      const value = data[field.key];
      map[field.key] = value == null ? this.defaultValue(field) : value;
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

    // Only send editable fields — readonly fields are context only, not submitted
    for (const field of this.editableFields) {
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
    const trimmed = value.trim();
    if (!trimmed) {
      return value;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
}
