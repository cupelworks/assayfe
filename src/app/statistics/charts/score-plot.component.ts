// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Interval, ScoreSummary, SeriesPoint, StatsScope } from '../../api/models';
import { StatusMarkComponent } from '../../shared/status-mark.component';
import { along } from './range-chart.component';
import { pct, runLink } from '../stats-format';

/** A score as the chart writes it, as the API's sentences do: to 3 significant figures - 0.3667
 *  is 0.367, 24.752 is 24.8. */
const scoreText = (v: number) => String(Number(v.toPrecision(3)));

/**
 * A scored check over the batch, on its own scale: every score (stacked where equal), the spread
 * (box: the middle half, line: all but the lowest and highest tenth), the average with the range
 * its verdict was decided on, written beside it - each against the threshold line, unbroken from
 * row to row - and the score of each run in order, each opening its run.
 */
@Component({
  selector: 'assay-score-plot',
  standalone: true,
  imports: [RouterLink, StatusMarkComponent],
  template: `
    <div class="plot">
      <div class="k">
        <span class="kt">
          @if (numbered()) {
            <span class="n">1</span>
          }
          <span class="cap">The {{ scored().length }} scores</span>
        </span>
      </div>
      <div class="v" [style.min-height.px]="dotsHeight()">
        <i class="thr" [style.left.%]="thr()"></i>
        @if (numbered()) {
          <span class="callout" [style.left]="'calc(' + thr() + '% + 6px)'">4</span>
        }
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
            <span class="n">2</span>
          }
          <span class="cap">Spread</span>
        </span>
        @if (!numbered()) {
          <span class="small"
            >box: the middle half of the scores · line: all but the lowest and highest tenth</span
          >
        }
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
            <span class="n">3</span>
          }
          <span class="cap">Average</span>
        </span>
        @if (!numbered()) {
          <span class="small">with the range its verdict was decided on</span>
        }
      </div>
      <div class="v">
        <i class="thr" [style.left.%]="thr()"></i>
        @if (avg(); as a) {
          <i class="bar" [style.left.%]="a.lo" [style.width.%]="a.w"></i>
          <assay-mark class="mean" size="md" [of]="verdict()" [style.left.%]="a.mean" />
          <span class="avg" [class.before]="a.before" [style.left.%]="a.labelAt"
            ><span class="fig">{{ a.value }}</span>
            @if (a.bound) {
              <span class="small">{{ a.bound }}</span>
            }
          </span>
        }
      </div>
      <div></div>
      <div class="scale">
        @for (t of tenths; track t) {
          <i class="tk" [style.left.%]="t"></i>
        }
        @for (l of scaleLabels(); track l.at) {
          <span
            [style.left.%]="l.at"
            [class.mid]="l.align === 'mid'"
            [class.end]="l.align === 'end'"
            [class.line-label]="l.line"
            >{{ l.text }}</span
          >
        }
      </div>
      @if (showRuns()) {
        <div class="k runs-k">
          <span class="cap">Score per run</span>
          <span class="small">in order{{ scope() ? ', each opening its run' : '' }}</span>
        </div>
        <div class="v series">
          <i class="hthr" [style.bottom.%]="thr()"></i>
          @for (p of runs(); track p.index) {
            <a class="col" [routerLink]="p.link" [title]="p.title" [attr.aria-label]="p.title">
              @if (p.y != null) {
                <i class="sq" [class.m]="p.met" [style.bottom.%]="p.y"></i>
              }
            </a>
          }
        </div>
        <div></div>
        <div class="scale runs">
          <span>run 1</span>
          <span class="end" style="left: 100%">run {{ series().length }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .plot {
      display: grid;
      grid-template-columns: 150px minmax(0, 1fr);
      column-gap: 20px;
      border-top: 2px solid var(--color-text);
    }
    .k {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      padding: 8px 0;
      border-bottom: 1px solid color-mix(in srgb, var(--color-text) 14%, transparent);
    }
    .kt {
      display: inline-flex;
      align-items: baseline;
      gap: 8px;
    }
    .cap {
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    .small {
      font-size: 12px;
      line-height: 1.45;
      color: var(--color-neutral-600);
    }
    /* A numbered part, when the plot is an example the text beside it explains. */
    .n {
      color: var(--color-accent);
      font-size: 13px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .callout {
      position: absolute;
      top: 4px;
      font-size: 11px;
      font-weight: 800;
      color: var(--color-accent);
      z-index: 3;
    }
    .v {
      position: relative;
      min-height: 56px;
      border-bottom: 1px solid color-mix(in srgb, var(--color-text) 14%, transparent);
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
      width: 6px;
      height: 6px;
      margin-left: -3px;
      background: var(--color-accent);
      display: block;
    }
    .sq.m {
      background: var(--color-status-green);
    }
    .whisk {
      position: absolute;
      top: 50%;
      height: 1px;
      background: var(--color-text);
    }
    .box {
      position: absolute;
      top: 50%;
      height: 22px;
      margin-top: -11px;
      border: 2px solid var(--color-text);
      background: var(--color-bg);
    }
    .med {
      position: absolute;
      top: 50%;
      height: 22px;
      margin-top: -11px;
      width: 3px;
      margin-left: -1.5px;
      background: var(--color-text);
    }
    .bar {
      position: absolute;
      top: 50%;
      height: 4px;
      margin-top: -2px;
      background: var(--color-text);
    }
    .mean {
      position: absolute;
      top: 50%;
      margin-top: -5px;
      margin-left: -5px;
      z-index: 2;
    }
    .v .mean.mark-hollow {
      background: var(--color-bg);
    }
    /* The average, written beside its range - after it, or before it near the right edge. */
    .avg {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      margin-left: 10px;
      display: flex;
      align-items: baseline;
      gap: 8px;
      white-space: nowrap;
    }
    .avg.before {
      transform: translate(-100%, -50%);
      margin-left: -10px;
    }
    .fig {
      font-size: 18px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .scale {
      position: relative;
      height: 28px;
    }
    .tk {
      position: absolute;
      top: 0;
      width: 1px;
      height: 5px;
      background: var(--color-text);
    }
    .scale > span {
      position: absolute;
      top: 9px;
      font-size: 10px;
      color: var(--color-neutral-500);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .scale > span.mid {
      transform: translateX(-50%);
    }
    .scale > span.end {
      transform: translateX(-100%);
    }
    .scale > span.line-label {
      color: var(--color-accent);
      font-weight: 800;
    }
    /* The score axis's labels close the rows above; the score-per-run rows then start anew. */
    .runs-k {
      margin-top: 16px;
      border-top: 2px solid var(--color-text);
    }
    .runs-k + .v {
      margin-top: 16px;
      border-top: 2px solid var(--color-text);
    }
    .v.series {
      height: 150px;
      display: flex;
    }
    .scale.runs > span {
      top: 6px;
    }
    .col {
      flex: 1;
      position: relative;
    }
    .col .sq {
      left: 50%;
      margin-bottom: -3px;
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
  /** Number the parts (1 to 4), for an example the text beside it explains - which then says
   *  what the spread and the average are, so the rows don't. */
  numbered = input(false);
  /** The score of each run, in order, under the rest. */
  showRuns = input(true);
  tenths = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
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
        y: 8 + level * 8,
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
    return Math.max(56, 20 + most * 8);
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
  /** The average and its range, and what the label beside it says: "0.367 at least 0.336 (95%
   *  sure)" - "at most" when lower passes; just the figure when the scores never varied. */
  avg = computed(() => {
    const i = this.interval();
    const s = this.scores();
    if (!s) return null;
    const lo = i?.lower ?? s.mean,
      hi = i?.upper ?? s.mean;
    const mean = i?.point ?? s.mean;
    const lte = this.comparison() === 'lte';
    const bound =
      i && lo !== hi
        ? `${lte ? 'at most' : 'at least'} ${scoreText(lte ? hi : lo)} (${pct(i.level)} sure)`
        : null;
    const left = this.at(lo),
      right = this.at(hi);
    const before = right > 62;
    return {
      lo: left,
      w: right - left,
      mean: this.at(mean),
      value: scoreText(mean),
      bound,
      before,
      labelAt: before ? left : right,
    };
  });
  /** The scale's ends, its middle and the threshold (in red) - a label too near the threshold left
   *  out. */
  scaleLabels = computed(() => {
    const thr = this.thr();
    const out: { at: number; text: string; align: 'start' | 'mid' | 'end'; line?: boolean }[] = [];
    if (thr > 8) out.push({ at: 0, text: String(this.min()), align: 'start' });
    if (Math.abs(thr - 50) >= 10)
      out.push({ at: 50, text: String((this.min() + this.max()) / 2), align: 'mid' });
    if (thr < 92) out.push({ at: 100, text: String(this.max()), align: 'end' });
    out.push({
      at: thr,
      text: String(this.threshold()),
      align: thr <= 3 ? 'start' : thr >= 97 ? 'end' : 'mid',
      line: true,
    });
    return out;
  });
  runs = computed(() =>
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
