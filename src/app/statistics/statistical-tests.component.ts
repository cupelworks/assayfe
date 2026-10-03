import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { StatisticalEngine, StatisticalTest } from '../api/models';
import { StatisticalTestsStore } from '../api/statistics-api.service';
import { StatusMarkComponent, markLabel } from '../shared/status-mark.component';
import { ChevronComponent } from '../shared/chevron.component';
import { ChartGuideComponent, CHART_SECTIONS, chartAnchor } from './chart-guide.component';
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
const READS: Record<StatisticalTest['reads'], string> = {
  pass_fail: 'pass / fail',
  scores: 'scores',
};
const APPLIES: Record<StatisticalTest['applies_to'], string> = {
  every_check: 'every check',
  scored_checks: 'scored checks',
  judge_checks: 'judge checks',
};
/** The charts each engine's results are read on - the guide's sections. */
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
 * The statistical tests a batch can run or two batches can be compared with - the API's catalogue,
 * a table like the check types - each with its question, the verdicts it gives, how many times it
 * needs (with the API's worked examples), its parameters and method; then how to read the charts
 * their results are drawn with. A link with a test's id as its fragment opens that card (the run
 * dialog's "About this test"); `#charts` and `#chart-<section>` land on the guide.
 */
@Component({
  selector: 'assay-statistical-tests',
  standalone: true,
  imports: [RouterLink, StatusMarkComponent, ChevronComponent, ChartGuideComponent],
  templateUrl: './statistical-tests.component.html',
  styleUrls: ['../shared/page.css', '../shared/catalog.css', './statistical-tests.component.css'],
})
export class StatisticalTestsComponent {
  store = inject(StatisticalTestsStore);
  private fragment = toSignal(inject(ActivatedRoute).fragment, { initialValue: null });
  markLabel = markLabel;
  kind = signal<Kind | null>(null);
  openId = signal<string | null>(null);
  /** The open card whose "How is this calculated?" is open - closed again on another card. */
  calcOpenId = signal<string | null>(null);

  tiles = computed(() =>
    KINDS.map((k) => ({ ...k, n: this.store.items().filter((t) => t.kind === k.key).length })),
  );
  groups = computed(() =>
    KINDS.filter((k) => !this.kind() || this.kind() === k.key).map((k) => ({
      ...k,
      tests: this.store
        .items()
        .filter((t) => t.kind === k.key)
        .map((t) => this.card(t)),
    })),
  );

  constructor() {
    this.store.load();
    // A link's fragment, once the catalogue is in: open that test's card, or land on the guide.
    effect(() => {
      const f = this.fragment();
      if (!f || !this.store.items().length) return;
      untracked(() => this.scrollTo(f));
    });
  }

  toggleKind(k: Kind) {
    this.kind.set(this.kind() === k ? null : k);
  }
  toggle(id: string) {
    this.openId.set(this.openId() === id ? null : id);
  }
  toggleCalc(id: string) {
    this.calcOpenId.set(this.calcOpenId() === id ? null : id);
  }
  /** Scroll to a test's card (opening it) or a guide section, once the page has rendered it. */
  scrollTo(id: string) {
    if (this.store.byId().has(id)) {
      this.kind.set(null);
      this.openId.set(id);
    }
    setTimeout(() => document.getElementById(id)?.scrollIntoView());
  }

  private card(t: StatisticalTest) {
    const ex = t.floor.examples;
    const keys = ex.length ? Object.keys(ex[0]) : [];
    return {
      id: t.id,
      name: t.name,
      question: t.question,
      tags: [READS[t.reads] ?? t.reads, APPLIES[t.applies_to] ?? t.applies_to],
      floorTag: floorTag(t),
      verdicts: t.verdicts,
      open: this.openId() === t.id,
      floor: t.floor.explanation,
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
      calcOpen: this.calcOpenId() === t.id,
      charts: (CHARTS[t.engine] ?? [])
        .map((id) => CHART_SECTIONS.find((s) => s.id === id))
        .filter((s) => !!s)
        .map((s) => ({ label: s.label, anchor: chartAnchor(s.id) })),
    };
  }
}
