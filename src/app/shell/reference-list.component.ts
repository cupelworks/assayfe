import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { REFERENCE } from './nav';

/**
 * Reference's pages, under their kickers - Catalog, Guide - each numbered in red with its line,
 * as a guide page's index; the page you're on under a thick red rule, as a catalogue's selected
 * tile. Two columns in the header's panel, one in the phone's menu (`stack`). Says `picked` when
 * one is followed, for the menu to close - also when it's the page already open.
 */
@Component({
  selector: 'assay-reference-list',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  host: { '[class.stack]': 'stack()' },
  template: `
    @for (g of groups; track g.label) {
      <div class="grp">
        <div class="cap">{{ g.label }}</div>
        @for (p of g.pages; track p.path) {
          <a
            class="it"
            [routerLink]="p.path"
            routerLinkActive="on"
            ariaCurrentWhenActive="page"
            (click)="picked.emit()"
            ><b>{{ p.no }}</b
            ><span class="lb">{{ p.label }}</span
            ><span class="ds">{{ p.blurb }}</span></a
          >
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 24px;
      align-items: start;
    }
    :host(.stack) {
      grid-template-columns: minmax(0, 1fr);
      row-gap: 16px;
    }
    .cap {
      margin-bottom: 12px;
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-accent);
    }
    :host(.stack) .cap {
      margin-bottom: 6px;
    }
    .it {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr);
      row-gap: 4px;
      padding: 12px 0 16px;
      border-top: 1px solid var(--color-divider);
      color: var(--color-text);
      text-decoration: none;
    }
    .it b {
      font-size: 15px;
      font-weight: 800;
      color: var(--color-accent);
      font-variant-numeric: tabular-nums;
    }
    .lb {
      font-size: 15px;
      font-weight: 600;
    }
    .ds {
      grid-column: 2;
      font-size: 13px;
      line-height: 1.45;
      color: var(--color-neutral-600);
    }
    .it:hover .lb {
      color: var(--color-accent);
    }
    .it.on {
      padding-top: 9px;
      border-top: 4px solid var(--color-accent);
    }
    .it:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  `,
})
export class ReferenceListComponent {
  groups = REFERENCE;
  /** One column, for the phone's menu. */
  stack = input(false);
  picked = output<void>();
}
