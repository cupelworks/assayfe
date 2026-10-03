import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogTag, CatalogTagComponent } from './catalog-tag.component';

/**
 * A row of a catalogue table: its name (a link, when it leads somewhere), its tags, a note and
 * "More ↓" / "Less ↑" in the first column, the cells given to it (`<assay-catalog-cell>`) in the
 * rest, on the table's columns, and - once open - its details under them
 * (`<assay-catalog-details>`, which the page adds while `open`). Open, its
 * red rule takes the place of the rule above it (the row before's, or the headings'), so only the
 * red one shows. Which row is open is the page's (`OpenOne`): the row asks with `toggle`.
 */
@Component({
  selector: 'assay-catalog-row',
  standalone: true,
  imports: [CatalogTagComponent, RouterLink],
  host: { role: 'row', '[class.open]': 'open()', '[class.faded]': 'faded()' },
  template: `
    <div class="name" role="cell">
      @if (link(); as l) {
        <a class="nm" [routerLink]="l">{{ name() }}</a>
      } @else {
        <span class="nm">{{ name() }}</span>
      }
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
    .name {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      min-width: 0;
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
    }
  `,
})
export class CatalogRowComponent {
  name = input.required<string>();
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
  toggle = output<void>();
}
