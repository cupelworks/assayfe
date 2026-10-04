import { Component, input } from '@angular/core';
import { CatalogTag, CatalogTagComponent } from './catalog-tag.component';

/** A line of a catalogue's key: a tag as its rows show it, and what it means. */
export interface CatalogKeyItem {
  tag: CatalogTag;
  text: string;
}

/** What a catalogue's tags mean, under its lede - as Charts' key says what its red line is. */
@Component({
  selector: 'assay-catalog-key',
  standalone: true,
  imports: [CatalogTagComponent],
  template: `
    @for (k of items(); track k.text) {
      <span class="k"><assay-catalog-tag [tag]="k.tag" />{{ k.text }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 32px;
      margin-top: 22px;
      font-size: 13px;
      line-height: 1.5;
      color: var(--color-neutral-800);
    }
    /* On the words' baseline: a tag, a boxed tag and a figure are each a size of their own. */
    .k {
      display: inline-flex;
      align-items: baseline;
      gap: 10px;
    }
  `,
})
export class CatalogKeyComponent {
  items = input.required<CatalogKeyItem[]>();
}
