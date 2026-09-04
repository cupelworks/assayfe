import { Injectable, signal, effect } from '@angular/core';
export type Theme = 'light' | 'dark' | 'system';
const KEY = 'assay.theme';
@Injectable({ providedIn: 'root' })
export class ThemeService {
  theme = signal<Theme>((localStorage.getItem(KEY) as Theme) ?? 'system');
  private mq = window.matchMedia('(prefers-color-scheme: dark)');
  constructor() { effect(() => { localStorage.setItem(KEY, this.theme()); this.apply(); }); this.mq.addEventListener('change', () => this.apply()); }
  isDark() { const t = this.theme(); return t === 'dark' || (t === 'system' && this.mq.matches); }
  toggle() { this.theme.set(this.isDark() ? 'light' : 'dark'); }
  private apply() { const r = document.documentElement; this.isDark() ? r.setAttribute('data-theme', 'dark') : r.removeAttribute('data-theme'); }
}
