import { Component, computed, input } from '@angular/core';
import { SeriesPoint } from '../../api/models';

const W = 760,
  H = 232,
  LEFT = 48,
  RIGHT = 680,
  TOP = 20,
  BOTTOM = 200;

/** A check's met rate as the times added up - from its series, the times without a value (errored,
 *  Not Ran) skipped - against the target line. Shows why an early streak can be luck. The rate it
 *  ends at is written at the line's end, to the whole percent; the times not met are red squares on
 *  the line, the times without a value grey ones on the axis, and - up to 30 times, 8 such at
 *  most - each of them is numbered under it. */
@Component({
  selector: 'assay-rate-trend',
  standalone: true,
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" role="img" [attr.aria-label]="label()">
      <line [attr.x1]="left" [attr.x2]="right" [attr.y1]="top" [attr.y2]="top" class="g" />
      <line [attr.x1]="left" [attr.x2]="right" [attr.y1]="mid" [attr.y2]="mid" class="g" />
      <line [attr.x1]="left" [attr.x2]="right" [attr.y1]="bottom" [attr.y2]="bottom" class="axis" />
      @if (targetY() != null) {
        <line
          [attr.x1]="left"
          [attr.x2]="right"
          [attr.y1]="targetY()"
          [attr.y2]="targetY()"
          class="target"
        />
        <text [attr.x]="right" [attr.y]="targetLabelY()" text-anchor="end" class="tl">
          {{ targetText() }}
        </text>
      }
      <polyline [attr.points]="line().points" class="rate" />
      @for (m of line().misses; track m.x) {
        <rect [attr.x]="m.x" [attr.y]="m.y" [attr.width]="m.s" [attr.height]="m.s" class="miss" />
      }
      @for (g of line().gaps; track g.x) {
        <rect [attr.x]="g.x" [attr.y]="g.y" [attr.width]="g.s" [attr.height]="g.s" class="gap" />
      }
      @if (line().end; as e) {
        <text [attr.x]="right + 10" [attr.y]="e.y" class="end">{{ e.text }}</text>
      }
      <text x="0" [attr.y]="top + 4" class="t">100%</text>
      <text x="0" [attr.y]="mid + 4" class="t">50%</text>
      <text x="0" [attr.y]="bottom + 4" class="t">0%</text>
      @for (t of ticks(); track t.label) {
        <line
          [attr.x1]="t.x"
          [attr.x2]="t.x"
          [attr.y1]="bottom"
          [attr.y2]="bottom + 6"
          class="tick"
          [class.miss-tick]="t.kind === 'miss'"
        />
        <text
          [attr.x]="t.x"
          [attr.y]="bottom + 20"
          text-anchor="middle"
          class="t"
          [class.miss-t]="t.kind === 'miss'"
          [class.gap-t]="t.kind === 'gap'"
        >
          {{ t.label }}
        </text>
      }
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }
    svg {
      width: 100%;
      height: auto;
      display: block;
      overflow: visible;
      font-family: inherit;
    }
    .g {
      stroke: color-mix(in srgb, var(--color-text) 14%, transparent);
    }
    .axis {
      stroke: var(--color-text);
      stroke-width: 1.5;
    }
    .target {
      stroke: var(--color-accent);
      stroke-width: 2;
    }
    .rate {
      fill: none;
      stroke: var(--color-text);
      stroke-width: 2;
    }
    .miss {
      fill: var(--color-accent);
    }
    .gap {
      fill: var(--color-neutral-800);
    }
    .tick {
      stroke: var(--color-text);
    }
    .tick.miss-tick {
      stroke: var(--color-accent);
    }
    .t {
      font-size: 10px;
      fill: var(--color-neutral-500);
      font-variant-numeric: tabular-nums;
    }
    .t.miss-t {
      fill: var(--color-accent);
      font-weight: 800;
    }
    .t.gap-t {
      fill: var(--color-neutral-800);
      font-weight: 800;
    }
    .tl {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1px;
      fill: var(--color-accent);
    }
    .end {
      font-size: 22px;
      font-weight: 800;
      fill: var(--color-text);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class RateTrendComponent {
  series = input.required<SeriesPoint[]>();
  /** The target, a share of 1; null draws no line. */
  target = input<number | null>(null);
  targetLabel = input('target');
  w = W;
  h = H;
  left = LEFT;
  right = RIGHT;
  top = TOP;
  bottom = BOTTOM;
  mid = (TOP + BOTTOM) / 2;
  private y = (rate: number) => TOP + (1 - rate) * (BOTTOM - TOP);
  private x = (i: number) => LEFT + (i / Math.max(1, this.series().length - 1)) * (RIGHT - LEFT);
  targetY = computed(() => (this.target() == null ? null : this.y(this.target()!)));
  targetText = computed(() => this.targetLabel().toUpperCase());
  /** The target's label sits on the side of its line the rate doesn't end on. */
  targetLabelY = computed(() => {
    const t = this.targetY()!,
      end = this.line().end;
    return end && end.rate < this.target()! ? t - 8 : t + 18;
  });
  line = computed(() => {
    const s = this.series();
    const many = s.length > 60;
    const miss = many ? 4 : 8,
      gap = many ? 3 : 6;
    let met = 0,
      seen = 0;
    const points: string[] = [];
    const misses: { x: number; y: number; s: number }[] = [];
    const gaps: { x: number; y: number; s: number }[] = [];
    let end: { y: number; rate: number; text: string } | null = null;
    for (const [i, p] of s.entries()) {
      const x = this.x(i);
      if (p.passed == null) {
        gaps.push({ x: x - gap / 2, y: BOTTOM - gap / 2, s: gap });
        continue;
      }
      seen += 1;
      if (p.passed) met += 1;
      const y = this.y(met / seen);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      if (!p.passed) misses.push({ x: x - miss / 2, y: y - miss / 2, s: miss });
      end = { y: y + 8, rate: met / seen, text: `${Math.round((met / seen) * 100)}%` };
    }
    return { points: points.join(' '), misses, gaps, end };
  });
  /** Times along the axis every few, and - up to 30 times - each not met (red) or without a
   *  value (grey). */
  ticks = computed(() => {
    const s = this.series();
    const n = s.length;
    if (!n) return [];
    const step = n <= 30 ? 5 : n <= 60 ? 10 : n <= 150 ? 25 : n <= 300 ? 50 : 100;
    const kinds = new Map<number, 'reg' | 'miss' | 'gap'>([[1, 'reg']]);
    for (let t = step; t < n; t += step) if (n - t >= step / 2) kinds.set(t, 'reg');
    kinds.set(n, 'reg');
    // Numbered one by one only while they're few: a check missed every time needs no list.
    const events = s.filter((p) => p.passed !== true).length;
    if (n <= 30 && events <= 8)
      s.forEach((p, i) => {
        if (p.passed === false) kinds.set(i + 1, 'miss');
        else if (p.passed == null) kinds.set(i + 1, 'gap');
      });
    return [...kinds.entries()]
      .sort(([a], [b]) => a - b)
      .map(([t, kind]) => ({ x: this.x(t - 1), label: String(t), kind }));
  });
  label = computed(() => {
    const e = this.line().end;
    return `Met rate over the ${this.series().length} times${e ? `, ending at ${e.text}` : ''}`;
  });
}
