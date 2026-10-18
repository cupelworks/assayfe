// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input, model } from '@angular/core';

/**
 * A catalogue's filter, under its index, on the 12-column grid: the search across columns 1-6 - a
 * line, not a box - then at the right what the page adds (Test types' "Show inactive"), how many
 * rows are shown, and what the page adds after that (its Refresh, marked `catalogFilterEnd`). The
 * query is two-way (`[(query)]`, a `TextFilter`'s).
 */
@Component({
  selector: 'assay-catalog-filter',
  standalone: true,
  template: `
    <label class="find">
      <span class="cap">Filter</span>
      <input
        type="text"
        [placeholder]="placeholder()"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
      />
    </label>
    <div class="side">
      <ng-content />
      <span class="shown">{{ shown() }} shown</span>
      <ng-content select="[catalogFilterEnd]" />
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      column-gap: 24px;
      align-items: end;
      padding-top: 28px;
      border-top: 1px solid color-mix(in srgb, var(--color-text) 14%, transparent);
    }
    .find {
      grid-column: 1 / 7;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .cap {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    /* A line, not a box - with the text cursor a field shows, which all: unset takes away. */
    input {
      all: unset;
      box-sizing: border-box;
      width: 100%;
      cursor: text;
      padding: 8px 0 9px;
      border-bottom: 1px solid var(--color-divider);
      font-family: inherit;
      font-size: 17px;
      color: var(--color-text);
    }
    input::placeholder {
      color: var(--color-neutral-500);
    }
    input:focus {
      padding-bottom: 8px;
      border-bottom: 2px solid var(--color-accent);
    }
    .side {
      grid-column: 7 / -1;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 32px;
      min-height: 44px;
      font-size: 13px;
    }
    .shown {
      color: var(--color-neutral-600);
      font-variant-numeric: tabular-nums;
    }
    @media (max-width: 960px) {
      .find,
      .side {
        grid-column: 1 / -1;
      }
      .side {
        justify-content: flex-start;
        flex-wrap: wrap;
        gap: 0 24px;
      }
    }
  `,
})
export class CatalogFilterComponent {
  query = model('');
  placeholder = input('');
  /** How many rows the filter leaves. */
  shown = input.required<number>();
}
