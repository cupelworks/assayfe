import { Component, computed, input } from '@angular/core';
import { OddsPoint } from '../../api/models';
import { chanceText } from '../stats-format';

const LEFT = 34,
  RIGHT = 330,
  TOP = 14,
  BOTTOM = 150;
/** The axis ends on one of these: the smallest that holds what the chart has to show. */
const ENDS = [100, 150, 200, 300, 400, 500, 600, 800, 1000];

/**
 * The chance that every check gets an answer, by size - the estimate's `odds`, drawn at the sizes
 * where one more failure becomes allowed (the curve's peaks) - against the goal, the red line. The
 * picked size is a filled square; the best any size gets, when the goal is out of reach, a hollow
 * one. Under the sizes, what they cost: application and judge calls. The axis stops a little past
 * what matters, so a goal reached at 46 times isn't lost in a 1,000-time axis.
 */
@Component({
  selector: 'assay-odds-chart',
  standalone: true,
  template: `
    <svg viewBox="0 0 340 200" role="img" [attr.aria-label]="label()">
      <line [attr.x1]="left" [attr.x2]="right" [attr.y1]="top" [attr.y2]="top" class="g" />
      <line [attr.x1]="left" [attr.x2]="right" [attr.y1]="mid" [attr.y2]="mid" class="g" />
      <line [attr.x1]="left" [attr.x2]="right" [attr.y1]="bottom" [attr.y2]="bottom" class="axis" />
      <line
        [attr.x1]="left"
        [attr.x2]="right"
        [attr.y1]="goalY()"
        [attr.y2]="goalY()"
        class="goal"
      />
      <text [attr.x]="left + 2" [attr.y]="goalY() - 5" class="cap red">{{ goalText() }}</text>
      <polyline [attr.points]="points()" class="curve" />
      @if (pick(); as p) {
        <line [attr.x1]="p.x" [attr.x2]="p.x" [attr.y1]="top" [attr.y2]="bottom" class="guide" />
        <rect [attr.x]="p.x - 4" [attr.y]="p.y - 4" width="8" height="8" class="pick" />
        <text [attr.x]="p.lx" [attr.y]="p.ly" [attr.text-anchor]="p.anchor" class="lbl">
          {{ p.text }}
        </text>
      }
      @if (bestMark(); as b) {
        <rect [attr.x]="b.x - 4" [attr.y]="b.y - 4" width="8" height="8" class="best" />
        <text [attr.x]="b.lx" [attr.y]="b.ly" [attr.text-anchor]="b.anchor" class="lbl soft">
          {{ b.text }}
        </text>
      }
      <text x="0" [attr.y]="top + 3" class="t">100%</text>
      <text x="0" [attr.y]="mid + 3" class="t">50%</text>
      <text x="0" [attr.y]="bottom + 3" class="t">0%</text>
      @for (k of ticks(); track k.x) {
        <line
          [attr.x1]="k.x"
          [attr.x2]="k.x"
          [attr.y1]="bottom"
          [attr.y2]="bottom + 5"
          class="tick"
        />
        <text [attr.x]="k.x" y="167" text-anchor="middle" class="v">{{ k.times }}</text>
        <text [attr.x]="k.x" y="181" text-anchor="middle" class="v">{{ k.app }}</text>
        <text [attr.x]="k.x" y="195" text-anchor="middle" class="v">{{ k.judge }}</text>
      }
      <text [attr.x]="left" y="167" class="cap">TIMES</text>
      <text [attr.x]="left" y="181" class="cap">APP CALLS</text>
      <text [attr.x]="left" y="195" class="cap">JUDGE CALLS</text>
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
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
    .goal {
      stroke: var(--color-accent);
      stroke-width: 2;
    }
    .curve {
      fill: none;
      stroke: var(--color-text);
      stroke-width: 2;
      stroke-linejoin: round;
    }
    .guide {
      stroke: var(--color-text);
      stroke-dasharray: 3 3;
    }
    .pick {
      fill: var(--color-accent);
    }
    .best {
      fill: var(--color-bg);
      stroke: var(--color-text);
      stroke-width: 1.5;
    }
    .tick {
      stroke: var(--color-text);
    }
    .t {
      font-size: 9px;
      fill: var(--color-neutral-600);
    }
    .v {
      font-size: 9.5px;
      fill: var(--color-neutral-700);
      font-variant-numeric: tabular-nums;
    }
    .cap {
      font-size: 8px;
      font-weight: 600;
      letter-spacing: 0.8px;
      fill: var(--color-neutral-600);
    }
    .cap.red {
      fill: var(--color-accent);
    }
    .lbl {
      font-size: 10.5px;
      font-weight: 800;
      fill: var(--color-text);
      font-variant-numeric: tabular-nums;
    }
    .lbl.soft {
      font-weight: 600;
      fill: var(--color-neutral-700);
    }
  `,
})
export class OddsChartComponent {
  odds = input.required<OddsPoint[]>();
  /** The chance of an answer the default size aims for. */
  goal = input(0.9);
  /** The size the dialog has picked, with its chance. */
  picked = input<OddsPoint | null>(null);
  /** The best any size gets - drawn when it isn't the picked one. */
  best = input<OddsPoint | null>(null);
  appPerTime = input(0);
  judgePerTime = input(0);

  left = LEFT;
  right = RIGHT;
  top = TOP;
  bottom = BOTTOM;
  mid = (TOP + BOTTOM) / 2;

  /** The axis's end: a little past the picked and best sizes, never past the last point. */
  private end = computed(() => {
    const last = this.odds().at(-1)?.times ?? 100;
    const shown = Math.max(this.picked()?.times ?? 0, this.bestShown()?.times ?? 0);
    const want = Math.min(last, Math.max(shown * 2.5, 100));
    return ENDS.find((e) => e >= want) ?? ENDS.at(-1)!;
  });
  private x = (t: number) => LEFT + (Math.min(t, this.end()) / this.end()) * (RIGHT - LEFT);
  private y = (c: number) => BOTTOM - c * (BOTTOM - TOP);
  goalY = computed(() => this.y(this.goal()));
  goalText = computed(() => `${chanceText(this.goal())} GOAL`);
  points = computed(() =>
    this.odds()
      .filter((p) => p.times <= this.end())
      .map((p) => `${this.x(p.times).toFixed(1)},${this.y(p.chance).toFixed(1)}`)
      .join(' '),
  );
  private bestShown = computed(() => {
    const b = this.best(),
      p = this.picked();
    return b && (!p || b.times !== p.times) ? b : null;
  });
  /** A marker's label: on the side away from the chart's edge, under the point when it's high. */
  private place = (t: number, c: number, text: string, above: boolean) => {
    const x = this.x(t),
      y = this.y(c);
    const right = x < 120;
    return {
      x,
      y,
      text,
      anchor: right ? 'start' : 'end',
      lx: right ? x + 8 : x - 8,
      ly: above ? y - 8 : y + 18,
    };
  };
  pick = computed(() => {
    const p = this.picked();
    return p
      ? this.place(p.times, p.chance, `${p.times} times · ${chanceText(p.chance)}`, p.chance < 0.55)
      : null;
  });
  bestMark = computed(() => {
    const b = this.bestShown();
    return b ? this.place(b.times, b.chance, `at best ${chanceText(b.chance)}`, true) : null;
  });
  ticks = computed(() =>
    [1, 2, 3, 4].map((k) => {
      const times = (this.end() * k) / 4;
      return {
        x: this.x(times),
        times: times.toLocaleString('en-US'),
        app: (times * this.appPerTime()).toLocaleString('en-US'),
        judge: (times * this.judgePerTime()).toLocaleString('en-US'),
      };
    }),
  );
  label = computed(() => {
    const p = this.picked(),
      b = this.bestShown();
    return (
      `The chance that every check gets an answer, by size, against a ${chanceText(this.goal())} goal` +
      (p ? `; ${p.times} times give ${chanceText(p.chance)}` : '') +
      (b ? `; at best ${chanceText(b.chance)} at ${b.times} times` : '')
    );
  });
}
