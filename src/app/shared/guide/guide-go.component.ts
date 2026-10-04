import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * A link on to another page, in red: "Test types →", "All runs →" - one under the other when there
 * are two, and across a section's body when it ends one. With no link yet (a page still to come:
 * "All batches →") it reads and looks the same, and does nothing.
 */
@Component({
  selector: 'assay-guide-go',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (link(); as l) {
      <a class="go" [routerLink]="l" [queryParams]="query()">{{ label() }} →</a>
    } @else {
      <button type="button" class="go">{{ label() }} →</button>
    }
  `,
  styles: `
    :host {
      display: block;
      grid-column: 1 / -1;
    }
    .go {
      display: flex;
      width: fit-content;
      margin-top: 12px;
      padding: 0;
      border: 0;
      background: none;
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      line-height: inherit;
      color: var(--color-accent);
      text-decoration: none;
      cursor: pointer;
    }
    .go:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .go:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  `,
})
export class GuideGoComponent {
  /** The page it leads to, without the arrow: "Test types". */
  label = input.required<string>();
  /** Router commands; null while that page isn't built. */
  link = input<unknown[] | string | null>(null);
  query = input<Record<string, string> | null>(null);
}
