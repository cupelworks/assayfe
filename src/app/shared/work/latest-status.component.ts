// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, input } from '@angular/core';
import { StatusCount } from '../format';
import { StatusMarkComponent, markLabel } from '../status-mark.component';
import { StatusCountsComponent } from '../status-counts.component';
import { RelTimeComponent } from '../rel-time.component';

/**
 * A row's latest verdict or latest run, in a work list's cell: its mark and word ("■ Failed") -
 * or, for a run of a set, its counts ("■ 2 Red") - and when, small, under it. With none, the
 * list's word for it, quiet ("Not yet", "never run with statistics"); while it's read, "…".
 */
@Component({
  selector: 'assay-latest-status',
  standalone: true,
  imports: [StatusMarkComponent, StatusCountsComponent, RelTimeComponent],
  template: `
    @if (loading()) {
      <span class="w none">…</span>
    } @else if (counts()?.length) {
      <assay-status-counts class="w" [counts]="counts()!" />
      <span class="when"><assay-rel-time [iso]="at()" /></span>
    } @else if (of(); as s) {
      <span class="w"><assay-mark [of]="s" />{{ label() }}</span>
      <span class="when"><assay-rel-time [iso]="at()" /></span>
    } @else {
      <span class="w none">{{ none() }}</span>
      @if (noneWhen(); as w) {
        <span class="when">{{ w }}</span>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .w {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: var(--color-text);
    }
    .w.none {
      font-weight: 400;
      color: var(--color-neutral-500);
    }
    .when {
      font-size: 12px;
      color: var(--color-neutral-600);
    }
  `,
})
export class LatestStatusComponent {
  /** The status (a batch's or a run's); null: none yet. */
  of = input<string | null>(null);
  /** A set's or plan's run: each status with how many. */
  counts = input<StatusCount[] | null>(null);
  at = input<string | null>(null);
  loading = input(false);
  /** The word with none: "Not yet", "Never run". */
  none = input('Never run');
  noneWhen = input<string | null>(null);
  label = computed(() => markLabel(this.of()));
}
