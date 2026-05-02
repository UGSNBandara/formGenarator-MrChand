import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter, catchError } from 'rxjs/operators';
import { Subscription, of } from 'rxjs';
import { DomainService } from '../../../core/services/domain.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-global-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './global-nav.component.html',
  styleUrls: ['./global-nav.component.css'],
})
export class GlobalNavComponent implements OnInit, OnDestroy {
  isHome = true;
  domainName = '';
  domainSlug = '';
  appName = '';
  appSlug = '';
  themeColor = '';

  private routerSub!: Subscription;

  constructor(
    private router: Router,
    private domainService: DomainService,
    private themeService: ThemeService
  ) {}

  ngOnInit() {
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.parseUrl(event.urlAfterRedirects);
    });
    this.parseUrl(this.router.url);
  }

  ngOnDestroy() {
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
  }

  private parseUrl(url: string) {
    const path = url.split('?')[0].split('#')[0];
    const segments = path.split('/').filter(s => s.length > 0);
    
    this.isHome = segments.length === 0 || path.includes('/auth');

    if (segments[0] === 'domain' && segments.length > 1 && segments[1] !== 'create') {
      const newDomainSlug = segments[1];
      
      // Update domain info if changed
      if (newDomainSlug !== this.domainSlug) {
        this.domainSlug = newDomainSlug;
        this.domainName = this.domainSlug; // fallback
        this.domainService.getBySlug(this.domainSlug).pipe(
          catchError(() => of(null))
        ).subscribe(d => {
          if (d) this.domainName = d.name;
        });
      }
      
      // Check for app
      if (segments.length > 3 && segments[2] === 'app') {
        const newAppSlug = segments[3];
        
        if (newAppSlug !== this.appSlug) {
          this.appSlug = newAppSlug;
          this.appName = this.appSlug; // fallback
          this.domainService.getApplication(this.domainSlug, this.appSlug).pipe(
            catchError(() => of(null))
          ).subscribe(a => {
            if (a) this.appName = a.name;
          });
        }
        this.themeColor = this.themeService.resolveThemeColor(this.domainSlug, this.appSlug);
      } else {
        this.appSlug = '';
        this.appName = '';
        this.themeColor = this.themeService.getDomainTheme(this.domainSlug).primary;
      }
    } else {
      this.domainSlug = '';
      this.domainName = '';
      this.appSlug = '';
      this.appName = '';
      this.themeColor = '';
    }
  }
}
