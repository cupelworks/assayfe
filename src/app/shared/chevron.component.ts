// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input } from '@angular/core';

/**
 * The disclosure chevron beside a collapsible section's label ("Advanced", "Full application
 * reply"): a drawn SVG in the text's own colour, pointing down while closed and turning to point
 * up when open - one shape that rotates, rather than two text glyphs (▸ / ▾) that render small,
 * off the baseline and differently per font. Decorative only (aria-hidden): the control around it
 * carries the state (`aria-expanded`, or a native <details>).
 */
@Component({
  selector: 'assay-chevron',
  standalone: true,
  host: { '[class.open]': 'open()', 'aria-hidden': 'true' },
  template: `<svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M4 6l4 4 4-4" />
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      transition: transform 150ms ease;
    }
    :host(.open) {
      transform: rotate(180deg);
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        transition: none;
      }
    }
    svg {
      display: block;
    }
  `,
})
export class ChevronComponent {
  open = input(false);
}
