import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { DomainService } from '../../../../core/services/domain.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { ModernInputComponent } from '../../../../shared/components/modern-input/modern-input.component';
import { ModernButtonComponent } from '../../../../shared/components/modern-button/modern-button.component';
import { ModernCardComponent } from '../../../../shared/components/modern-card/modern-card.component';

@Component({
  selector: 'app-domain-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ModernInputComponent, ModernButtonComponent, ModernCardComponent],
  templateUrl: './domain-login.component.html',
  styleUrls: ['./domain-login.component.css']
})
export class DomainLoginComponent {
  form: FormGroup;
  loading = false;
  submitted = false;
  error = '';
  loginMessage = '';
  domainName = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private domainService: DomainService,
    private themeService: ThemeService
  ) {
    this.form = this.fb.group({
      domainSlug: ['', Validators.required],
      username: ['', Validators.required],
      password: ['', Validators.required],
    });

    // Pre-fill slug from query params and load branding
    const slugParam = this.route.snapshot.queryParams['slug'];
    if (slugParam) {
      this.form.patchValue({ domainSlug: slugParam });
      this.loadBranding(slugParam);
    }

    // Load branding when slug changes
    this.form.get('domainSlug')?.valueChanges.subscribe(slug => {
      const trimmed = (slug || '').trim().toLowerCase();
      if (trimmed.length >= 2) {
        this.loadBranding(trimmed);
      }
    });
  }

  private loadBranding(slug: string): void {
    this.domainService.getDomainBranding(slug).subscribe({
      next: (b) => {
        this.loginMessage = b?.loginMessage || '';
        this.themeService.applyBranding(b);
      },
      error: () => { /* domain might not exist yet */ }
    });
  }

  get f() {
    return this.form.controls;
  }

  onSubmit() {
    this.submitted = true;
    if (this.form.invalid) {
      return;
    }
    this.loading = true;
    const slug = (this.f['domainSlug'].value || '').trim().toLowerCase();

    this.authService.loginDomain(
      slug,
      this.f['username'].value,
      this.f['password'].value
    ).subscribe({
      next: () => {
        this.loading = false;
        const returnUrl: string | undefined = this.route.snapshot.queryParams['returnUrl'];

        if (returnUrl && returnUrl !== '/') {
          this.router.navigateByUrl(returnUrl);
          return;
        }

        this.router.navigate(['/domain', slug]);
      },
      error: (err: any) => {
        this.error = err?.error ?? 'Login failed';
        this.loading = false;
      }
    });
  }
}
