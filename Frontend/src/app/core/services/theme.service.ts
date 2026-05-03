import { Injectable } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface AppTheme {
  id: string;
  label: string;
  /** Alias for label — backward compat with templates using .name */
  name: string;
  primary: string;
  accent: string;
}

export interface DomainBranding {
  themeId?: string;
  heroLayout?: 'default' | 'compact' | 'minimal';
  logoUrl?: string;
  navStyle?: 'tabs' | 'sidebar';
  cornerRadius?: 'rounded' | 'sharp' | 'pill';
  density?: 'comfortable' | 'compact';
  appCardLayout?: 'grid' | 'list';
  customPrimary?: string;
  customAccent?: string;
  loginMessage?: string;
}

export const THEMES: AppTheme[] = [
  { id: 'midnight', label: 'Midnight',  name: 'Midnight',  primary: '#1a1a2e', accent: '#baff29' },
  { id: 'ocean',    label: 'Ocean',     name: 'Ocean',     primary: '#0c4a6e', accent: '#38bdf8' },
  { id: 'forest',   label: 'Forest',    name: 'Forest',    primary: '#14532d', accent: '#4ade80' },
  { id: 'ember',    label: 'Ember',     name: 'Ember',     primary: '#7f1d1d', accent: '#fb923c' },
  { id: 'violet',   label: 'Violet',    name: 'Violet',    primary: '#3b0764', accent: '#c084fc' },
  { id: 'steel',    label: 'Steel',     name: 'Steel',     primary: '#1e293b', accent: '#94a3b8' },
  { id: 'rose',     label: 'Rose',      name: 'Rose',      primary: '#881337', accent: '#fda4af' },
  { id: 'amber',    label: 'Amber',     name: 'Amber',     primary: '#78350f', accent: '#fcd34d' },
  { id: 'teal',     label: 'Teal',      name: 'Teal',      primary: '#134e4a', accent: '#2dd4bf' },
  { id: 'indigo',   label: 'Indigo',    name: 'Indigo',    primary: '#312e81', accent: '#a5b4fc' },
  { id: 'slate',    label: 'Slate',     name: 'Slate',     primary: '#0f172a', accent: '#cbd5e1' },
  { id: 'plum',     label: 'Plum',      name: 'Plum',      primary: '#4a044e', accent: '#e879f9' },
  { id: 'pine',     label: 'Pine',      name: 'Pine',      primary: '#052e16', accent: '#86efac' },
  { id: 'crimson',  label: 'Crimson',   name: 'Crimson',   primary: '#450a0a', accent: '#fca5a5' },
  { id: 'navy',     label: 'Navy',      name: 'Navy',      primary: '#1e3a5f', accent: '#93c5fd' },
  { id: 'graphite', label: 'Graphite',  name: 'Graphite',  primary: '#374151', accent: '#e5e7eb' },
];

const DEFAULT_THEME = THEMES[0];

@Injectable({ providedIn: 'root' })
export class ThemeService {

  /** All available themes */
  readonly themes = THEMES;

  /**
   * In-memory cache of server-persisted branding per domain slug.
   * This is the single source of truth — NOT localStorage.
   */
  private brandingCache = new Map<string, DomainBranding>();

  /** Get a theme by id, or the default */
  getTheme(id: string): AppTheme {
    return THEMES.find(t => t.id === id) ?? DEFAULT_THEME;
  }

  private appBrandingCache = new Map<string, string>(); // domainSlug:appSlug -> themeId

  // ── Domain theme (server-driven) ──────────────────────────────────────────

  /**
   * Cache branding from the server for a given domain slug.
   * Called by domain-home on load so subsequent lookups are instant.
   */
  cacheBranding(slug: string, branding: DomainBranding): void {
    if (branding) {
      this.brandingCache.set(slug, branding);
    }
  }

  /** Get cached branding for a domain, or null if not yet fetched */
  getCachedBranding(slug: string): DomainBranding | null {
    return this.brandingCache.get(slug) ?? null;
  }

  /**
   * Get the domain theme using the server-cached branding.
   * Falls back to the default theme if branding hasn't been loaded yet.
   */
  getDomainThemeId(slug: string): string {
    const branding = this.brandingCache.get(slug);
    return branding?.themeId || DEFAULT_THEME.id;
  }

  getDomainTheme(slug: string): AppTheme {
    return this.getTheme(this.getDomainThemeId(slug));
  }

  /**
   * @deprecated Use cacheBranding() instead — kept for backward compat.
   * No longer writes to localStorage.
   */
  setDomainTheme(slug: string, themeId: string): void {
    const existing = this.brandingCache.get(slug) || {};
    existing.themeId = themeId;
    this.brandingCache.set(slug, existing);
  }
  // ── App theme ─────────────────────────────────────────────────────────────

  cacheAppTheme(domainSlug: string, appSlug: string, themeId: string): void {
    if (themeId) {
      this.appBrandingCache.set(`${domainSlug}:${appSlug}`, themeId);
    }
  }

  getAppThemeId(domainSlug: string, appSlug: string): string {
    return this.appBrandingCache.get(`${domainSlug}:${appSlug}`) || '';
  }

  getAppTheme(domainSlug: string, appSlug: string): AppTheme {
    const id = this.getAppThemeId(domainSlug, appSlug);
    if (id) return this.getTheme(id);
    return this.getDomainTheme(domainSlug);
  }

  // ── Resolve effective theme color for any app-level page ────────────────

  resolveThemeColor(domainSlug: string, appSlug: string): string {
    return this.getAppTheme(domainSlug, appSlug).primary;
  }

  // ── Branding Application ────────────────────────────────────────────────

  /**
   * Apply branding config as CSS custom properties on the document root.
   * Called when a domain page loads with server-persisted branding.
   */
  applyBranding(branding: DomainBranding | null): void {
    const root = document.documentElement;

    if (!branding) return;

    // Theme colors
    if (branding.themeId) {
      const theme = this.getTheme(branding.themeId);
      root.style.setProperty('--theme-primary', branding.customPrimary || theme.primary);
      root.style.setProperty('--theme-accent', branding.customAccent || theme.accent);
    } else if (branding.customPrimary) {
      root.style.setProperty('--theme-primary', branding.customPrimary);
      if (branding.customAccent) {
        root.style.setProperty('--theme-accent', branding.customAccent);
      }
    }

    // Corner radius — set all three levels
    if (branding.cornerRadius) {
      const map: Record<string, [string, string, string]> = {
        'rounded': ['20px', '14px', '10px'],
        'sharp':   ['6px',  '4px',  '2px'],
        'pill':    ['32px', '24px', '16px'],
      };
      const vals = map[branding.cornerRadius];
      if (vals) {
        root.style.setProperty('--radius-card', vals[0]);
        root.style.setProperty('--radius-card-sm', vals[1]);
        root.style.setProperty('--radius-card-xs', vals[2]);
      }
    }

    // Density — set padding values used by components
    if (branding.density) {
      const isCompact = branding.density === 'compact';
      root.style.setProperty('--density-padding', isCompact ? '0.85rem' : '1.5rem');
      root.style.setProperty('--density-gap', isCompact ? '0.6rem' : '1.25rem');
    }
  }

  /**
   * Clear any branding overrides from the document root.
   */
  clearBranding(): void {
    const root = document.documentElement;
    root.style.removeProperty('--theme-primary');
    root.style.removeProperty('--theme-accent');
    root.style.removeProperty('--radius-card');
    root.style.removeProperty('--density-padding');
  }

  /**
   * Build a default branding object (for reset).
   */
  getDefaultBranding(): DomainBranding {
    return {
      themeId: 'midnight',
      heroLayout: 'default',
      logoUrl: '',
      navStyle: 'tabs',
      cornerRadius: 'rounded',
      density: 'comfortable',
      appCardLayout: 'grid',
      customPrimary: '',
      customAccent: '',
      loginMessage: '',
    };
  }
}
