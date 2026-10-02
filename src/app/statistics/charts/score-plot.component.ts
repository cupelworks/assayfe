import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Interval, ScoreSummary, SeriesPoint, StatsScope } from '../../api/models';
import { StatusMarkComponent } from '../../shared/status-mark.component';
import { along } from './range-chart.component';
import { runLink } from '../stats-format';

/**
 * A scored check over the batch, on its own scale: every score (stacked where equal), the spread
 * (box: the middle half, lines: 10th to 90th percentile), the average with the bounds its verdict
 * used - each against the threshold line - and the score of each run in order, each opening its run.
 */
@Component({
  selector: 'assay-score-plot',
  standalone: true,
  imports: [RouterLink, StatusMarkComponent],
  styleUrls: ['../../shared/page.css'],
  template: `
    <div class="plot">
      <div class="k">
        <span class="kt">
          @if (numbered()) {
            <span class="no">1</span>
          }
          The {{ scored().length }} scores
        </span>
      </div>
      <div class="v dots" [style.height.px]="dotsHeight()">
        <i class="thr" [style.left.%]="thr()"></i>
        @for (d of dots(); track d.index) {
          <a
            class="sq"
            [class.m]="d.met"
            [routerLink]="d.link"
            [style.left.%]="d.x"
            [style.bottom.px]="d.y"
            [title]="d.title"
            [attr.aria-label]="d.title"
          ></a>
        }
      </div>
      <div class="k">
        <span class="kt">
          @if (numbered()) {
            <span class="no">2</span>
          }
          Spread
        </span>
        <span class="small"
          >box: the middle half of the scores · line: all but the lowest and highest tenth</span
        >
      </div>
      <div class="v">
        @if (box(); as b) {
          <i class="whisk" [style.left.%]="b.p10" [style.width.%]="b.whisk"></i>
          <i class="box" [style.left.%]="b.p25" [style.width.%]="b.box"></i>
          <i class="med" [style.left.%]="b.med"></i>
        }
        <i class="thr" [style.left.%]="thr()"></i>
      </div>
      <div class="k">
        <span class="kt">
          @if (numbered()) {
            <span class="no">3</span>
          }
          Average
        </span>
        <span class="small">with the bounds its verdict used</span>
      </div>
      <div class="v">
        @if (avg(); as a) {
          <i class="whisk" [style.left.%]="a.lo" [style.width.%]="a.w"></i>
          <assay-mark class="mean" [of]="verdict()" [style.left.%]="a.mean" />
        }
        <i class="thr" [style.left.%]="thr()"></i>
      </div>
      <div></div>
      <div class="ticks">
        <span style="left: 0; transform: none">{{ min() }}</span>
        <span class="t-thr" [style.left.%]="thr()">
          @if (numbered()) {
            <span class="no">4</span>
          }
          {{ threshold() }}</span
        >
        <span style="left: 100%; transform: translateX(-100%)">{{ max() }}</span>
      </div>
      <div class="k">
        Score per run<span class="small"
          >in order{{ scope() ? ', each opening its run' : '' }}</span
        >
      </div>
      <div class="v series">
        <i class="hthr" [style.bottom.%]="thr()"></i>
        @for (p of perRun(); track p.index) {
          <a class="col" [routerLink]="p.link" [title]="p.title" [attr.aria-label]="p.title">
            @if (p.y != null) {
              <i class="sq" [class.m]="p.met" [style.bottom.%]="p.y"></i>
            }
          </a>
        }
      </div>
      <div></div>
      <div class="ticks runs">
        <span style="left: 0; transform: none">run 1</span>
        <span style="left: 100%; transform: translateX(-100%)">run {{ series().length }}</span>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .plot {
      display: grid;
      grid-template-columns: 150px minmax(0, 1fr);
      border-top: 2px solid var(--color-divider);
    }
    .k {
      padding: 10px 12px 10px 0;
      border-bottom: 1px solid var(--color-divider);
      font-size: 12px;
      color: var(--color-neutral-600);
      display: flex;
      flex-direction: column;
    }
    .v {
      position: relative;
      min-height: 48px;
      border-bottom: 1px solid var(--color-divider);
    }
    .thr {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      margin-left: -1px;
      background: var(--color-accent);
      z-index: 1;
    }
    .sq {
      position: absolute;
      width: 8px;
      height: 8px;
      margin-left: -4px;
      background: var(--color-accent);
      display: block;
    }
    .sq.m {
      background: var(--color-status-green);
    }
    .whisk {
      position: absolute;
      top: 50%;
      height: 2px;
      margin-top: -1px;
      background: var(--color-text);
    }
    .box {
      position: absolute;
      top: 50%;
      height: 18px;
      margin-top: -9px;
      border: 2px solid var(--color-text);
      background: var(--color-bg);
    }
    .med {
      position: absolute;
      top: 50%;
      height: 18px;
      margin-top: -9px;
      width: 3px;
      margin-left: -1px;
      background: var(--color-text);
    }
    .mean {
      position: absolute;
      top: 50%;
      margin-top: -4px;
      margin-left: -4px;
    }
    .ticks {
      position: relative;
      height: 20px;
    }
    /* The score axis's labels close the rows above; the score-per-run row then starts anew. */
    .ticks:not(.runs) {
      margin-bottom: 16px;
    }
    .ticks > span {
      white-space: nowrap;
      position: absolute;
      top: 4px;
      transform: translateX(-50%);
      font-size: 10px;
      color: var(--color-neutral-500);
      font-variant-numeric: tabular-nums;
    }
    .ticks .t-thr {
      color: var(--color-accent);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .kt {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    /* A numbered part, when the plot is an example the text beside it explains. */
    .no {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      font-size: 10px;
      font-weight: 800;
      background: var(--color-text);
      color: var(--color-bg);
    }
    .v.series {
      height: 150px;
      display: flex;
    }
    .col {
      flex: 1;
      position: relative;
    }
    .col .sq {
      left: 50%;
      margin-bottom: -4px;
    }
    .col:hover,
    .col:focus-visible {
      background: color-mix(in srgb, var(--color-text) 6%, transparent);
    }
    .hthr {
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--color-accent);
    }
  `,
})
export class ScorePlotComponent {
  series = input.required<SeriesPoint[]>();
  scores = input<ScoreSummary | null>(null);
  interval = input<Interval | null>(null);
  verdict = input<string | null>(null);
  threshold = input.required<number>();
  /** `gte`: at or above the threshold passes. */
  comparison = input<string | null>('gte');
  min = input.required<number>();
  max = input.required<number>();
  /** Null draws an example: nothing links to a run. */
  scope = input<StatsScope | null>(null);
  testId = input<string | null>(null);
  /** Number the parts (1 to 4), for an example the text beside it explains. */
  numbered = input(false);
  private link = (p: SeriesPoint) => {
    const s = this.scope();
    return s ? runLink(s, p, this.testId()) : null;
  };
  private at = (v: number) => along(v, this.min(), this.max());
  private met = (v: number) =>
    this.comparison() === 'lte' ? v <= this.threshold() : v >= this.threshold();
  thr = computed(() => this.at(this.threshold()));
  scored = computed(() => this.series().filter((p) => p.score != null));
  /** Equal scores (to 3 decimals) stack upwards. */
  dots = computed(() => {
    const stacks = new Map<string, number>();
    return this.scored().map((p) => {
      const v = p.score!;
      const key = v.toFixed(3);
      const level = stacks.get(key) ?? 0;
      stacks.set(key, level + 1);
      return {
        index: p.index,
        x: this.at(v),
        y: 6 + level * 10,
        met: this.met(v),
        link: this.link(p),
        title: `Run ${p.index}: ${v}`,
      };
    });
  });
  dotsHeight = computed(() => {
    let most = 1;
    const stacks = new Map<string, number>();
    for (const p of this.scored()) {
      const key = p.score!.toFixed(3);
      stacks.set(key, (stacks.get(key) ?? 0) + 1);
      most = Math.max(most, stacks.get(key)!);
    }
    return Math.max(48, 14 + most * 10);
  });
  box = computed(() => {
    const s = this.scores();
    if (!s) return null;
    return {
      p10: this.at(s.p10),
      whisk: this.at(s.p90) - this.at(s.p10),
      p25: this.at(s.p25),
      box: Math.max(0.5, this.at(s.p75) - this.at(s.p25)),
      med: this.at(s.median),
    };
  });
  avg = computed(() => {
    const i = this.interval();
    const s = this.scores();
    if (!s) return null;
    const lo = i?.lower ?? s.mean,
      hi = i?.upper ?? s.mean;
    return { lo: this.at(lo), w: this.at(hi) - this.at(lo), mean: this.at(i?.point ?? s.mean) };
  });
  perRun = computed(() =>
    this.series().map((p) => ({
      index: p.index,
      y: p.score == null ? null : this.at(p.score),
      met: p.score != null && this.met(p.score),
      link: this.link(p),
      title:
        p.score == null
          ? `Run ${p.index}: no score${p.error ? ' - ' + p.error : ''}`
          : `Run ${p.index}: ${p.score}`,
    })),
  );
}
