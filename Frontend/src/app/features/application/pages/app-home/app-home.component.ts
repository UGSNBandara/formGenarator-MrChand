import { Component, OnInit } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { DomainService } from '../../../../core/services/domain.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ThemeService, THEMES } from '../../../../core/services/theme.service';

@Component({
  selector: 'app-app-home',
  templateUrl: './app-home.component.html',
  styleUrls: ['./app-home.component.css']
})
export class AppHomeComponent implements OnInit {
  domainSlug = '';
  appSlug = '';
  domain: any = null;
  app: any = null;
  error = '';

  appGroups: any[] = [];
  appGroupsLoading = false;
  groupError = '';
  memberInputs: Record<string, string> = {};

  appUsers: any[] = [];
  usersLoading = false;
  draggedUser: any = null;
  draggedFromGroupId: string | null = null;

  startingWorkflow = false;
  startError = '';

  currentUserAppGroups: any[] = [];
  appPermissions: string[] = [];

  mode: 'PREVIEW' | 'EDIT' | 'ACCESS' = 'PREVIEW';

  showDeleteConfirm = false;
  deleteConfirmText = '';
  deletingApp = false;
  deleteError = '';

  // Theme pulled from ThemeService
  themeColor = '#1a1a2e';
  appThemes = THEMES;
  selectedAppThemeId = 'midnight';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private domainService: DomainService,
    public auth: AuthService,
    private themeService: ThemeService,
  ) { }

  ngOnInit(): void {
    this.domainSlug = this.route.snapshot.params['slug'];
    this.appSlug = this.route.snapshot.params['appSlug'];

    if (this.domainSlug && this.appSlug) {
      this.loadDomain();
    }
  }

  private loadDomain() {
    this.domainService.getBySlug(this.domainSlug).subscribe({
      next: (res) => {
        this.domain = res;
        this.loadApplication();
      },
      error: (err) => this.error = err?.error?.message || 'Domain not found'
    });
  }

  private loadApplication() {
    this.domainService.getApplication(this.domainSlug, this.appSlug).subscribe({
      next: (res) => {
        this.app = res;
        this.themeColor = this.themeService.resolveThemeColor(this.domainSlug, this.appSlug);
        const appThemeId = this.themeService.getAppThemeId(this.domainSlug, this.appSlug);
        if (appThemeId) this.selectedAppThemeId = appThemeId;
        else this.selectedAppThemeId = this.themeService.getDomainThemeId(this.domainSlug);
        this.initializeAccess();
      },
      error: (err) => this.error = err?.error?.message || 'Application not found'
    });
  }

  private initializeAccess() {
    if (!this.domain || !this.app) {
      return;
    }
    if (this.isOwnerContext()) {
      this.appPermissions = [
        'APP_VIEW',
        'APP_CONFIGURE',
        'APP_START_WORKFLOW',
        'APP_EXECUTE_WORKFLOW',
        'APP_VIEW_ALL_INSTANCES',
        'APP_MANAGE_WORKFLOW'
      ];
      return;
    }
    if (this.auth.isLoggedIn()) {
      this.loadCurrentUserAppGroups();
    }
  }

  goBackToDomain() {
    this.router.navigate(['/domain', this.domainSlug]);
  }

  startWorkflow(): void {
    this.startingWorkflow = true;
    this.startError = '';
    this.router.navigate(['/domain', this.domainSlug, 'app', this.appSlug, 'start']);
    this.startingWorkflow = false;
  }

  private contextMatchesDomain(): boolean {
    const ctx = this.auth.getContext();
    return !!(ctx && this.domain && ctx.domainId === this.domain.id);
  }

  isOwnerContext(): boolean {
    const ctx = this.auth.getContext();
    return !!(ctx && ctx.principalType === 'OWNER');
  }

  get canManageApp(): boolean {
    return this.isOwnerContext() || this.appPermissions.includes('APP_CONFIGURE');
  }

  get canManageAppGroups(): boolean {
    return this.canAccessManager;
  }

  get canEditMode(): boolean {
    return this.isOwnerContext() || this.appPermissions.includes('APP_CONFIGURE');
  }

  get canEnterManageMode(): boolean {
    return this.canEditMode;
  }

  get canAccessManager(): boolean {
    return this.isOwnerContext() || this.appPermissions.includes('APP_CONFIGURE');
  }

  enterPreviewMode() {
    this.mode = 'PREVIEW';
  }

  enterEditMode() {
    if (!this.canEnterManageMode) {
      return;
    }
    this.mode = 'EDIT';
  }

  get deleteExpectedPhrase(): string {
    const appName = this.app?.name || '';
    return `delete ${appName}`.trim();
  }

  get canConfirmDelete(): boolean {
    return this.normalizeConfirmText(this.deleteConfirmText)
      === this.normalizeConfirmText(this.deleteExpectedPhrase);
  }

  openDeleteConfirm() {
    if (!this.canManageApp) {
      return;
    }
    this.showDeleteConfirm = true;
    this.deleteConfirmText = '';
    this.deleteError = '';
  }

  cancelDeleteConfirm() {
    if (this.deletingApp) {
      return;
    }
    this.showDeleteConfirm = false;
    this.deleteConfirmText = '';
    this.deleteError = '';
  }

  private normalizeConfirmText(value: string): string {
    return (value || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  confirmDeleteApplication() {
    if (!this.canManageApp) {
      return;
    }
    if (!this.canConfirmDelete) {
      return;
    }

    this.deletingApp = true;
    this.deleteError = '';
    this.domainService.deleteApplication(this.domainSlug, this.appSlug).subscribe({
      next: () => {
        this.deletingApp = false;
        this.showDeleteConfirm = false;
        this.router.navigate(['/domain', this.domainSlug]);
      },
      error: (err) => {
        this.deletingApp = false;
        this.deleteError = err?.error?.message || 'Failed to delete application';
      }
    });
  }

  enterAccessManagerMode() {
    if (!this.canAccessManager) {
      return;
    }
    this.mode = 'ACCESS';
    this.loadAppGroups();
  }

  // Load current user's app groups
  loadCurrentUserAppGroups() {
    const currentUserId = this.auth.getContext()?.userId;
    if (!currentUserId) {
      return;
    }
    this.domainService.getUserAppGroups(this.domainSlug, this.appSlug, currentUserId).subscribe({
      next: (groups) => {
        this.currentUserAppGroups = groups || [];
        const permissions = new Set<string>();
        (this.currentUserAppGroups || []).forEach((g: any) => {
          (g?.permissions || []).forEach((p: string) => this.expandPermissionAliases(p).forEach(x => permissions.add(x)));
        });
        this.appPermissions = Array.from(permissions);
      },
      error: () => {
        this.currentUserAppGroups = [];
        this.appPermissions = [];
      }
    });
  }

  private expandPermissionAliases(permission: string): string[] {
    const p = (permission || '').trim();
    if (!p) {
      return [];
    }
    const mapped: string[] = [p];
    switch (p) {
      case 'APP_READ':
      case 'APP_VIEW_WORKFLOWS':
      case 'APP_VIEW_PROCESSES':
        mapped.push('APP_VIEW');
        break;
      case 'APP_WRITE':
        mapped.push('APP_CONFIGURE');
        break;
      case 'APP_MANAGE_WORKFLOWS':
      case 'APP_MANAGE_PROCESSES':
        mapped.push('APP_MANAGE_WORKFLOW');
        break;
      case 'APP_START_PROCESS':
        mapped.push('APP_START_WORKFLOW');
        break;
      case 'APP_EXECUTE':
        mapped.push('APP_EXECUTE_WORKFLOW');
        break;
      default:
        break;
    }
    return mapped;
  }

  // Load app groups and users
  loadAppGroups() {
    if (!this.canAccessManager) {
      return;
    }
    this.appGroupsLoading = true;
    this.groupError = '';

    this.domainService.getAppGroups(this.domainSlug, this.appSlug).subscribe({
      next: (groups) => {
        this.appGroups = groups || [];
        this.loadAppUsers();
      },
      error: (err) => {
        this.groupError = err?.error?.message || 'Failed to load groups';
        this.appGroupsLoading = false;
      }
    });
  }

  loadAppUsers() {
    this.usersLoading = true;
    this.domainService.getAppUsersWithGroups(this.domainSlug, this.appSlug).subscribe({
      next: (users) => {
        this.appUsers = users || [];
        this.usersLoading = false;
        this.appGroupsLoading = false;
      },
      error: (err) => {
        console.error('Failed to load users:', err);
        this.usersLoading = false;
        this.appGroupsLoading = false;
      }
    });
  }

  // Drag and drop handlers
  onDragStart(event: DragEvent, user: any, fromGroupId: string | null) {
    this.draggedUser = user;
    this.draggedFromGroupId = fromGroupId;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event: DragEvent, targetGroupId: string) {
    event.preventDefault();

    if (!this.draggedUser) {
      return;
    }

    // Check if user is already in this group
    const isAlreadyInGroup = this.draggedUser.appGroups?.some(
      (g: any) => g.groupId === targetGroupId
    );

    if (isAlreadyInGroup) {
      alert('User is already in this group');
      this.draggedUser = null;
      this.draggedFromGroupId = null;
      return;
    }

    // Add user to the target group
    this.domainService.addAppGroupMember(
      this.domainSlug,
      this.appSlug,
      targetGroupId,
      this.draggedUser.username
    ).subscribe({
      next: () => {
        this.loadAppGroups();
        this.draggedUser = null;
        this.draggedFromGroupId = null;
      },
      error: (err) => {
        alert(err?.error?.message || 'Failed to add user to group');
        this.draggedUser = null;
        this.draggedFromGroupId = null;
      }
    });
  }

  onDragEnd() {
    this.draggedUser = null;
    this.draggedFromGroupId = null;
  }

  // Helper methods to filter users
  getUsersInGroup(groupId: string): any[] {
    return this.appUsers.filter(user =>
      user.appGroups?.some((g: any) => g.groupId === groupId)
    );
  }

  getUsersWithoutGroups(): any[] {
    return this.appUsers.filter(user =>
      !user.appGroups || user.appGroups.length === 0
    );
  }

  selectAppTheme(id: string) {
    this.selectedAppThemeId = id;
    this.themeColor = this.themeService.getTheme(id).primary;
    this.themeService.setAppTheme(this.domainSlug, this.appSlug, id);
  }

  // Remove user from group
  removeUserFromGroup(userId: string, groupId: string) {
    if (!confirm('Remove this user from the group?')) {
      return;
    }

    this.domainService.removeAppGroupMember(
      this.domainSlug,
      this.appSlug,
      groupId,
      userId
    ).subscribe({
      next: () => {
        this.loadAppGroups();
      },
      error: (err) => {
        alert(err?.error?.message || 'Failed to remove user from group');
      }
    });
  }
}
