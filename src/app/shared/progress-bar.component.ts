import { Component, input } from '@angular/core';

/**
 * How far something has got, as a bar: the share done in the text's colour over a light track -
 * a running batch's times on its page, in its test's, set's or plan's statistics and on the
 * Overview. It takes the width it's given; the page sets any margin or maximum width.
 */
@Component({
  selector: 'assay-progress-bar',
  standalone: true,
  host: {
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    '[attr.aria-valuenow]': 'pct()',
  },
  template: `<i [style.width.%]="pct()"></i>`,
  styles: `
    :host {
      display: block;
      position: relative;
      height: 6px;
      background: color-mix(in srgb, var(--color-text) 12%, transparent);
    }
    i {
      position: absolute;
      inset: 0 auto 0 0;
      background: var(--color-text);
    }
  `,
})
export class ProgressBarComponent {
  /** The share done, 0-100. */
  pct = input.required<number>();
}
