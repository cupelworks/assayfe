import { Component, computed, input } from '@angular/core';

/** A column of a catalogue table: its heading, and its share of the width (`fr`). */
export interface CatalogColumn {
  label: string;
  width: number;
}

/**
 * A catalogue's ruled table, across a section's body, as the Guide's tables are: the headings over
 * a black rule, then the rows given to it (`<assay-catalog-row>`), which take its columns
 * (`--catalog-cols`) - or, when it has none, what `empty` says. On a phone the headings go, and
 * each cell names its column itself.
 */
@Component({
  selector: 'assay-catalog-table',
  standalone: true,
  host: {
    role: 'table',
    '[attr.aria-label]': 'label()',
    '[style.--catalog-cols]': 'cols()',
  },
  template: `
    <div class="h" role="row">
      @for (c of columns(); track c.label) {
        <span role="columnheader">{{ c.label }}</span>
      }
    </div>
    <ng-content />
    @if (empty(); as text) {
      <p class="empty">{{ text }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
      grid-column: 1 / -1;
      min-width: 0;
    }
    .h {
      display: grid;
      grid-template-columns: var(--catalog-cols);
      column-gap: 24px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--color-text);
    }
    .h span {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    .empty {
      margin: 0;
      padding: 18px 0;
      border-bottom: 1px solid color-mix(in srgb, var(--color-text) 25%, transparent);
      font-size: 14px;
      color: var(--color-neutral-600);
    }
    @media (max-width: 960px) {
      .h {
        display: none;
      }
    }
  `,
})
export class CatalogTableComponent {
  label = input.required<string>();
  columns = input.required<CatalogColumn[]>();
  /** What the table says when it has no rows. */
  empty = input<string | null>(null);
  cols = computed(() =>
    this.columns()
      .map((c) => `minmax(0, ${c.width}fr)`)
      .join(' '),
  );
}
