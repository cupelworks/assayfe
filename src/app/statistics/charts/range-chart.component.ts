import { Component, computed, input } from '@angular/core';
import { StatusMarkComponent } from '../../shared/status-mark.component';

/** Where a value falls on an axis, as a percentage of its width, kept on the axis. */
export const along = (v: number, min: number, max: number) =>
  Math.min(100, Math.max(0, ((v - min) / (max - min || 1)) * 100));

/** A bound as the chart writes it: a share of 1 in points ("79.2", "100"), a score to 3
 *  significant figures, as the API's sentences write scores. */
const boundText = (v: number, kind: 'pct' | 'num') =>
  kind === 'pct' ? String(Math.round(v * 1000) / 10) : String(Number(v.toPrecision(3)));

/**
 * One number with its range on an axis - a pass rate with the bounds its verdict used, or an
 * average score with its range - against a line: the target, the threshold or 0. The point wears
 * the verdict's mark, so the chart and the verdict beside it read the same.
 *
 * The line and the faint gridlines run the host's full height: a row that stretches the chart to
 * its height draws them unbroken from row to row. What the parent projects (a caption) sits under
 * the bar.
 */
@Component({
  selector: 'assay-range-chart',
  standalone: true,
  imports: [StatusMarkComponent],
  template: `
    @for (g of grid(); track g) {
      <i class="g" [style.left.%]="g"></i>
    }
    @if (linePos() != null) {
      <i class="line" [style.left.%]="linePos()"></i>
    }
    <div class="track">
      @if (range(); as r) {
        <i class="range" [style.left.%]="r.left" [style.width.%]="r.width"></i>
      }
      @if (pointPos() != null) {
        <assay-mark class="pt" size="md" [of]="mark()" [style.left.%]="pointPos()" />
      }
    </div>
    @if (boundLabels().length) {
      <div class="labels">
        @for (b of boundLabels(); track $index) {
          <span
            [style.left.%]="b.at"
            [class.mid]="b.align === 'mid'"
            [class.end]="b.align === 'end'"
            >{{ b.text }}</span
          >
        }
      </div>
    }
    @if (placed().length) {
      <div class="labels">
        @for (l of placed(); track $index) {
          <span
            [style.left.%]="l.at"
            [class.mid]="l.at > 0 && l.at < 100"
            [class.end]="l.at === 100"
            [class.line-label]="l.line"
            >{{ l.text }}</span
          >
        }
      </div>
    }
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      min-height: 34px;
      padding: 8px 0;
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
      top: 0;
      bottom: 0;
      width: 2px;
      margin-left: -1px;
      background: var(--color-accent);
      z-index: 1;
    }
    .track {
      position: relative;
      height: 12px;
    }
    .range {
      position: absolute;
      top: 4px;
      height: 4px;
      background: var(--color-text);
    }
    .pt {
      position: absolute;
      top: 1px;
      margin-left: -5px;
      z-index: 2;
    }
    /* A hollow point sits on the bar: fill it with the page, or the bar shows through. */
    .track .pt.mark-hollow {
      background: var(--color-bg);
    }
    .labels {
      position: relative;
      height: 14px;
      margin-top: 4px;
    }
    .labels span {
      position: absolute;
      z-index: 2;
      padding: 0 2px;
      background: var(--color-bg);
      font-size: 10px;
      color: var(--color-neutral-500);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .labels span.mid {
      transform: translateX(-50%);
    }
    .labels span.end {
      transform: translateX(-100%);
    }
    .labels span.line-label {
      color: var(--color-accent);
      font-weight: 800;
    }
  `,
})
export class RangeChartComponent {
  min = input.required<number>();
  max = input.required<number>();
  lower = input<number | null>(null);
  upper = input<number | null>(null);
  point = input<number | null>(null);
  /** The target, the threshold, or 0 - the line the result is judged against. */
  line = input<number | null>(null);
  /** The verdict (or outcome) the point is marked with. */
  mark = input<string | null>(null);
  /** Values to draw a faint gridline at. */
  ticks = input<number[]>([]);
  /** Values to label under the axis - the line's label in its colour. */
  labels = input<{ at: number; text: string; line?: boolean }[]>([]);
  /** Write the range's two ends under the bar: `pct` for a share of 1, `num` for a score. */
  bounds = input<'pct' | 'num' | null>(null);
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
  /** The lower end under the bar's start, the upper under its end; a bar too short for two
   *  labels gets one, "88.1–93.5", centred on it (kept on the axis). */
  boundLabels = computed((): { at: number; text: string; align: 'start' | 'mid' | 'end' }[] => {
    const kind = this.bounds(),
      lo = this.lower(),
      hi = this.upper();
    if (!kind || lo == null || hi == null) return [];
    const a = along(lo, this.min(), this.max()),
      b = along(hi, this.min(), this.max());
    if (b - a >= 16) {
      return [
        { at: a, text: boundText(lo, kind), align: 'start' },
        { at: b, text: boundText(hi, kind), align: 'end' },
      ];
    }
    const text = hi === lo ? boundText(lo, kind) : `${boundText(lo, kind)}–${boundText(hi, kind)}`;
    const mid = (a + b) / 2;
    if (mid < 10) return [{ at: 0, text, align: 'start' }];
    if (mid > 90) return [{ at: 100, text, align: 'end' }];
    return [{ at: mid, text, align: 'mid' }];
  });
}
