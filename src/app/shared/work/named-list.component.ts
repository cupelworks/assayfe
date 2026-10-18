// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input } from '@angular/core';

/** A thing a dialog acts on: its name, and a note at the right ("in 2 test sets · has runs"). */
export interface NamedItem {
  name: string;
  note?: string;
}

/**
 * What a dialog acts on, named - never just a count: a ruled list under a small caption
 * ("Deleted", "Kept - their runs need them"), each name with its note. `kept` greys the names: the
 * ones the action leaves as they are.
 */
@Component({
  selector: 'assay-named-list',
  standalone: true,
  host: { '[class.kept]': 'kept()' },
  template: `
    @if (caption(); as c) {
      <span class="cap">{{ c }}</span>
    }
    <ul>
      @for (i of items(); track $index) {
        <li>
          <b>{{ i.name }}</b>
          @if (i.note) {
            <span>{{ i.note }}</span>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }
    .cap {
      display: block;
      margin-bottom: 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
      border-top: 1px solid var(--color-text);
    }
    li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      column-gap: 16px;
      align-items: baseline;
      padding: 10px 0;
      border-bottom: 1px solid color-mix(in srgb, var(--color-text) 25%, transparent);
      font-size: 14px;
    }
    b {
      font-weight: 700;
      color: var(--color-text);
      overflow-wrap: anywhere;
    }
    :host(.kept) b {
      font-weight: 400;
      color: var(--color-neutral-600);
    }
    li span {
      font-size: 12px;
      color: var(--color-neutral-600);
      white-space: nowrap;
    }
  `,
})
export class NamedListComponent {
  caption = input<string | null>(null);
  items = input.required<NamedItem[]>();
  kept = input(false);
}
