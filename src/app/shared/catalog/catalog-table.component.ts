import { Component, computed, input } from '@angular/core';
import { Selection } from '../selection';

/** A column of a catalogue table: its heading, and its share of the width (`fr`). */
export interface CatalogColumn {
  label: string;
  width: number;
}
/** The column of a row's ID, after its data and before its own action ("Remove"); its cells are
 *  `<assay-catalog-cell [copyId]>`. "ID" when the row is the thing it names; whose when it's named
 *  after something else - "Entry ID" (a set's copy of a test), "Run ID", "Batch ID". */
export const idColumn = (label = 'ID'): CatalogColumn => ({ label, width: 1 });

/**
 * A catalogue's ruled table, across a section's body, as the Guide's tables are: the headings over
 * a black rule, then the rows given to it (`<assay-catalog-row>`), which take its columns
 * (`--catalog-cols`) - or, when it has none, what `empty` says. On a phone the headings go, and
 * each cell names its column itself. Given a `selection`, a column of checkboxes leads it - the
 * heading's ticks every row shown, each row's its own (the row takes the same `selection`).
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
      @if (selection(); as sel) {
        <span class="chkc" role="columnheader"
          ><input
            type="checkbox"
            class="chk"
            [attr.aria-label]="selectAll()"
            [checked]="sel.allChecked()"
            (change)="sel.toggleAll()"
        /></span>
      }
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
    .chk {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--color-accent);
      cursor: pointer;
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
  /** The ticked rows, when rows can be ticked - see shared/selection.ts. */
  selection = input<Selection | null>(null);
  /** The heading checkbox's label: "Select every test shown". */
  selectAll = input('Select every one shown');
  cols = computed(
    () =>
      (this.selection() ? '28px ' : '') +
      this.columns()
        .map((c) => `minmax(0, ${c.width}fr)`)
        .join(' '),
  );
}
