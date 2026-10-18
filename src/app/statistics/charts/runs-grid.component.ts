// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatsScope, StripPoint, TestStatus } from '../../api/models';
import { STATUS, statusColor, statusLabel } from '../../shared/format';
import { runLink } from '../stats-format';

export interface GridRow {
  key: string;
  name: string;
  /** The test set an entry belongs to, in a plan. */
  sub: string | null;
  testId: string | null;
  strip: StripPoint[];
}

/** Up to this many times a row is one line of squares, numbered above; more wrap, smaller. */
const ONE_LINE = 50;

/** Every run of a batch: a row per entry, a square per time, coloured by the run's status, each
 *  opening its run, and under each entry's name what its row holds ("27 Green · 2 Amber").
 *  Statuses only - never a verdict, so it can show while the batch runs. */
@Component({
  selector: 'assay-runs-grid',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="grid" [class.wrap]="!oneLine()">
      <div class="hd"><span class="cap">Entry</span></div>
      <div class="hd">
        @if (oneLine()) {
          <div class="cells idx" [style.grid-template-columns]="columns()">
            @for (t of numbered(); track t) {
              <span [style.grid-column]="t">{{ t }}</span>
            }
          </div>
        }
      </div>
      @for (r of tallied(); track r.key) {
        <div class="name" [title]="r.name">
          <span class="nm">{{ r.name }}</span>
          @if (r.sub) {
            <span class="small">{{ r.sub }}</span>
          }
          <span class="small num">{{ r.tally }}</span>
        </div>
        <div class="row-cells">
          <div class="cells" [style.grid-template-columns]="oneLine() ? columns() : null">
            @for (c of r.strip; track c.index) {
              <a
                class="c"
                [routerLink]="link(c, r.testId)"
                [style.background]="statusColor(c.status)"
                [title]="'Time ' + c.index + ': ' + statusLabel(c.status)"
                [attr.aria-label]="'Time ' + c.index + ': ' + statusLabel(c.status)"
              ></a>
            }
          </div>
        </div>
      }
    </div>
    <div class="legend">
      @for (l of legend(); track l.key) {
        <span class="chip"><span class="dot" [style.background]="l.color"></span>{{ l.text }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 240px) minmax(0, 1fr);
      column-gap: 20px;
    }
    .hd {
      padding-bottom: 6px;
      border-bottom: 2px solid var(--color-text);
      display: flex;
      align-items: flex-end;
      min-width: 0;
    }
    .cap {
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    .name {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px 0;
      border-bottom: 1px solid color-mix(in srgb, var(--color-text) 14%, transparent);
      min-width: 0;
    }
    .nm {
      font-size: 13px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .small {
      font-size: 12px;
      color: var(--color-neutral-600);
    }
    .num {
      font-variant-numeric: tabular-nums;
    }
    .row-cells {
      display: flex;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid color-mix(in srgb, var(--color-text) 14%, transparent);
      min-width: 0;
    }
    /* One line: a column per time, squares up to 16 px that narrow to fit. */
    .cells {
      display: grid;
      column-gap: 3px;
      width: 100%;
    }
    .c {
      height: 16px;
      display: block;
    }
    .idx {
      font-size: 10px;
      color: var(--color-neutral-500);
      font-variant-numeric: tabular-nums;
    }
    .idx span {
      text-align: center;
      white-space: nowrap;
    }
    /* Many times: smaller squares that wrap. */
    .wrap .cells {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
    }
    .wrap .c {
      width: 8px;
      height: 12px;
    }
    .c:hover,
    .c:focus-visible {
      outline: 2px solid var(--color-text);
      outline-offset: 1px;
    }
    .legend {
      display: flex;
      gap: 8px 20px;
      flex-wrap: wrap;
      margin-top: 14px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--color-neutral-600);
    }
    .dot {
      width: 8px;
      height: 8px;
      display: inline-block;
    }
  `,
})
export class RunsGridComponent {
  rows = input.required<GridRow[]>();
  /** Null draws an example: the squares link nowhere. */
  scope = input<StatsScope | null>(null);
  statusColor = statusColor;
  statusLabel = statusLabel;
  /** The most times any row has. */
  private times = computed(() => Math.max(0, ...this.rows().map((r) => r.strip.length)));
  oneLine = computed(() => this.times() > 0 && this.times() <= ONE_LINE);
  columns = computed(() => `repeat(${this.times()}, minmax(0, 16px))`);
  /** The times numbered above the squares: the first, every fifth, the last. */
  numbered = computed(() => {
    const n = this.times();
    const out = [1];
    for (let t = 5; t < n; t += 5) if (n - t >= 3) out.push(t);
    if (n > 1) out.push(n);
    return out;
  });
  /** Each row with what it holds: "27 Green · 2 Amber", in the usual order of statuses. */
  tallied = computed(() =>
    this.rows().map((r) => {
      const n = new Map<TestStatus, number>();
      for (const c of r.strip) n.set(c.status, (n.get(c.status) ?? 0) + 1);
      const tally = STATUS.filter((s) => n.get(s.key))
        .map((s) => `${n.get(s.key)} ${s.label}`)
        .join(' · ');
      return { ...r, tally };
    }),
  );
  /** Each run status the grid holds, in the usual order. */
  legend = computed(() => {
    const seen = new Set<TestStatus>();
    for (const r of this.rows()) for (const c of r.strip) seen.add(c.status);
    return STATUS.filter((s) => seen.has(s.key)).map((s) => ({
      key: s.key,
      color: s.color,
      text: s.label,
    }));
  });
  link(c: StripPoint, testId: string | null) {
    const s = this.scope();
    return s ? runLink(s, c, testId) : null;
  }
}
