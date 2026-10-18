// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, input } from '@angular/core';
import { StatusMarkComponent } from '../../shared/status-mark.component';
import { along } from './range-chart.component';

/** A against B on one axis: A hollow, B wearing the verdict's mark, the line between them. On the
 *  range chart's track, so the two sit level in a row; what the parent projects goes under it. */
@Component({
  selector: 'assay-dumbbell',
  standalone: true,
  imports: [StatusMarkComponent],
  template: `
    <div class="track">
      @if (between(); as l) {
        <i class="link" [style.left.%]="l.left" [style.width.%]="l.width"></i>
      }
      @if (aPos() != null) {
        <i class="a" [style.left.%]="aPos()" title="A"></i>
      }
      @if (bPos() != null) {
        <assay-mark class="b" size="md" [of]="mark()" [style.left.%]="bPos()" />
      }
    </div>
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 34px;
      padding: 8px 0;
    }
    .track {
      position: relative;
      height: 12px;
    }
    .link {
      position: absolute;
      top: 5px;
      height: 2px;
      background: var(--color-neutral-500);
    }
    .a {
      position: absolute;
      top: 1px;
      width: 10px;
      height: 10px;
      margin-left: -5px;
      background: var(--color-bg);
      box-shadow: inset 0 0 0 1.5px var(--color-text);
    }
    .b {
      position: absolute;
      top: 1px;
      margin-left: -5px;
    }
    .track .b.mark-hollow {
      background: var(--color-bg);
    }
  `,
})
export class DumbbellComponent {
  /** A's and B's values, on the axis from `min` to `max`; null leaves a side out. */
  a = input<number | null>(null);
  b = input<number | null>(null);
  min = input(0);
  max = input(1);
  /** B's mark: the verdict (better, worse, no_difference…). */
  mark = input<string | null>(null);
  aPos = computed(() => (this.a() == null ? null : along(this.a()!, this.min(), this.max())));
  bPos = computed(() => (this.b() == null ? null : along(this.b()!, this.min(), this.max())));
  between = computed(() => {
    const a = this.aPos(),
      b = this.bPos();
    return a == null || b == null ? null : { left: Math.min(a, b), width: Math.abs(b - a) };
  });
}
