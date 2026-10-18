// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input, output, computed } from '@angular/core';
/** Offset/limit pager matching the API's `?offset&limit` + `total` contract: where you are
 *  ("1–10 of 62"), the way on in red words ("← Previous", "Next →") and how many a page. */
@Component({
  selector: 'assay-pager',
  standalone: true,
  template: ` @if (total() > 0) {
    <nav class="pager" aria-label="Pages">
      <span class="at">{{ label() }}</span>
      <button
        type="button"
        class="pg"
        (click)="offsetChange.emit(Math.max(0, offset() - limit()))"
        [disabled]="offset() === 0"
      >
        ← Previous
      </button>
      <button
        type="button"
        class="pg"
        (click)="offsetChange.emit(offset() + limit())"
        [disabled]="offset() + limit() >= total()"
      >
        Next →
      </button>
      <label class="ps"
        ><select
          aria-label="How many a page"
          (change)="limitChange.emit(+$any($event.target).value)"
        >
          @for (n of sizes; track n) {
            <option [value]="n" [selected]="n === limit()">{{ n }} a page</option>
          }
        </select></label
      >
    </nav>
  }`,
  styles: [
    `
      .pager {
        display: flex;
        flex-wrap: wrap;
        gap: 0 24px;
        align-items: center;
        justify-content: flex-end;
        margin-top: 8px;
        font-size: 13px;
      }
      .at {
        color: var(--color-neutral-600);
        font-variant-numeric: tabular-nums;
      }
      .pg {
        all: unset;
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        font-weight: 700;
        color: var(--color-accent);
        cursor: pointer;
      }
      .pg:hover:not(:disabled) {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .pg:disabled {
        color: var(--color-neutral-500);
        cursor: default;
      }
      .pg:focus-visible,
      select:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
      }
      /* How many a page: a select that reads as words, with its own small arrow. */
      select {
        appearance: none;
        min-height: 44px;
        padding: 0 16px 0 0;
        border: 0;
        background: transparent
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M1.5 3.5 5 7l3.5-3.5' fill='none' stroke='%237d7979' stroke-width='1.6'/%3E%3C/svg%3E")
          right center / 9px no-repeat;
        font: inherit;
        color: var(--color-neutral-800);
        cursor: pointer;
      }
    `,
  ],
})
export class PagerComponent {
  total = input.required<number>();
  offset = input.required<number>();
  limit = input.required<number>();
  offsetChange = output<number>();
  limitChange = output<number>();
  sizes = [5, 10, 25, 50];
  Math = Math;
  label = computed(
    () =>
      `${this.offset() + 1}–${Math.min(this.offset() + this.limit(), this.total())} of ${this.total()}`,
  );
}
