// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { CheckComparison, ComparedBatch, Comparison, ScoreSummary } from '../api/models';
import { StatisticalTestsStore, StatisticsApiService } from '../api/statistics-api.service';
import { absTime, errText } from '../shared/format';
import { StatusMarkComponent, markLabel } from '../shared/status-mark.component';
import { RangeChartComponent } from './charts/range-chart.component';
import { DumbbellComponent } from './charts/dumbbell.component';
import { diffCaption, endSentence, pct, points, scopeCrumbs, scoreDecimals } from './stats-format';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { TestTypesStore, scoreScale } from '../api/test-types.store';

/** The verdicts worth reading first: what got worse, then what changed, then the rest. */
const ORDER: Record<string, number> = {
  worse: 0,
  better: 1,
  inconclusive: 2,
  none: 3,
  no_worse: 4,
  no_difference: 5,
};
/** The verdict that means "nothing to see here" - folded until asked for. */
const QUIET = new Set(['no_difference', 'no_worse']);
/** A rounded-up half-width for a symmetric axis around 0. */
const halfWidth = (m: number, step: number) => Math.max(step, Math.ceil(m / step) * step);

/**
 * Two batches of the same scope compared check by check: A (the baseline) against B (the change),
 * each check's two values, B - A with the interval that decides, and the verdict - what got worse
 * first, the checks with no clear difference folded. Paired by entry, the scope's single verdict
 * and every pair. Entries or checks only one batch has are listed under the table.
 */
@Component({
  selector: 'assay-comparison',
  standalone: true,
  imports: [
    RouterLink,
    DecimalPipe,
    GuideHeadComponent,
    StatusMarkComponent,
    RangeChartComponent,
    DumbbellComponent,
  ],
  templateUrl: './comparison.component.html',
  styleUrls: [
    '../shared/page.css',
    '../shared/guide/guide.css',
    './stats-page.css',
    './comparison.component.css',
  ],
})
export class ComparisonComponent {
  id = input.required<string>();
  private api = inject(StatisticsApiService);
  private tests = inject(StatisticalTestsStore);
  /** The check types: a score difference is written to its scale's decimals. */
  private types = inject(TestTypesStore);
  markLabel = markLabel;
  absTime = absTime;
  c = signal<Comparison | null>(null);
  loadError = signal<string | null>(null);
  showQuiet = signal(false);
  /** The pages above it: the scope's list, then the scope - "Comparison" after them. */
  crumbs = computed(() => {
    const s = this.c()?.scope;
    return s ? scopeCrumbs(s) : [];
  });
  /** Under the title: how it compared, how sure, when - "Is it still as good? 95% sure. Compared
   *  3 Oct, 10:47." */
  lede = computed(() => {
    const c = this.c();
    if (!c) return '';
    const name = this.testName(),
      conf = this.conf();
    return [name && endSentence(name), conf && `${conf}.`, `Compared ${absTime(c.created_at)}.`]
      .filter(Boolean)
      .join(' ');
  });
  testName = computed(() => {
    const c = this.c();
    return c ? (this.tests.byId().get(c.statistical_test)?.name ?? c.statistical_test) : '';
  });
  /** Scores (mean, or median for ranks) rather than pass rates. */
  private onScores = computed(() =>
    ['mean_scores', 'score_ranks'].includes(this.c()?.engine ?? ''),
  );
  sides = computed(() => {
    const c = this.c();
    if (!c) return [];
    const side = (b: ComparedBatch, role: string) => ({
      role,
      b,
      when: absTime(b.created_at),
      link: ['/statistics/batches', b.id],
    });
    return [side(c.batch_a, 'A · the baseline'), side(c.batch_b, 'B · the change')];
  });
  /** A tile per outcome this comparison can give (its test's own words), and "No verdict" when
   *  some check got none. */
  tiles = computed(() => {
    const c = this.c();
    if (!c) return [];
    const v = c.result.verdicts;
    const words = this.tests.byId().get(c.statistical_test)?.verdicts ?? Object.keys(v);
    return [...words, ...(v['none'] ? ['none'] : [])]
      .sort((x, y) => (ORDER[x] ?? 9) - (ORDER[y] ?? 9))
      .map((k) => ({ key: k, label: markLabel(k), n: v[k] ?? 0 }));
  });
  conf = computed(() => {
    const x = this.c()?.parameters['confidence'];
    return x != null ? `${pct(x)} sure` : '';
  });
  /** Every check's row; the quiet ones folded unless shown. */
  rows = computed(() => {
    const c = this.c();
    if (!c) return [];
    const many = c.result.entries.length > 1;
    const all = c.result.entries.flatMap((e) =>
      e.checks.map((k) =>
        this.row(c, k, many ? e.name : null, `${e.entry_id ?? e.test_id}|${k.label}`),
      ),
    );
    return all.sort((x, y) => (ORDER[x.verdict] ?? 9) - (ORDER[y.verdict] ?? 9));
  });
  quietCount = computed(() => this.rows().filter((r) => QUIET.has(r.verdict)).length);
  /** Nothing to fold when every check is quiet: then they're the whole answer. */
  foldable = computed(() => this.quietCount() > 0 && this.quietCount() < this.rows().length);
  shownRows = computed(() =>
    this.showQuiet() || !this.foldable()
      ? this.rows()
      : this.rows().filter((r) => !QUIET.has(r.verdict)),
  );
  /** The value axis of the A → B column: pass rates 0-100%, or the scores' own range. */
  valueAxis = computed(() => {
    if (!this.onScores()) return { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], pct: true };
    const all = (this.c()?.result.entries ?? []).flatMap((e) =>
      e.checks.flatMap((k) => [k.a.scores, k.b.scores].filter((s): s is ScoreSummary => !!s)),
    );
    const min = Math.min(0, ...all.map((s) => s.min));
    const max = Math.max(1, ...all.map((s) => s.max));
    return { min, max, ticks: [min, (min + max) / 2, max], pct: false };
  });
  /** The B - A axis: symmetric around 0, wide enough for every interval (and the margin). */
  diffAxis = computed(() => {
    const c = this.c();
    const margin = c?.parameters['margin'] ?? 0;
    const ends = (c?.result.entries ?? []).flatMap((e) =>
      e.checks.flatMap((k) => [k.difference?.lower ?? 0, k.difference?.upper ?? 0]),
    );
    const scores = this.onScores();
    const m = halfWidth(Math.max(margin, ...ends.map(Math.abs)), scores ? 0.05 : 0.1);
    return { min: -m, max: m, ticks: [-m, -m / 2, 0, m / 2, m], scores };
  });
  paired = computed(() => {
    const p = this.c()?.result.paired;
    if (!p) return null;
    return {
      ...p,
      pairs: p.pairs.map((x) => ({
        ...x,
        cls: x.rate_b > x.rate_a ? 'better' : x.rate_b < x.rate_a ? 'worse' : 'no_difference',
        text: `${pct(x.rate_a)} → ${pct(x.rate_b)} (${points(x.difference)} points)`,
      })),
    };
  });

  constructor() {
    this.tests.load();
    this.types.load();
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.c.set(null);
        this.api.comparison(id).subscribe({
          next: (c) => this.c.set(c),
          error: (e) => this.loadError.set(errText(e)),
        });
      });
    });
  }

  private row(c: Comparison, k: CheckComparison, entry: string | null, key: string) {
    const scores = this.onScores();
    const value = (s: { pass_rate: any; scores?: ScoreSummary | null }) =>
      scores
        ? ((c.engine === 'score_ranks' ? s.scores?.median : s.scores?.mean) ?? null)
        : (s.pass_rate?.point ?? null);
    const a = value(k.a),
      b = value(k.b);
    const verdict = k.verdict ?? 'none';
    const fmt = (x: number | null) => (x == null ? '-' : scores ? String(x) : pct(x));
    return {
      key,
      label: k.label,
      type: k.test_type !== k.label ? k.test_type : null,
      entry,
      verdict,
      word: markLabel(verdict),
      reason: k.reason,
      decide: k.times_to_decide_message,
      values: `${fmt(a)} → ${fmt(b)}`,
      a,
      b,
      diff: k.difference,
      effect: k.effect ?? null,
      // Under B − A: the change in bold, then its range; for score ranks, how often B beats A.
      diffCap:
        k.difference?.point != null
          ? diffCaption(
              k.difference.point,
              k.difference.lower,
              k.difference.upper,
              scores,
              scoreDecimals(scoreScale(this.types.byName().get(k.test_type))),
            )
          : k.effect != null
            ? { main: '', rest: `B beats A ${pct(k.effect)} of the time` }
            : null,
      counts: `${k.a.counts.evaluated} vs ${k.b.counts.evaluated} evaluated`,
    };
  }
}
