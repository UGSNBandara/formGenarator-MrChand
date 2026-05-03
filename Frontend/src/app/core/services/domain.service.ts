import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { BaseService } from './api.service';

export interface CreateDomainPayload {
  name: string;
  slug: string;
  description?: string;
  industry?: string;
}

export interface CreateApplicationPayload {
  name: string;
  slug: string;
  ownerUserId?: string;
}

export type DomainFieldType =
  | 'STRING'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'REFERENCE'
  | 'EMPLOYEE_REFERENCE'
  | 'OBJECT'
  | 'ARRAY';

export interface DomainModelField {
  key: string;
  type: DomainFieldType;
  required?: boolean;
  unique?: boolean;
  config?: Record<string, any>;
}

export interface CreateDomainModelPayload {
  name: string;
  slug: string;
  description?: string;
  sharedWithAllApps?: boolean;
  allowedAppIds?: string[];
  fields?: DomainModelField[];
}

export interface UpdateDomainModelPayload {
  name?: string;
  description?: string;
  sharedWithAllApps?: boolean;
  allowedAppIds?: string[];
  fields?: DomainModelField[];
}

@Injectable({ providedIn: 'root' })
export class DomainService {
  private adaptive = environment.adaptiveApi;

  constructor(private baseService: BaseService) { }

  createDomain(payload: CreateDomainPayload): Observable<any> {
    return this.baseService.post(`${environment.api}/domain`, true, payload);
  }

  getMyDomains(): Observable<any> {
    return this.baseService.get(`${environment.api}/domain`, true);
  }

  getBySlug(slug: string): Observable<any> {
    return this.baseService.get(`${environment.api}/domain/slug/${slug}`, true);
  }

  getDomainGroups(slug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${slug}/groups`, true);
  }

  createDomainGroup(slug: string, payload: { name: string; permissions: string[] }): Observable<any> {
    return this.baseService.post(`${this.adaptive}/domains/${slug}/groups`, true, payload);
  }

  updateDomainGroup(slug: string, groupId: string, payload: { name: string; permissions: string[] }): Observable<any> {
    return this.baseService.put(`${this.adaptive}/domains/${slug}/groups/${groupId}`, true, payload);
  }

  deleteDomainGroup(slug: string, groupId: string): Observable<any> {
    return this.baseService.delete(`${this.adaptive}/domains/${slug}/groups/${groupId}`, true, {});
  }

  getDomainRoles(slug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${slug}/access/me`, true);
  }

  getDomainUsersWithGroups(slug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${slug}/groups/users`, true);
  }

  getWorkflowRoles(slug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${slug}/workflow-roles`, true);
  }

  getUsersWithWorkflowRoles(slug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${slug}/workflow-roles/users`, true);
  }

  createWorkflowRole(slug: string, payload: { name: string }): Observable<any> {
    return this.baseService.post(`${this.adaptive}/domains/${slug}/workflow-roles`, true, payload);
  }

  updateWorkflowRole(slug: string, roleId: string, payload: { name: string }): Observable<any> {
    return this.baseService.put(`${this.adaptive}/domains/${slug}/workflow-roles/${roleId}`, true, payload);
  }

  deleteWorkflowRole(slug: string, roleId: string): Observable<any> {
    return this.baseService.delete(`${this.adaptive}/domains/${slug}/workflow-roles/${roleId}`, true, {});
  }

  addWorkflowRoleMember(slug: string, roleId: string, username: string): Observable<any> {
    return this.baseService.post(`${this.adaptive}/domains/${slug}/workflow-roles/${roleId}/members`, true, { username });
  }

  removeWorkflowRoleMember(slug: string, roleId: string, userId: string): Observable<any> {
    return this.baseService.delete(`${this.adaptive}/domains/${slug}/workflow-roles/${roleId}/members/${userId}`, true, {});
  }

  getGroupMembers(slug: string, groupId: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${slug}/groups/${groupId}/members`, true);
  }

  getUserGroups(slug: string, userId: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${slug}/groups/users/${userId}`, true);
  }

  addDomainGroupMember(slug: string, groupId: string, username: string): Observable<any> {
    return this.baseService.post(`${this.adaptive}/domains/${slug}/groups/${groupId}/members`, true, { username });
  }

  removeDomainGroupMember(slug: string, groupId: string, userId: string): Observable<any> {
    return this.baseService.delete(`${this.adaptive}/domains/${slug}/groups/${groupId}/members/${userId}`, true, {});
  }

  getApplications(slug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${slug}/apps`, true);
  }

  createApplication(slug: string, payload: CreateApplicationPayload): Observable<any> {
    return this.baseService.post(`${this.adaptive}/domains/${slug}/apps`, true, payload);
  }

  getApplication(slug: string, appSlug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${slug}/apps/${appSlug}`, true);
  }

  deleteApplication(slug: string, appSlug: string): Observable<any> {
    return this.baseService.delete(`${this.adaptive}/domains/${slug}/apps/${appSlug}`, true, {});
  }

  getAppGroups(slug: string, appSlug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${slug}/apps/${appSlug}/groups`, true);
  }

  createAppGroup(slug: string, appSlug: string, payload: { name: string; permissions: string[] }): Observable<any> {
    return this.baseService.post(`${this.adaptive}/domains/${slug}/apps/${appSlug}/groups`, true, payload);
  }

  updateAppGroup(slug: string, appSlug: string, groupId: string, payload: { name: string; permissions: string[] }): Observable<any> {
    return this.baseService.put(`${this.adaptive}/domains/${slug}/apps/${appSlug}/groups/${groupId}`, true, payload);
  }

  deleteAppGroup(slug: string, appSlug: string, groupId: string): Observable<any> {
    return this.baseService.delete(`${this.adaptive}/domains/${slug}/apps/${appSlug}/groups/${groupId}`, true, {});
  }

  getAppUsersWithGroups(slug: string, appSlug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${slug}/apps/${appSlug}/groups/users`, true);
  }

  getAppGroupMembers(slug: string, appSlug: string, groupId: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${slug}/apps/${appSlug}/groups/${groupId}/members`, true);
  }

  getUserAppGroups(slug: string, appSlug: string, userId: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${slug}/apps/${appSlug}/groups/users/${userId}`, true);
  }

  addAppGroupMember(slug: string, appSlug: string, groupId: string, username: string): Observable<any> {
    return this.baseService.post(`${this.adaptive}/domains/${slug}/apps/${appSlug}/groups/${groupId}/members`, true, { username });
  }

  removeAppGroupMember(slug: string, appSlug: string, groupId: string, userId: string): Observable<any> {
    return this.baseService.delete(`${this.adaptive}/domains/${slug}/apps/${appSlug}/groups/${groupId}/members/${userId}`, true, {});
  }

  // Domain Models (Domain-level storage; UI is within App Builder)
  getDomainModels(domainSlug: string, appSlug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${domainSlug}/models?appSlug=${encodeURIComponent(appSlug)}`, true);
  }

  getDomainModel(domainSlug: string, appSlug: string, modelSlug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${domainSlug}/models/${encodeURIComponent(modelSlug)}?appSlug=${encodeURIComponent(appSlug)}`, true);
  }

  createDomainModel(domainSlug: string, appSlug: string, payload: CreateDomainModelPayload): Observable<any> {
    return this.baseService.post(`${this.adaptive}/domains/${domainSlug}/models?appSlug=${encodeURIComponent(appSlug)}`, true, payload);
  }

  updateDomainModel(domainSlug: string, appSlug: string, modelSlug: string, payload: UpdateDomainModelPayload): Observable<any> {
    return this.baseService.put(`${this.adaptive}/domains/${domainSlug}/models/${encodeURIComponent(modelSlug)}?appSlug=${encodeURIComponent(appSlug)}`, true, payload);
  }

  deleteDomainModel(domainSlug: string, appSlug: string, modelSlug: string): Observable<any> {
    return this.baseService.delete(`${this.adaptive}/domains/${domainSlug}/models/${encodeURIComponent(modelSlug)}?appSlug=${encodeURIComponent(appSlug)}`, true, {});
  }

  // Legacy employee records (read-only for existing form integrations)
  getEmployees(domainSlug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${domainSlug}/models/employees/records`, true);
  }

  // Model Templates
  listModelTemplates(domainSlug: string, appSlug: string): Observable<any[]> {
    return this.baseService.get(`${this.adaptive}/domains/${domainSlug}/models/templates?appSlug=${encodeURIComponent(appSlug)}`, true);
  }

  // Model Templates
  getModelTemplates(domainSlug: string, appSlug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${domainSlug}/models/templates?appSlug=${encodeURIComponent(appSlug)}`, true);
  }

  createModelFromTemplate(domainSlug: string, appSlug: string, templateId: string, modelSlug: string, modelName: string): Observable<any> {
    return this.baseService.post(`${this.adaptive}/domains/${domainSlug}/models/from-template?appSlug=${encodeURIComponent(appSlug)}`, true, {
      templateId,
      modelSlug,
      modelName
    });
  }

  // Process Templates
  getProcessTemplates(domainSlug: string, appSlug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${domainSlug}/apps/${appSlug}/process/templates`, true);
  }

  createProcessFromTemplate(domainSlug: string, appSlug: string, templateId: string): Observable<any> {
    return this.baseService.post(`${this.adaptive}/domains/${domainSlug}/apps/${appSlug}/process/from-template`, true, { templateId });
  }

  // ── Domain Branding / Customization ──────────────────────────────────────

  getDomainBranding(slug: string): Observable<any> {
    return this.baseService.get(`${this.adaptive}/domains/${slug}/branding`, false);
  }

  updateDomainBranding(slug: string, branding: any): Observable<any> {
    return this.baseService.patch(`${this.adaptive}/domains/${slug}/branding`, true, branding);
  }
}

export const _domainService = [
  { provide: DomainService, useClass: DomainService, multi: true },
];
