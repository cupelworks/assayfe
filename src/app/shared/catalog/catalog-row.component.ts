import { Component, input, output } from '@angular/core';
import { CatalogTag, CatalogTagComponent } from './catalog-tag.component';

/**
 * A row of a catalogue table: its name, its tags and "More ↓" / "Less ↑" in the first column, the
 * cells given to it (`<assay-catalog-cell>`) in the rest, on the table's columns, and - once open -
 * its details under them (`<assay-catalog-details>`, which the page adds while `open`). Open, its
 * red rule takes the place of the rule above it (the row before's, or the headings'), so only the
 * red one shows. Which row is open is the page's (`OpenOne`): the row asks with `toggle`.
 */
@Component({
  selector: 'assay-catalog-row',
  standalone: true,
  imports: [CatalogTagComponent],
  host: { role: 'row', '[class.open]': 'open()', '[class.faded]': 'faded()' },
  template: `
    <div class="name" role="cell">
      <span class="nm">{{ name() }}</span>
      @if (tags().length) {
        <span class="tags">
          @for (t of tags(); track t.text) {
            <assay-catalog-tag [tag]="t" />
          }
        </span>
      }
      <button type="button" class="more" [attr.aria-expanded]="open()" (click)="toggle.emit()">
        {{ open() ? 'Less ↑' : 'More ↓' }}
      </button>
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
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 8px;
      margin-top: 8px;
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
  tags = input<CatalogTag[]>([]);
  open = input(false);
  /** Kept for history but not offered (an inactive test type). */
  faded = input(false);
  toggle = output<void>();
}
