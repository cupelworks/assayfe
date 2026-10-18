// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component } from '@angular/core';

/**
 * The arrow after a button's label when it opens a new tab ("Run with statistics ↗"): a drawn
 * north-east arrow in the text's own colour, in place of the "…" a button that asks for more
 * carries - one typographic sign rather than an icon. It leans out a little while the button is
 * hovered or focused (`.new-tab` in styles.css, which also shows "Opens in a new tab" under the
 * button). Decorative only (aria-hidden): the link's aria-label says it opens a new tab.
 */
@Component({
  selector: 'assay-arrow-out',
  standalone: true,
  host: { 'aria-hidden': 'true' },
  template: `<svg
    viewBox="0 0 12 12"
    width="11"
    height="11"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="square"
  >
    <path d="M2.5 9.5L9.5 2.5" />
    <path d="M4 2.5H9.5V8" />
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      transition: transform 150ms ease;
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
export class ArrowOutComponent {}
