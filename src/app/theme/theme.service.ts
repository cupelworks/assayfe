import { Injectable, computed, effect, signal } from '@angular/core';
export type Theme = 'light' | 'dark' | 'system';
const KEY = 'assay.theme';
@Injectable({ providedIn: 'root' })
export class ThemeService {
  theme = signal<Theme>((localStorage.getItem(KEY) as Theme) ?? 'system');
  private mq = window.matchMedia('(prefers-color-scheme: dark)');
  /** The system's own setting, followed while the theme is `system`. */
  private systemDark = signal(this.mq.matches);
  isDark = computed(() => {
    const t = this.theme();
    return t === 'dark' || (t === 'system' && this.systemDark());
  });
  constructor() {
    effect(() => {
      localStorage.setItem(KEY, this.theme());
      this.apply();
    });
    this.mq.addEventListener('change', () => this.systemDark.set(this.mq.matches));
  }
  private apply() {
    const r = document.documentElement;
    this.isDark() ? r.setAttribute('data-theme', 'dark') : r.removeAttribute('data-theme');
  }
}
