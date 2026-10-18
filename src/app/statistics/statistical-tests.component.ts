// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { StatisticalEngine, StatisticalTest } from '../api/models';
import { StatisticalTestsStore } from '../api/statistics-api.service';
import { StatusMarkComponent, markLabel } from '../shared/status-mark.component';
import { ChevronComponent } from '../shared/chevron.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { numbered } from '../shared/guide/guide-sections';
import {
  CATALOG,
  CatalogColumn,
  CatalogIndexLink,
  CatalogKeyItem,
  CatalogTag,
} from '../shared/catalog';
import { OpenOne } from '../shared/open-one';
import { TextFilter } from '../shared/text-filter';
import { counted } from '../shared/format';
import { CHART_SECTIONS, chartAnchor } from '../charts/chart-sections';
import { shownValue } from './stats-params';
import { pct, runsInWaves } from './stats-format';

type Kind = StatisticalTest['kind'];
const KINDS: { key: Kind; label: string; blurb: string }[] = [
  {
    key: 'batch',
    label: 'Decide a batch',
    blurb: 'Run many times, then a verdict per check: Passed, Failed or Inconclusive.',
  },
  {
    key: 'comparison',
    label: 'Compare two batches',
    blurb: 'Did a change help? Better, worse, or no clear difference - check by check.',
  },
];
/** The kinds as the page's sections: numbered 01-02, anchored `kind-<key>`. */
const SECTIONS = numbered(
  'kind-',
  KINDS.map((k) => ({ id: k.key, label: k.label })),
);
const KEY: CatalogKeyItem[] = [
  { tag: { text: 'pass / fail' }, text: 'what it reads per run' },
  { tag: { text: 'scored checks' }, text: 'which checks get a verdict' },
  { tag: { text: 'from 29 times', look: 'figure' }, text: 'the fewest times, at its defaults' },
];
const COLUMNS: CatalogColumn[] = [
  { label: 'Test', width: 2 },
  { label: 'What it asks', width: 3.5 },
  { label: 'Answers', width: 2 },
  { label: 'Fewest times', width: 1.5 },
];
const CHARTS_LINK: CatalogIndexLink = {
  label: 'How to read the charts',
  blurb:
    'The range, the strip, the runs grid, the met rate over time, scores, A against B - what each shows, and how a verdict reads off it.',
  text: 'Open →',
  link: '/charts',
};
const READS: Record<StatisticalTest['reads'], string> = {
  pass_fail: 'pass / fail',
  scores: 'scores',
};
const APPLIES: Record<StatisticalTest['applies_to'], string> = {
  every_check: 'every check',
  scored_checks: 'scored checks',
  judge_checks: 'judge checks',
};
/** The charts each engine's results are read on - the Charts page's sections. */
const CHARTS: Record<StatisticalEngine, string[]> = {
  binomial_gate: ['range', 'strip', 'trend', 'grid'],
  judge_stability: ['range', 'strip', 'grid'],
  one_sample_t: ['scores', 'strip', 'grid'],
  pass_rates: ['compare'],
  no_worse: ['compare'],
  mean_scores: ['compare', 'scores'],
  score_ranks: ['compare', 'scores'],
  paired_entries: ['compare'],
  trial: ['range', 'strip', 'trend', 'grid'],
  sequential_gate: ['range', 'strip', 'trend', 'grid'],
  sequential_judge_stability: ['range', 'strip', 'grid'],
  sequential_t: ['scores', 'strip', 'grid'],
};
/** The worked examples' columns, by key; shares of 1 read as percentages. */
const EXAMPLE_COLUMNS: Record<string, string> = {
  target: 'Target',
  confidence: 'How sure',
  rate_a: 'A',
  rate_b: 'B',
  margin: 'Margin',
  difference: 'Gap',
  spread: 'Spread',
  times: 'Times',
  pairs: 'Pairs',
};
const SHARE_OF_ONE = new Set(['target', 'confidence', 'rate_a', 'rate_b']);
const exampleValue = (key: string, v: number) =>
  SHARE_OF_ONE.has(key) ? pct(v) : key === 'margin' ? `${Math.round(v * 100)} points` : String(v);

/** The fewest times at the test's defaults, for its tag: its own floor, else the worked example
 *  at its default parameters, else the size it's comfortable at. */
function floorTag(t: StatisticalTest): string {
  // Until there's an answer: its size is the maximum you set; it stops once every check has one.
  if (runsInWaves(t.engine)) return 'runs in waves';
  if (t.floor.kind === 'none') return 'no minimum';
  const own = t.engine_settings['floor'];
  if (typeof own === 'number') return `from ${own} times`;
  const defaults = Object.fromEntries(t.parameters.map((p) => [p.key, p.default]));
  const atDefaults = t.floor.examples.find((e) =>
    Object.entries(e).every(([k, v]) => !(k in defaults) || defaults[k] === v),
  );
  if (atDefaults?.['times'] != null) return `from ${atDefaults['times']} times`;
  if (atDefaults?.['pairs'] != null) return `from ${atDefaults['pairs']} pairs`;
  if (t.recommended_times) return `about ${t.recommended_times} times`;
  return t.floor.kind === 'exact' ? 'exact floor' : 'rule of thumb';
}

/**
 * The statistical tests a batch can run or two batches can be compared with - the API's catalogue -
 * laid out like Test types, on the Guide's layout (`shared/guide`, `shared/catalog`): a key to the
 * tags, an index of the two kinds - a tile shows only its kind - and a link to Charts, a filter;
 * then a section per kind, its tests in a ruled table: the question, the verdicts it gives, the
 * fewest times. A row opens for how many times it needs (with the API's worked examples), its parameters,
 * the Charts sections its results are read on, and - asked for - its method. A link with a test's
 * id as its fragment opens that row (the compare dialog's "About this test").
 */
@Component({
  selector: 'assay-statistical-tests',
  standalone: true,
  imports: [
    RouterLink,
    StatusMarkComponent,
    ChevronComponent,
    GuideHeadComponent,
    GuideSectionComponent,
    CATALOG,
  ],
  templateUrl: './statistical-tests.component.html',
  styleUrls: [
    '../shared/guide/guide.css',
    '../shared/catalog/catalog.css',
    './statistical-tests.component.css',
  ],
})
export class StatisticalTestsComponent {
  store = inject(StatisticalTestsStore);
  private fragment = toSignal(inject(ActivatedRoute).fragment, { initialValue: null });
  markLabel = markLabel;
  key = KEY;
  columns = COLUMNS;
  chartsLink = CHARTS_LINK;
  kind = signal<string | null>(null);
  filter = new TextFilter<StatisticalTest>(
    (t) => `${t.name} ${t.question} ${READS[t.reads]} ${APPLIES[t.applies_to]}`,
  );
  open = new OpenOne();
  /** The open row whose "How is this calculated?" is open - closed again on another row. */
  calc = new OpenOne();

  /** A tile per kind, with how many tests it holds. */
  index = computed(() =>
    KINDS.map((k, i) => ({
      key: k.key,
      no: SECTIONS[i].no,
      label: k.label,
      blurb: k.blurb,
      count: this.store.items().filter((t) => t.kind === k.key).length,
    })),
  );
  /** The kinds shown - only the selected tile's, when one is - with their tests that pass the
   *  filter. */
  groups = computed(() =>
    KINDS.map((k, i) => ({ k, section: SECTIONS[i] }))
      .filter(({ k }) => !this.kind() || this.kind() === k.key)
      .map(({ k, section }) => {
        const tests = this.filter
          .apply(this.store.items().filter((t) => t.kind === k.key))
          .map((t) => this.row(t));
        return {
          key: k.key,
          section,
          label: k.label,
          sub: counted(tests.length, 'test'),
          tests,
          empty: tests.length ? null : 'No tests of this kind match the filter.',
        };
      }),
  );
  total = computed(() => this.groups().reduce((n, g) => n + g.tests.length, 0));

  constructor() {
    this.store.load();
    // A link's fragment, once the catalogue is in: open that test's row.
    effect(() => {
      const f = this.fragment();
      if (!f || !this.store.items().length) return;
      untracked(() => this.scrollTo(f));
    });
  }

  /** Open a test's row and scroll to it, once the page has rendered it. */
  scrollTo(id: string) {
    if (!this.store.byId().has(id)) return;
    this.kind.set(null);
    this.filter.query.set('');
    this.open.open(id);
    setTimeout(() => document.getElementById(id)?.scrollIntoView());
  }

  private row(t: StatisticalTest) {
    const ex = t.floor.examples;
    const keys = ex.length ? Object.keys(ex[0]) : [];
    return {
      id: t.id,
      name: t.name,
      question: t.question,
      tags: [READS[t.reads] ?? t.reads, APPLIES[t.applies_to] ?? t.applies_to].map(
        (text): CatalogTag => ({ text }),
      ),
      floor: { text: floorTag(t), look: 'figure' } as CatalogTag,
      verdicts: t.verdicts,
      explanation: t.floor.explanation,
      examples: keys.length
        ? {
            head: keys.map((k) => EXAMPLE_COLUMNS[k] ?? k),
            rows: ex.map((e) => keys.map((k) => exampleValue(k, e[k]))),
          }
        : null,
      params: t.parameters.map((p) => {
        const unit = p.kind === 'share' ? '' : '%';
        return {
          label: p.label,
          range: `${shownValue(p, p.default)}${unit} · from ${shownValue(p, p.min)}${unit} to ${shownValue(p, p.max)}${unit}`,
          hint: p.hint,
        };
      }),
      method: t.method,
      charts: (CHARTS[t.engine] ?? [])
        .map((id) => CHART_SECTIONS.find((s) => s.id === id))
        .filter((s) => !!s)
        .map((s) => ({ label: s.label, anchor: chartAnchor(s.id) })),
    };
  }
}
