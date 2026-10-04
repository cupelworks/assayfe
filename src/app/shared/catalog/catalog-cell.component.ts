import { Component, input } from '@angular/core';
import { CopyIdComponent } from '../copy-id.component';

/** A cell of a catalogue row. On a phone, where the table's headings are gone, it names its
 *  column above what it holds. Given `copyId`, it holds the row's ID to copy (`<assay-copy-id>`) -
 *  an `idColumn()`'s cell, its caption saying whose ID it is. */
@Component({
  selector: 'assay-catalog-cell',
  standalone: true,
  imports: [CopyIdComponent],
  host: { role: 'cell' },
  template: `<span class="cap">{{ caption() }}</span
    ><ng-content />
    @if (copyId(); as id) {
      <assay-copy-id [id]="id" [what]="caption()" />
    }`,
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
  /** The row's ID, shown short and copied whole. */
  copyId = input<string | null>(null);
}
