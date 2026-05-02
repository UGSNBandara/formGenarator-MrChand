import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/services/auth.service';
import { DomainService } from '../../../../core/services/domain.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { HeroSectionComponent } from '../../../../shared/components/hero-section/hero-section.component';
import { ModernButtonComponent } from '../../../../shared/components/modern-button/modern-button.component';
import { ModernCardComponent } from '../../../../shared/components/modern-card/modern-card.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'home-page',
  standalone: true,
  imports: [CommonModule, RouterModule, HeroSectionComponent, ModernButtonComponent, ModernCardComponent, ConfirmDialogComponent],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})

export class HomePageComponent implements OnInit {
  _authService: AuthService;
  domains: any[] = [];
  loadingDomains = false;
  ownerContext = false;
  notice = '';

  showLogoutConfirm = false;

  constructor(
    private authService: AuthService,
    private domainService: DomainService,
    private router: Router,
    private themeService: ThemeService,
  ) {
    this._authService = authService;
  }

  ngOnInit(): void {
    if (!this._authService.isLoggedIn()) {
      return;
    }
    const ctx = this._authService.getContext();
    if (ctx?.principalType === 'OWNER') {
      this.ownerContext = true;
      this.loadUserDomains();
      return;
    }
    this._authService.logout();
    this.ownerContext = false;
    this.notice = 'AdaptiveBP owner portal is restricted to owners. Please login as an owner.';
  }

  requestLogout(): void {
    this.showLogoutConfirm = true;
  }

  cancelLogout(): void {
    this.showLogoutConfirm = false;
  }

  confirmLogout(): void {
    this._authService.logout();
    this.ownerContext = false;
    this.domains = [];
    this.loadingDomains = false;
    this.notice = '';
    this.showLogoutConfirm = false;
    this.router.navigate(['/']);
  }

  loadUserDomains(): void {
    this.loadingDomains = true;
    this.domainService.getMyDomains().subscribe({
      next: (domains) => {
        this.domains = domains;
        this.loadingDomains = false;
      },
      error: (error) => {
        console.error('Error loading domains:', error);
        this.loadingDomains = false;
      }
    });
  }

  navigateToDomain(slug: string): void {
    this.router.navigate(['/domain', slug]);
  }

  get displayName(): string | undefined {
    return this._authService.getContext()?.username || this._authService.getContext()?.email;
  }

  getDomainThemeColor(slug: string): string {
    return this.themeService.getDomainTheme(slug).primary;
  }

  getDomainAccentColor(slug: string): string {
    return this.themeService.getDomainTheme(slug).accent;
  }

  getInitial(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }
}
