import { Component, input } from '@angular/core';

/** A cell of a catalogue row. On a phone, where the table's headings are gone, it names its
 *  column above what it holds. */
@Component({
  selector: 'assay-catalog-cell',
  standalone: true,
  host: { role: 'cell' },
  template: `<span class="cap">{{ caption() }}</span
    ><ng-content />`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .cap {
      display: none;
      margin-bottom: 2px;
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    @media (max-width: 960px) {
      .cap {
        display: block;
      }
    }
  `,
})
export class CatalogCellComponent {
  /** Its column's heading. */
  caption = input.required<string>();
}
