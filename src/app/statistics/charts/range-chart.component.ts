import { Component, computed, input } from '@angular/core';
import { StatusMarkComponent } from '../../shared/status-mark.component';

/** Where a value falls on an axis, as a percentage of its width, kept on the axis. */
export const along = (v: number, min: number, max: number) =>
  Math.min(100, Math.max(0, ((v - min) / (max - min || 1)) * 100));

/**
 * One number with its range on an axis - a pass rate with the bounds its verdict used, or an
 * average score with its t bounds - against a line: the target or the threshold. The point wears
 * the verdict's mark, so the chart and the verdict beside it read the same.
 */
@Component({
  selector: 'assay-range-chart',
  standalone: true,
  imports: [StatusMarkComponent],
  template: `
    <div class="track">
      @for (g of grid(); track g) {
        <i class="g" [style.left.%]="g"></i>
      }
      @if (linePos() != null) {
        <i class="line" [style.left.%]="linePos()"></i>
      }
      @if (range(); as r) {
        <i class="range" [style.left.%]="r.left" [style.width.%]="r.width"></i>
      }
      @if (pointPos() != null) {
        <assay-mark class="pt" [of]="mark()" [style.left.%]="pointPos()" />
      }
    </div>
    @if (placed().length) {
      <div class="labels">
        @for (l of placed(); track $index) {
          <span
            [style.left.%]="l.at"
            [class.first]="l.at === 0"
            [class.last]="l.at === 100"
            [class.line-label]="l.line"
            >{{ l.text }}</span
          >
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .track {
      position: relative;
      height: 22px;
    }
    .g {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: color-mix(in srgb, var(--color-text) 14%, transparent);
    }
    .line {
      position: absolute;
      top: -4px;
      bottom: -4px;
      width: 2px;
      margin-left: -1px;
      background: var(--color-accent);
    }
    .range {
      position: absolute;
      top: 10px;
      height: 2px;
      background: var(--color-text);
    }
    .range::before,
    .range::after {
      content: '';
      position: absolute;
      top: -4px;
      width: 2px;
      height: 10px;
      background: var(--color-text);
    }
    .range::before {
      left: 0;
    }
    .range::after {
      right: 0;
    }
    .pt {
      position: absolute;
      top: 7px;
      margin-left: -4px;
    }
    .labels {
      position: relative;
      height: 14px;
      margin-top: 2px;
    }
    .labels span {
      position: absolute;
      transform: translateX(-50%);
      font-size: 10px;
      color: var(--color-neutral-500);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .labels span.first {
      transform: none;
    }
    .labels span.last {
      transform: translateX(-100%);
    }
    .labels span.line-label {
      color: var(--color-accent);
    }
  `,
})
export class RangeChartComponent {
  min = input.required<number>();
  max = input.required<number>();
  lower = input<number | null>(null);
  upper = input<number | null>(null);
  point = input<number | null>(null);
  /** The target or threshold. */
  line = input<number | null>(null);
  /** The verdict (or outcome) the point is marked with. */
  mark = input<string | null>(null);
  /** Values to draw a faint gridline at. */
  ticks = input<number[]>([]);
  /** Values to label under the axis - the line's label in its colour. */
  labels = input<{ at: number; text: string; line?: boolean }[]>([]);
  placed = computed(() =>
    this.labels().map((l) => ({ ...l, at: along(l.at, this.min(), this.max()) })),
  );
  grid = computed(() => this.ticks().map((t) => along(t, this.min(), this.max())));
  linePos = computed(() =>
    this.line() == null ? null : along(this.line()!, this.min(), this.max()),
  );
  pointPos = computed(() =>
    this.point() == null ? null : along(this.point()!, this.min(), this.max()),
  );
  range = computed(() => {
    const lo = this.lower(),
      hi = this.upper();
    if (lo == null || hi == null) return null;
    const left = along(lo, this.min(), this.max());
    return { left, width: along(hi, this.min(), this.max()) - left };
  });
}
