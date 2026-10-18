// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input } from '@angular/core';

/** How a state stands: all good, something to do, or couldn't tell. */
export type StatusTone = 'ok' | 'warn' | 'unknown';

/**
 * A state in words, coloured by how it stands: a square and a title in green (all good), amber
 * (something to do) or grey (couldn't tell), and a line under the title - as the Overview says,
 * beside its title, whether runs can start. The square stands on the title's line, right before
 * the title, and the lines follow the alignment of where it's set: flush right, each line ends on
 * the margin; flush left, the square hangs before the title and the line under it starts where the
 * title does.
 */
@Component({
  selector: 'assay-status-line',
  standalone: true,
  host: {
    role: 'status',
    '[class.warn]': "tone() === 'warn'",
    '[class.unknown]': "tone() === 'unknown'",
  },
  template: `<span class="title"><i aria-hidden="true"></i>{{ title() }}</span
    ><span class="text">{{ text() }}</span>`,
  styles: `
    /* A hanging indent as wide as the square and its gap: the title's line starts in it. */
    :host {
      --tone: var(--color-status-green);
      display: block;
      padding-left: 24px;
    }
    :host(.warn) {
      --tone: var(--color-status-amber);
    }
    :host(.unknown) {
      --tone: var(--color-neutral-600);
    }
    .title {
      display: block;
      text-indent: -24px;
      font-size: 21px;
      font-weight: 800;
      letter-spacing: -0.01em;
      line-height: 1.4;
      color: var(--tone);
    }
    /* Standing on the title's baseline. */
    i {
      display: inline-block;
      width: 12px;
      height: 12px;
      margin-right: 12px;
      background: var(--tone);
    }
    .text {
      display: block;
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-neutral-800);
      text-wrap: pretty;
    }
  `,
})
export class StatusLineComponent {
  tone = input<StatusTone>('ok');
  title = input.required<string>();
  text = input('');
}
