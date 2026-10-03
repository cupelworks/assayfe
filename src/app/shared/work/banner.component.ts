import { Component, input } from '@angular/core';
import { ActionMessage } from '../action-runner';

/**
 * What the last thing done on a page came to - "Enqueued 2 pending runs." - under its top, ruled
 * in ink at the left; a failure in red. An ActionRunner's `msg`.
 */
@Component({
  selector: 'assay-banner',
  standalone: true,
  template: `@if (msg(); as m) {
    <p class="msg" [class.err]="!m.ok" role="status">{{ m.text }}</p>
  }`,
  styles: `
    :host {
      display: block;
    }
    .msg {
      margin: 0 0 32px;
      padding: 12px 16px;
      border-left: 4px solid var(--color-text);
      background: color-mix(in srgb, var(--color-text) 5%, transparent);
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-text);
      overflow-wrap: anywhere;
    }
    .msg.err {
      border-left-color: var(--color-accent);
      color: var(--color-accent-700);
    }
  `,
})
export class BannerComponent {
  msg = input<ActionMessage | null>(null);
}
