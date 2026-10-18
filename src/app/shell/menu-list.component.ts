// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input, output } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { MenuGroup } from './nav';

/** A page is the one you're on by its path alone - whatever its query or fragment says. */
const ON_ITS_PATH: IsActiveMatchOptions = {
  paths: 'exact',
  queryParams: 'ignored',
  fragment: 'ignored',
  matrixParams: 'ignored',
};

/**
 * A bar menu's pages - Results', Reference's - under their kickers when they have them (Catalog,
 * Guide), each numbered in red with its line, as a guide page's index; the page you're on under a
 * thick red rule, as a catalogue's selected tile. `across` columns in the header's panel - a group
 * each, or a page each when the menu has one group with no kicker; one column in the phone's menu
 * (`stack`). Says `picked` when one is followed, for the menu to close - also when it's the page
 * already open.
 */
@Component({
  selector: 'assay-menu-list',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  host: { '[class.stack]': 'stack()', '[style.--across]': 'across()' },
  template: `
    @for (g of groups(); track $index) {
      <div class="grp" [class.bare]="!g.label">
        @if (g.label) {
          <div class="cap panel-cap">{{ g.label }}</div>
        }
        @for (p of g.pages; track p.path) {
          <a
            class="it panel-item"
            [routerLink]="p.path"
            routerLinkActive="on"
            [routerLinkActiveOptions]="onItsPath"
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
      grid-template-columns: repeat(var(--across, 2), minmax(0, 1fr));
      column-gap: 24px;
      align-items: start;
    }
    /* One group with no kicker: its pages are the columns. */
    :host(:not(.stack)) .bare {
      display: contents;
    }
    :host(.stack) {
      grid-template-columns: minmax(0, 1fr);
      row-gap: 16px;
    }
    /* The kicker and the item's rule are the panels' own (the global .panel-cap, .panel-item). */
    .cap {
      margin-bottom: 12px;
    }
    :host(.stack) .cap {
      margin-bottom: 6px;
    }
    .it {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr);
      row-gap: 4px;
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
export class MenuListComponent {
  groups = input.required<MenuGroup[]>();
  /** Columns in the header's panel. */
  across = input(2);
  /** One column, for the phone's menu. */
  stack = input(false);
  picked = output<void>();
  onItsPath = ON_ITS_PATH;
}
