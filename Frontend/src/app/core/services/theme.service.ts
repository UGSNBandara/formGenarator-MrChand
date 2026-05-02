import { Injectable } from '@angular/core';

export interface AppTheme {
  id: string;
  label: string;
  /** Alias for label — backward compat with templates using .name */
  name: string;
  primary: string;
  accent: string;
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

  /** Get a theme by id, or the default */
  getTheme(id: string): AppTheme {
    return THEMES.find(t => t.id === id) ?? DEFAULT_THEME;
  }

  // ── Domain theme ──────────────────────────────────────────────────────────

  getDomainThemeId(slug: string): string {
    return localStorage.getItem(`dt-${slug}`) || DEFAULT_THEME.id;
  }

  getDomainTheme(slug: string): AppTheme {
    return this.getTheme(this.getDomainThemeId(slug));
  }

  setDomainTheme(slug: string, themeId: string): void {
    localStorage.setItem(`dt-${slug}`, themeId);
  }

  // ── App theme ─────────────────────────────────────────────────────────────

  getAppThemeId(domainSlug: string, appSlug: string): string {
    return localStorage.getItem(`at-${domainSlug}-${appSlug}`) || '';
  }

  getAppTheme(domainSlug: string, appSlug: string): AppTheme {
    const id = this.getAppThemeId(domainSlug, appSlug);
    if (id) return this.getTheme(id);
    return this.getDomainTheme(domainSlug);
  }

  setAppTheme(domainSlug: string, appSlug: string, themeId: string): void {
    localStorage.setItem(`at-${domainSlug}-${appSlug}`, themeId);
  }

  // ── Resolve effective theme color for any app-level page ────────────────

  resolveThemeColor(domainSlug: string, appSlug: string): string {
    return this.getAppTheme(domainSlug, appSlug).primary;
  }
}
