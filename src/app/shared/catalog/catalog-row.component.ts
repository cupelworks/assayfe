import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogTag, CatalogTagComponent } from './catalog-tag.component';
import { Selection } from '../selection';
import { StatusMarkComponent } from '../status-mark.component';

/**
 * A row of a catalogue table: its name (a link, when it leads somewhere), its tags, a note and
 * "More ↓" / "Less ↑" in the first column, the cells given to it (`<assay-catalog-cell>`) in the
 * rest, on the table's columns, and - once open - its details under them
 * (`<assay-catalog-details>`, which the page adds while `open`). Open, its
 * red rule takes the place of the rule above it (the row before's, or the headings'), so only the
 * red one shows. Which row is open is the page's (`OpenOne`): the row asks with `toggle`. Given
 * the table's `selection` and its own `rowId`, a checkbox leads it, and ticked it is shaded.
 */
@Component({
  selector: 'assay-catalog-row',
  standalone: true,
  imports: [CatalogTagComponent, RouterLink, StatusMarkComponent],
  host: {
    role: 'row',
    '[class.open]': 'open()',
    '[class.faded]': 'faded()',
    '[class.selectable]': '!!selection()',
    '[class.sel]': 'ticked()',
  },
  template: `
    @if (selection(); as sel) {
      <span class="chkc" role="cell"
        ><input
          type="checkbox"
          class="chk"
          [attr.aria-label]="'Select ' + name()"
          [checked]="ticked()"
          (change)="sel.toggle(rowId())"
      /></span>
    }
    <div class="name" role="cell">
      <span class="nmw">
        @if (mark(); as m) {
          <assay-mark [of]="m" />
        }
        @if (link(); as l) {
          <a class="nm" [routerLink]="l">{{ name() }}</a>
        } @else {
          <span class="nm">{{ name() }}</span>
        }
      </span>
      @if (tags().length) {
        <span class="tags">
          @for (t of tags(); track t.text) {
            <assay-catalog-tag [tag]="t" />
          }
        </span>
      }
      @if (note(); as n) {
        <span class="note">“{{ n }}”</span>
      }
      @if (expandable()) {
        <button type="button" class="more" [attr.aria-expanded]="open()" (click)="toggle.emit()">
          {{ open() ? 'Less ↑' : 'More ↓' }}
        </button>
      }
    </div>
    <ng-content />
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: var(--catalog-cols);
      column-gap: 24px;
      padding: 18px 0 20px;
      border-bottom: 1px solid color-mix(in srgb, var(--color-text) 25%, transparent);
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-neutral-900);
    }
    :host(.open) {
      margin-top: -1px;
      padding-top: 17px;
      border-top: 2px solid var(--color-accent);
    }
    :host(.faded) {
      opacity: 0.55;
    }
    :host(.sel) {
      background: color-mix(in srgb, var(--color-text) 5%, transparent);
    }
    .chk {
      width: 16px;
      height: 16px;
      margin: 3px 0 0;
      accent-color: var(--color-accent);
      cursor: pointer;
    }
    .name {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      min-width: 0;
    }
    /* A status's mark before the name, when the name is one ("■ Amber"). */
    .nmw {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      max-width: 100%;
    }
    .nm {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.01em;
      line-height: 1.25;
      color: var(--color-text);
      overflow-wrap: anywhere;
    }
    a.nm {
      text-decoration: none;
    }
    a.nm:hover {
      color: var(--color-accent);
    }
    a.nm:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 8px;
      margin-top: 8px;
    }
    .note {
      margin-top: 6px;
      font-size: 13px;
      line-height: 1.45;
      color: var(--color-neutral-600);
      overflow-wrap: anywhere;
    }
    .more {
      all: unset;
      margin-top: 10px;
      padding: 2px 0;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-accent);
      cursor: pointer;
    }
    .more:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 3px;
    }
    @media (max-width: 960px) {
      :host {
        grid-template-columns: minmax(0, 1fr);
        row-gap: 12px;
      }
      /* Ticked from the left, as on a wide screen: the checkbox keeps its column, the rest stacks
         beside it. */
      :host(.selectable) {
        grid-template-columns: 28px minmax(0, 1fr);
      }
      :host(.selectable) > :not(.chkc) {
        grid-column: 2;
      }
      :host(.selectable) > .chkc {
        grid-row: 1 / span 20;
      }
    }
  `,
})
export class CatalogRowComponent {
  name = input.required<string>();
  /** A status's mark before the name, when the name is a status (a run's: "Amber"). */
  mark = input<string | null>(null);
  /** Where the name leads (the Overview's rows: a batch, an execution, a comparison); none: text. */
  link = input<unknown[] | null>(null);
  tags = input<CatalogTag[]>([]);
  /** A note the user wrote, quoted under the tags (a batch's). */
  note = input<string | null>(null);
  /** Offers "More ↓" / "Less ↑" - a row with nothing more to show leaves it out. */
  expandable = input(true);
  open = input(false);
  /** Kept for history but not offered (an inactive test type). */
  faded = input(false);
  /** The table's ticked rows, when rows can be ticked; this row is `rowId` in it. */
  selection = input<Selection | null>(null);
  rowId = input('');
  ticked = computed(() => !!this.selection()?.has(this.rowId()));
  toggle = output<void>();
}
