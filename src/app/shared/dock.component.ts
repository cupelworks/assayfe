import { Component, input } from '@angular/core';

/**
 * A bar held at the bottom of the window while its page scrolls under it (Run with statistics'
 * Start and Cancel): on the left margin what it takes, its first part in bold ("Until there's an
 * answer · at most 750 times …"), and under it, in red, what's left to fix before it can go; on
 * the right one the page's buttons (its content - the page styles them). On a phone, one under
 * the other.
 */
@Component({
  selector: 'assay-dock',
  standalone: true,
  host: { role: 'region', '[attr.aria-label]': 'label()' },
  template: `
    <span class="sum"
      ><b>{{ head() }}</b
      >{{ rest() ? ' · ' + rest() : '' }}</span
    >
    @if (fix().length; as n) {
      <span class="fix" role="status"
        ><b>{{ n }} {{ n === 1 ? 'thing' : 'things' }} to fix:</b> {{ fix().join(' · ') }}</span
      >
    }
    <span class="acts"><ng-content /></span>
  `,
  styles: `
    :host {
      position: sticky;
      bottom: 0;
      z-index: 5;
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      column-gap: 24px;
      row-gap: 6px;
      align-items: center;
      padding: 14px 40px;
      background: var(--color-bg);
      border-top: 2px solid var(--color-text);
    }
    .sum {
      grid-column: 1 / 9;
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-neutral-800);
    }
    .sum b {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.01em;
      color: var(--color-text);
    }
    .fix {
      grid-column: 1 / 9;
      font-size: 13px;
      line-height: 1.45;
      color: var(--color-accent);
    }
    .acts {
      grid-column: 9 / -1;
      grid-row: 1;
      justify-self: end;
      display: flex;
      align-items: center;
      gap: 24px;
    }
    @media (max-width: 960px) {
      :host {
        grid-template-columns: minmax(0, 1fr);
        padding: 12px 16px;
      }
      .sum,
      .fix,
      .acts {
        grid-column: 1 / -1;
        grid-row: auto;
        justify-self: start;
      }
    }
  `,
})
export class DockComponent {
  /** What the bar is for, to a screen reader: "Start the batch". */
  label = input.required<string>();
  /** What it takes: its first part, in bold, then the rest. */
  head = input.required<string>();
  rest = input('');
  /** What's left to fix before it can go, a sentence each. */
  fix = input<readonly string[]>([]);
}
