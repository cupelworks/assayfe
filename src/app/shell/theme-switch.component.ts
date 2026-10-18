// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, inject } from '@angular/core';
import { ThemeService } from '../theme/theme.service';

/** The theme's two modes, in small capitals: the one in use in ink, the other to choose - in the
 *  header's bar and at the foot of the phone's menu. */
@Component({
  selector: 'assay-theme-switch',
  standalone: true,
  host: { class: 'small-caps', role: 'group', 'aria-label': 'Theme' },
  template: `
    <button
      type="button"
      [class.on]="!theme.isDark()"
      [attr.aria-pressed]="!theme.isDark()"
      (click)="theme.theme.set('light')"
    >
      Light
    </button>
    <button
      type="button"
      [class.on]="theme.isDark()"
      [attr.aria-pressed]="theme.isDark()"
      (click)="theme.theme.set('dark')"
    >
      Dark
    </button>
  `,
  styles: `
    /* On the bar's baseline: an 11 px capital starts 6 px down (shell/bar.css). */
    :host {
      display: flex;
      align-items: center;
      padding-top: 6px;
    }
    button {
      all: unset;
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      color: var(--color-neutral-600);
      cursor: pointer;
    }
    button + button::before {
      content: '·';
      margin: 0 8px;
      color: var(--color-neutral-500);
    }
    button:hover {
      color: var(--color-accent);
    }
    button.on {
      color: var(--color-text);
    }
    button:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  `,
})
export class ThemeSwitchComponent {
  theme = inject(ThemeService);
}
