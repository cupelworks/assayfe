// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input } from '@angular/core';

/** A catalogue tag: small capitals (`plain`), the same boxed - something it needs or is
 *  ("needs setup", "inactive") - or a figure, a value as a row's column shows it ("from 29 times"). */
export interface CatalogTag {
  text: string;
  look?: 'plain' | 'boxed' | 'figure';
}

/** A tag on a catalogue row, and its specimen in the page's key - the same in both places. */
@Component({
  selector: 'assay-catalog-tag',
  standalone: true,
  host: {
    '[class.boxed]': "tag().look === 'boxed'",
    '[class.figure]': "tag().look === 'figure'",
  },
  template: `{{ tag().text }}`,
  styles: `
    :host {
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
      line-height: 1.7;
      text-transform: uppercase;
      color: var(--color-neutral-600);
      white-space: nowrap;
    }
    :host(.boxed) {
      padding: 0 5px;
      box-shadow: inset 0 0 0 1px var(--color-neutral-600);
    }
    :host(.figure) {
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0;
      line-height: 1.5;
      text-transform: none;
      color: var(--color-text);
      font-variant-numeric: tabular-nums;
      white-space: normal;
    }
  `,
})
export class CatalogTagComponent {
  tag = input.required<CatalogTag>();
}
