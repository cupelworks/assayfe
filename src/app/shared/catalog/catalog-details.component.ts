import { Component } from '@angular/core';

/** An open catalogue row's details: under its cells, across every column but the name's, below a
 *  hairline. What it holds is the page's, laid out with `catalog.css`. */
@Component({
  selector: 'assay-catalog-details',
  standalone: true,
  host: { role: 'cell' },
  template: `<ng-content />`,
  styles: `
    :host {
      grid-column: 2 / -1;
      display: block;
      min-width: 0;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid color-mix(in srgb, var(--color-text) 14%, transparent);
      font-size: 13px;
      line-height: 1.5;
      color: var(--color-neutral-900);
    }
    @media (max-width: 960px) {
      :host {
        grid-column: 1 / -1;
        margin-top: 8px;
      }
    }
  `,
})
export class CatalogDetailsComponent {}
