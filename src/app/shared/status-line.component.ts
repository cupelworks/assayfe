import { Component, input } from '@angular/core';

/** How a state stands: all good, something to do, or couldn't tell. */
export type StatusTone = 'ok' | 'warn' | 'unknown';

/**
 * A state in words, coloured by how it stands: a square and a title in green (all good), amber
 * (something to do) or grey (couldn't tell), and a line under the title - as the Overview says,
 * beside its title, whether runs can start.
 */
@Component({
  selector: 'assay-status-line',
  standalone: true,
  host: {
    role: 'status',
    '[class.warn]': "tone() === 'warn'",
    '[class.unknown]': "tone() === 'unknown'",
  },
  template: `<i aria-hidden="true"></i><span class="title">{{ title() }}</span
    ><span class="text">{{ text() }}</span>`,
  styles: `
    :host {
      --tone: var(--color-status-green);
      display: grid;
      grid-template-columns: 12px minmax(0, 1fr);
      column-gap: 12px;
    }
    :host(.warn) {
      --tone: var(--color-status-amber);
    }
    :host(.unknown) {
      --tone: var(--color-neutral-600);
    }
    i {
      grid-column: 1;
      grid-row: 1;
      width: 12px;
      height: 12px;
      margin-top: 9px;
      background: var(--tone);
    }
    .title {
      grid-column: 2;
      font-size: 21px;
      font-weight: 800;
      letter-spacing: -0.01em;
      line-height: 1.4;
      color: var(--tone);
    }
    .text {
      grid-column: 2;
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
