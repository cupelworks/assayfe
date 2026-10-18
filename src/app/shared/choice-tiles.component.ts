// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input, output } from '@angular/core';

/** A tile: its name, one line under it, the whole of that line on hover, and whether it can't be
 *  chosen here (its line then says why). */
export interface ChoiceTile {
  id: string;
  name: string;
  line: string;
  full?: string;
  off?: boolean;
}

/**
 * A choice as tiles side by side, a column each (Run with statistics' question): each a radio -
 * its name and its line under a thin rule; the chosen one under a thick red rule, as a chosen tile;
 * one that can't be chosen here grey, its line saying why. One under the other on a phone.
 */
@Component({
  selector: 'assay-choice-tiles',
  standalone: true,
  host: { role: 'radiogroup', '[attr.aria-labelledby]': 'labelledBy()' },
  template: `
    @for (o of options(); track o.id) {
      <label
        class="tile"
        [class.on]="o.id === value()"
        [class.off]="!!o.off"
        [title]="o.full ?? ''"
      >
        <input
          type="radio"
          [name]="name()"
          [checked]="o.id === value()"
          [disabled]="!!o.off"
          (change)="choose.emit(o.id)"
        />
        <span class="tn">{{ o.name }}</span
        ><span class="tl">{{ o.line }}</span>
      </label>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(0, 1fr);
      column-gap: 24px;
    }
    .tile {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-height: 96px;
      padding-top: 12px;
      border-top: 1px solid var(--color-divider);
      cursor: pointer;
    }
    .tile.on {
      padding-top: 9px;
      border-top: 4px solid var(--color-accent);
    }
    .tile input {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: 0;
      opacity: 0;
      pointer-events: none;
    }
    .tile:has(input:focus-visible) {
      outline: 2px solid var(--color-accent);
      outline-offset: 4px;
    }
    .tn {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.01em;
      line-height: 1.3;
      color: var(--color-text);
    }
    .tl {
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-neutral-800);
      text-wrap: pretty;
    }
    .tile:not(.on):not(.off):hover .tn {
      color: var(--color-accent);
    }
    .tile.off {
      cursor: default;
    }
    .tile.off .tn {
      color: var(--color-neutral-500);
    }
    .tile.off .tl {
      color: var(--color-neutral-600);
    }
    @media (max-width: 960px) {
      :host {
        grid-auto-flow: row;
        row-gap: 20px;
      }
      .tile {
        min-height: 0;
        padding-bottom: 8px;
      }
    }
  `,
})
export class ChoiceTilesComponent {
  options = input.required<readonly ChoiceTile[]>();
  /** The chosen tile's id. */
  value = input<string | null>(null);
  /** The radios' group name, unique on the page. */
  name = input.required<string>();
  /** The id of what names the choice - its section's title. */
  labelledBy = input<string | null>(null);
  choose = output<string>();
}
