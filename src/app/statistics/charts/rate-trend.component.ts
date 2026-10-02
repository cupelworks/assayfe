import { Component, computed, input } from '@angular/core';
import { SeriesPoint } from '../../api/models';

const W = 600,
  H = 170,
  LEFT = 40,
  RIGHT = 590,
  TOP = 10,
  BOTTOM = 150;

/** A check's met rate as the times added up - from its series, the times without a value (errored,
 *  Not Ran) skipped - against the target line. Shows why an early streak proves nothing yet. */
@Component({
  selector: 'assay-rate-trend',
  standalone: true,
  styleUrls: ['../../shared/page.css'],
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
        <text [attr.x]="right" [attr.y]="targetY()! + 14" text-anchor="end" class="tl">
          {{ targetLabel() }}
        </text>
      }
      <polyline [attr.points]="points()" class="rate" />
      <text x="0" [attr.y]="top + 4" class="t">100%</text>
      <text x="0" [attr.y]="mid + 4" class="t">50%</text>
      <text x="0" [attr.y]="bottom + 4" class="t">0%</text>
    </svg>
    <div class="x small">
      <span>time 1</span><span>time {{ series().length }}</span>
    </div>
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
    }
    .g {
      stroke: color-mix(in srgb, var(--color-text) 14%, transparent);
    }
    .axis {
      stroke: var(--color-divider);
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
    .t {
      font-size: 11px;
      fill: var(--color-neutral-500);
    }
    .tl {
      font-size: 11px;
      fill: var(--color-accent);
    }
    .x {
      display: flex;
      justify-content: space-between;
      padding-left: 6.7%;
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
  targetY = computed(() => (this.target() == null ? null : this.y(this.target()!)));
  points = computed(() => {
    const s = this.series();
    const n = Math.max(1, s.length - 1);
    let met = 0,
      seen = 0;
    const out: string[] = [];
    s.forEach((p, i) => {
      if (p.passed == null) return;
      seen += 1;
      if (p.passed) met += 1;
      out.push(`${(LEFT + (i / n) * (RIGHT - LEFT)).toFixed(1)},${this.y(met / seen).toFixed(1)}`);
    });
    return out.join(' ');
  });
  label = computed(() => `Met rate over the ${this.series().length} times`);
}
