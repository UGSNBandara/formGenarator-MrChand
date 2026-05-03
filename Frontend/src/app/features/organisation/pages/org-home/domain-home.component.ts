import { Component, OnInit, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomainService } from '../../../../core/services/domain.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ThemeService, THEMES, DomainBranding } from '../../../../core/services/theme.service';
import { ModernCardComponent } from '../../../../shared/components/modern-card/modern-card.component';
import { ModernButtonComponent } from '../../../../shared/components/modern-button/modern-button.component';
import { ModernInputComponent } from '../../../../shared/components/modern-input/modern-input.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

/** Re-export for backward compat if other modules import from here */
export const DOMAIN_THEMES = THEMES;

@Component({
  selector: 'app-domain-home',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, ModernCardComponent, ModernButtonComponent, ModernInputComponent, ConfirmDialogComponent],
  templateUrl: './domain-home.component.html',
  styleUrls: ['./domain-home.component.css']
})
export class DomainHomeComponent implements OnInit {
  slug = '';
  domain: any = null;
  error = '';

  loginForm: FormGroup;
  signupForm: FormGroup;
  submittedLogin = false;
  submittedSignup = false;
  loadingLogin = false;
  loadingSignup = false;
  loginError = '';
  signupError = '';
  signupMessage = '';

  domainGroups: any[] = [];
  domainGroupsLoading = false;
  groupError = '';
  memberInputs: Record<string, string> = {};

  domainUsers: any[] = [];
  usersLoading = false;
  draggedUser: any = null;
  draggedFromGroupId: string | null = null;

  apps: any[] = [];
  appsLoading = false;
  newApp = { name: '', slug: '', ownerUserId: '' };
  appMessage = '';
  appError = '';

  domainAccess = { permissions: [] as string[], groups: [] as string[] };

  mode: 'PREVIEW' | 'EDIT' | 'ACCESS' | 'SETTINGS' = 'PREVIEW';
  showCreateAppForm = false;

  showLogoutConfirm = false;

  // ── Theme ─────────────────────────────────────────────────────────────────
  readonly domainThemes = THEMES;
  selectedThemeId = 'midnight';
  activeAuthTab: 'login' | 'register' = 'login';

  // ── Branding / Customization ──────────────────────────────────────────────
  branding: DomainBranding = {};
  brandingDraft: DomainBranding = {};
  brandingSaving = false;
  brandingMessage = '';
  brandingError = '';
  domainDescription = '';

  readonly heroLayoutOptions = [
    { value: 'default', label: 'Default' },
    { value: 'compact', label: 'Compact' },
    { value: 'minimal', label: 'Minimal' },
  ];

  readonly cornerRadiusOptions = [
    { value: 'rounded', label: 'Rounded' },
    { value: 'sharp', label: 'Sharp' },
    { value: 'pill', label: 'Pill' },
  ];

  readonly densityOptions = [
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'compact', label: 'Compact' },
  ];

  readonly appCardLayoutOptions = [
    { value: 'grid', label: 'Grid' },
    { value: 'list', label: 'List' },
  ];

  /** Returns the draft during SETTINGS mode so the page live-previews; otherwise the saved branding */
  get activeBranding(): DomainBranding {
    return this.mode === 'SETTINGS' ? this.brandingDraft : this.branding;
  }

  get currentTheme() {
    return this.themeService.getTheme(this.activeBranding.themeId || this.selectedThemeId);
  }

  get heroBg(): string {
    const p = this.currentTheme.primary;
    return `linear-gradient(135deg, ${p} 0%, ${p}dd 100%)`;
  }

  get previewTheme() {
    const id = this.brandingDraft.themeId || this.selectedThemeId;
    return this.themeService.getTheme(id);
  }

  selectTheme(id: string): void {
    this.selectedThemeId = id;
    this.brandingDraft.themeId = id;
  }



  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private domainService: DomainService,
    private fb: FormBuilder,
    public auth: AuthService,
    private themeService: ThemeService,
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
    });
    this.signupForm = this.fb.group({
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  requestLogout(): void {
    this.showLogoutConfirm = true;
  }

  cancelLogout(): void {
    this.showLogoutConfirm = false;
  }

  confirmLogout(): void {
    this.auth.logout();
    this.showLogoutConfirm = false;
    if (this.slug) {
      this.router.navigate(['/domain', this.slug]);
      return;
    }
    this.router.navigate(['/']);
  }

  ngOnInit(): void {
    this.slug = this.route.snapshot.params['slug'];
    if (this.slug) {
      // Always load branding (public endpoint) — works for unauthenticated users too
      this.loadBranding();

      this.domainService.getBySlug(this.slug).subscribe({
        next: (res) => {
          this.domain = res;
          this.domainDescription = res.description || '';
          this.mode = 'PREVIEW';
          this.showCreateAppForm = false;
          this.initializeAccess();
        },
        error: (err) => this.error = err?.error?.message || 'Domain not found or access denied'
      });
    }
  }

  // ── Branding Methods ──────────────────────────────────────────────────────

  private loadBranding(): void {
    this.domainService.getDomainBranding(this.slug).subscribe({
      next: (b) => {
        this.branding = b || {};
        this.brandingDraft = { ...this.branding };

        // Sync theme from server branding (global for ALL users)
        if (this.branding.themeId) {
          this.selectedThemeId = this.branding.themeId;
        }

        // Apply branding CSS vars
        this.themeService.applyBranding(this.branding);
      },
      error: () => {
        // Branding endpoint might not exist yet; use defaults
        this.branding = {};
        this.brandingDraft = {};
      }
    });
  }

  saveBranding(): void {
    this.brandingSaving = true;
    this.brandingMessage = '';
    this.brandingError = '';

    // Include description in the branding payload
    const payload = { ...this.brandingDraft, description: this.domainDescription };

    this.domainService.updateDomainBranding(this.slug, payload).subscribe({
      next: (saved) => {
        this.branding = saved;
        this.brandingDraft = { ...saved };
        this.brandingSaving = false;
        this.brandingMessage = 'Settings saved successfully.';
        this.themeService.applyBranding(saved);

        // Update the domain object locally so description shows in hero
        if (this.domain) {
          this.domain.description = this.domainDescription;
        }

        // Update theme from server response
        if (saved.themeId) {
          this.selectedThemeId = saved.themeId;
        }

        setTimeout(() => this.brandingMessage = '', 3000);
      },
      error: (err) => {
        this.brandingSaving = false;
        this.brandingError = err?.error || 'Failed to save branding.';
        setTimeout(() => this.brandingError = '', 4000);
      }
    });
  }

  resetBranding(): void {
    this.brandingDraft = this.themeService.getDefaultBranding();
    this.selectedThemeId = 'midnight';
  }

  get brandingHasChanges(): boolean {
    return JSON.stringify(this.branding) !== JSON.stringify(this.brandingDraft);
  }

  // ── Access Logic ──────────────────────────────────────────────────────────

  private initializeAccess() {
    if (!this.domain) {
      return;
    }
    if (this.isOwnerContext()) {
      this.domainAccess.permissions = [
        'DOMAIN_MANAGE',
        'DOMAIN_MANAGE_USERS',
        'DOMAIN_MANAGE_APPS',
        'DOMAIN_USE_APP'
      ];
      this.domainAccess.groups = ['Domain Admin'];
      this.loadApplications();
      if (this.mode === 'ACCESS') {
        this.loadDomainGroups();
      }
      return;
    }
    if (this.auth.isLoggedIn()) {
      this.domainService.getDomainRoles(this.slug).subscribe({
        next: res => {
          this.domainAccess = res || { permissions: [], groups: [] };
          if (this.canUseApps || this.canManageApps) {
            this.loadApplications();
          }
        },
        error: () => { /* ignore */ }
      });
    }
  }

  goBackToAdaptive() {
    this.router.navigate(['/']);
  }

  private contextMatchesDomain(): boolean {
    const ctx = this.auth.getContext();
    return !!(ctx && this.domain && ctx.domainId === this.domain.id);
  }

  isDomainUser(): boolean {
    const ctx = this.auth.getContext();
    return !!(ctx && ctx.principalType === 'DOMAIN_USER' && this.contextMatchesDomain());
  }

  isOwnerContext(): boolean {
    const ctx = this.auth.getContext();
    return !!(ctx && ctx.principalType === 'OWNER');
  }

  get canManageUsers(): boolean {
    return this.isOwnerContext() || this.hasPermission('DOMAIN_MANAGE_USERS');
  }

  get canManageApps(): boolean {
    return this.isOwnerContext() || this.hasPermission('DOMAIN_MANAGE_APPS');
  }

  get canEditMode(): boolean {
    return this.isOwnerContext() || this.canManageApps;
  }

  get canAccessManager(): boolean {
    return this.isOwnerContext() || this.canManageUsers;
  }

  get canSettings(): boolean {
    return this.isOwnerContext() || this.hasPermission('DOMAIN_MANAGE');
  }

  enterPreviewMode() {
    this.mode = 'PREVIEW';
    this.showCreateAppForm = false;
    if ((this.canUseApps || this.canManageApps) && !this.appsLoading && this.apps.length === 0) {
      this.loadApplications();
    }
  }

  enterEditMode() {
    if (!this.canEditMode) {
      return;
    }
    this.mode = 'EDIT';
  }

  enterAccessManagerMode() {
    if (!this.canAccessManager) {
      return;
    }
    this.mode = 'ACCESS';
    this.showCreateAppForm = false;
    this.loadDomainGroups();
  }

  enterSettingsMode() {
    if (!this.canSettings) {
      return;
    }
    this.mode = 'SETTINGS';
    this.brandingDraft = { ...this.branding };
  }

  toggleCreateAppForm() {
    if (!this.canManageApps) {
      return;
    }
    this.showCreateAppForm = !this.showCreateAppForm;
  }

  focusNextOnEnter(event: Event, next: HTMLInputElement | null | undefined): void {
    event.preventDefault();
    event.stopPropagation();
    next?.focus();
  }

  submitOnEnter(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.submitNewApp();
  }

  get canUseApps(): boolean {
    return this.isOwnerContext() || this.hasPermission('DOMAIN_USE_APP');
  }

  private hasPermission(code: string): boolean {
    return this.domainAccess.permissions.includes(code);
  }

  get lf() { return this.loginForm.controls; }
  get sf() { return this.signupForm.controls; }

  submitLogin() {
    this.submittedLogin = true;
    if (this.loginForm.invalid) return;
    this.loadingLogin = true;
    this.auth.loginDomain(this.slug, this.lf['username'].value, this.lf['password'].value).subscribe({
      next: () => {
        this.loadingLogin = false;
        this.loginError = '';
        this.initializeAccess();
      },
      error: (err: any) => {
        this.loginError = err?.error ?? 'Login failed';
        this.loadingLogin = false;
      }
    });
  }

  submitSignup() {
    this.submittedSignup = true;
    if (this.signupForm.invalid) return;
    this.loadingSignup = true;
    this.auth.signupDomain(this.slug, this.sf['username'].value, this.sf['email'].value, this.sf['password'].value).subscribe({
      next: () => {
        this.signupMessage = 'Account created. Please log in.';
        this.signupError = '';
        this.loadingSignup = false;
        this.signupForm.reset();
        this.submittedSignup = false;
      },
      error: (err: any) => {
        this.signupError = err?.error ?? 'Signup failed';
        this.loadingSignup = false;
      }
    });
  }

  loadDomainGroups() {
    this.domainGroupsLoading = true;
    this.usersLoading = true;
    Promise.all([
      this.domainService.getDomainGroups(this.slug).toPromise(),
      this.domainService.getDomainUsersWithGroups(this.slug).toPromise()
    ]).then(([groups, users]) => {
      this.domainGroups = groups || [];
      this.domainUsers = users || [];
      this.domainGroupsLoading = false;
      this.usersLoading = false;
    }).catch(err => {
      this.groupError = err?.error ?? 'Failed to load groups and users';
      this.domainGroupsLoading = false;
      this.usersLoading = false;
    });
  }

  addMember(groupId: string) {
    const username = (this.memberInputs[groupId] || '').trim();
    if (!username) {
      return;
    }
    this.domainService.addDomainGroupMember(this.slug, groupId, username).subscribe({
      next: () => {
        this.memberInputs[groupId] = '';
        this.loadDomainGroups();
      },
      error: err => {
        this.groupError = err?.error ?? 'Failed to add member';
      }
    });
  }

  getUsersInGroup(groupId: string): any[] {
    return this.domainUsers.filter(user =>
      user.groups?.some((g: any) => g.groupId === groupId)
    );
  }

  getUsersWithoutGroups(): any[] {
    return this.domainUsers.filter(user => !user.groups || user.groups.length === 0);
  }

  onDragStart(event: DragEvent, user: any, fromGroupId: string | null): void {
    this.draggedUser = user;
    this.draggedFromGroupId = fromGroupId;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event: DragEvent, targetGroupId: string): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.draggedUser) return;

    const user = this.draggedUser;
    const fromGroupId = this.draggedFromGroupId;

    if (fromGroupId === targetGroupId) {
      this.draggedUser = null;
      this.draggedFromGroupId = null;
      return;
    }

    const removePromise = fromGroupId
      ? this.domainService.removeDomainGroupMember(this.slug, fromGroupId, user.id).toPromise()
      : Promise.resolve();

    removePromise.then(() => {
      return this.domainService.addDomainGroupMember(this.slug, targetGroupId, user.username).toPromise();
    }).then(() => {
      this.loadDomainGroups();
    }).catch(err => {
      this.groupError = 'Failed to update user group membership';
      console.error(err);
    }).finally(() => {
      this.draggedUser = null;
      this.draggedFromGroupId = null;
    });
  }

  onDragEnd(): void {
    this.draggedUser = null;
    this.draggedFromGroupId = null;
  }

  removeUserFromGroup(user: any, groupId: string): void {
    if (!confirm(`Remove ${user.username} from this group?`)) {
      return;
    }

    this.domainService.removeDomainGroupMember(this.slug, groupId, user.id)
      .toPromise()
      .then(() => {
        this.loadDomainGroups();
      })
      .catch(err => {
        this.groupError = 'Failed to remove user from group';
        console.error(err);
      });
  }

  loadApplications() {
    this.appsLoading = true;
    this.domainService.getApplications(this.slug).subscribe({
      next: apps => {
        this.apps = apps;
        this.appsLoading = false;
      },
      error: err => {
        this.appError = err?.error ?? 'Failed to load applications';
        this.appsLoading = false;
      }
    });
  }

  submitNewApp() {
    if (!this.newApp.name || !this.newApp.slug) {
      this.appError = 'Name and slug required';
      return;
    }
    this.appError = '';
    this.appMessage = '';
    this.domainService.createApplication(this.slug, this.newApp).subscribe({
      next: () => {
        this.appMessage = 'Application created';
        this.newApp = { name: '', slug: '', ownerUserId: '' };
        this.loadApplications();
      },
      error: err => {
        this.appError = err?.error ?? 'Failed to create application';
      }
    });
  }
}
