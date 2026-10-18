// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input, output } from '@angular/core';

/** One thing to do with the ticked rows: "Add to a test set…", "Delete…" (in red). One that can't
 *  be done says why, beside it. */
export interface BulkAction {
  key: string;
  label: string;
  red?: boolean;
  disabled?: boolean;
  why?: string | null;
}

/**
 * With rows ticked: how many, what to do with them and "Clear the selection" - a bar in ink at
 * the foot of the window, as Run with statistics' Start and Cancel, so it can't be missed while
 * the list scrolls. The page puts it last in its template and shows it while anything is ticked.
 */
@Component({
  selector: 'assay-bulk-bar',
  standalone: true,
  host: { role: 'region', '[attr.aria-label]': 'label()' },
  template: `
    <div class="in">
      <span class="count"
        ><b>{{ count() }}</b
        >selected</span
      >
      @for (a of actions(); track a.key) {
        <button
          type="button"
          class="act"
          [class.red]="a.red"
          [disabled]="a.disabled"
          (click)="act.emit(a.key)"
        >
          {{ a.label }}
        </button>
        @if (a.disabled && a.why) {
          <span class="why">{{ a.why }}</span>
        }
      }
      <button type="button" class="x" (click)="clear.emit()">Clear the selection</button>
    </div>
  `,
  styles: `
    :host {
      position: sticky;
      bottom: 0;
      z-index: 20;
      display: block;
      margin-top: 40px;
      background: var(--color-text);
      color: var(--color-bg);
    }
    .in {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0 32px;
      min-height: 64px;
      padding-inline: 40px;
    }
    .count {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .count b {
      margin-right: 6px;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .act {
      all: unset;
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      font-size: 14px;
      font-weight: 700;
      color: var(--color-bg);
      cursor: pointer;
    }
    .act:hover:not(:disabled) {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .act.red {
      color: var(--color-accent-400);
    }
    .act:disabled {
      color: var(--color-neutral-500);
      cursor: default;
    }
    .why {
      margin-left: -20px;
      font-size: 12px;
      color: var(--color-neutral-400);
    }
    .x {
      all: unset;
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-neutral-400);
      cursor: pointer;
    }
    .x:hover {
      color: var(--color-bg);
    }
    .act:focus-visible,
    .x:focus-visible {
      outline: 2px solid var(--color-accent-400);
      outline-offset: 2px;
    }
    @media (max-width: 960px) {
      .in {
        gap: 0 20px;
        padding: 8px 16px;
      }
      .why {
        margin-left: 0;
      }
      .x {
        margin-left: 0;
      }
    }
  `,
})
export class BulkBarComponent {
  count = input.required<number>();
  actions = input.required<BulkAction[]>();
  /** What the region is, for a screen reader: "With the selected tests". */
  label = input('With the selected');
  act = output<string>();
  clear = output<void>();
}
