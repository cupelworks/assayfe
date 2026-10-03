import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Batch, CheckResult, Comparison, EntryResult, RunCounts } from '../api/models';
import { StatisticalTestsStore, StatisticsApiService } from '../api/statistics-api.service';
import { STATUS, absTime, errText, isInFlight } from '../shared/format';
import { pollWhile } from '../shared/poll';
import { StatusMarkComponent, markLabel } from '../shared/status-mark.component';
import { RunsGridComponent, GridRow } from './charts/runs-grid.component';
import { RunStripComponent, pointText } from './charts/run-strip.component';
import { RangeChartComponent } from './charts/range-chart.component';
import { RateTrendComponent } from './charts/rate-trend.component';
import { ScorePlotComponent } from './charts/score-plot.component';
import { CompareDialogComponent } from './compare-dialog.component';
import {
  pct,
  question,
  ruleText,
  runLink,
  scopeLink,
  scopePlace,
  scopeRef,
  timesRun,
  timesText,
} from './stats-format';
import { ArrowOutComponent } from '../shared/arrow-out.component';

type Filter = 'all' | 'fail' | 'inconclusive' | 'pass' | 'none';
/** Failures first, then what's undecided, then what passed - as on a run's page. */
const RANK: Record<string, number> = { fail: 0, inconclusive: 1, none: 2, pass: 3 };
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'fail', label: 'Failed' },
  { key: 'inconclusive', label: 'Inconclusive' },
  { key: 'none', label: 'No verdict' },
  { key: 'pass', label: 'Passed' },
];
/** The verdict tile's one line, per outcome. */
const OUTCOME_LINE: Record<string, string> = {
  Passed: 'Every check reaches the target.',
  Failed: 'One check that falls short fails the batch.',
  Inconclusive: 'Every run finished, but there weren’t enough runs to tell either way.',
  NotRan: 'No check could be decided: every run Not Ran, or every check errored.',
  Done: 'A trial: it shows how each check behaves, and gives no verdict.',
};

const verdictKey = (c: CheckResult) => c.statistic?.verdict ?? 'none';
/** How long a batch took: "under a minute", "12 min", "2 h 5 min". */
function took(from: string, to: string): string {
  const min = Math.round((+new Date(to) - +new Date(from)) / 60000);
  if (min < 1) return 'under a minute';
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}
/** "121 Green · 23 Amber · 1 Not Ran" - the statuses a set of runs ended in, none left out. */
const runsLine = (runs: RunCounts) =>
  STATUS.filter((s) => runs[s.key])
    .map((s) => `${runs[s.key]} ${s.label}`)
    .join(' · ');

/**
 * One statistics batch: while it runs, its progress, what it has spent and the Stop control -
 * no verdicts until every run has finished, so a lucky start can't be read as a pass; once it
 * has, the verdict per check with the range that decided it, the times as a strip, and on request
 * how the rate built up (or, for scores, every score), each square opening its run.
 */
@Component({
  selector: 'assay-batch',
  standalone: true,
  imports: [
    ArrowOutComponent,
    RouterLink,
    StatusMarkComponent,
    RunsGridComponent,
    RunStripComponent,
    RangeChartComponent,
    RateTrendComponent,
    ScorePlotComponent,
    CompareDialogComponent,
  ],
  templateUrl: './batch.component.html',
  styleUrls: ['../shared/page.css', './stats-page.css', './batch.component.css'],
})
export class BatchComponent {
  id = input.required<string>();
  private api = inject(StatisticsApiService);
  private tests = inject(StatisticalTestsStore);
  private router = inject(Router);
  markLabel = markLabel;
  pct = pct;
  batch = signal<Batch | null>(null);
  loadError = signal<string | null>(null);
  private loading = false;
  confirmingStop = signal(false);
  stopping = signal(false);
  stopError = signal<string | null>(null);
  filter = signal<Filter>('all');
  openKey = signal<string | null>(null);
  dlg = signal<null | 'compare'>(null);

  status = computed(() => this.batch()?.status ?? null);
  timesRun = timesRun;
  inFlight = computed(() => isInFlight(this.status()));
  scope = computed(() => this.batch()?.scope ?? null);
  place = computed(() => {
    const s = this.scope();
    return s ? { ...scopePlace(s.kind), link: scopeLink(s), ref: scopeRef(s) } : null;
  });
  kicker = computed(() => {
    const b = this.batch();
    return b
      ? `Statistics batch · ${question(b.engine, b.parameters, this.testName())}`
      : 'Statistics batch';
  });
  headline = computed(() => {
    const b = this.batch();
    if (!b) return '';
    const p = b.progress;
    if (b.status === 'Pending') return 'Pending: waiting for a worker to start.';
    const w = p.waves;
    // Until there's an answer: between two waves nothing runs while it looks at the results.
    if (b.status === 'Running' && w && !w.closed && !p.runs.Pending && !p.runs.Running)
      return `Running: looking at wave ${w.released}'s results - another wave only if a check still has no answer.`;
    if (b.status === 'Running' && w)
      return `Running: wave ${w.released} of up to ${w.planned} - ${p.times_done} of up to ${p.times_requested} times done.`;
    if (b.status === 'Running')
      return `Running: ${p.times_done} of ${p.times_requested} times done.`;
    return b.summary ?? b.result?.summary ?? markLabel(b.status);
  });
  /** "29 times · 95% sure", and when it ran - the scope is in the crumbs above. */
  facts = computed(() => {
    const b = this.batch();
    if (!b) return null;
    const conf = b.parameters['confidence'];
    const ended = b.completed_at ?? b.stopped_at;
    return {
      line: [timesText(b), conf != null ? `${pct(conf)} sure` : null].filter(Boolean).join(' · '),
      when: absTime(b.created_at) + (ended ? ` · took ${took(b.created_at, ended)}` : ''),
    };
  });
  /** While it runs: how far, what's spent, what Stop would leave unrun. */
  progress = computed(() => {
    const b = this.batch();
    if (!b) return null;
    const p = b.progress;
    const app = p.calls.application,
      judge = p.calls.judge;
    const pending = p.runs.Pending ?? 0,
      running = p.runs.Running ?? 0;
    return {
      donePct: p.times_requested ? (p.times_done / p.times_requested) * 100 : 0,
      times: `${p.times_done} of ${p.waves ? 'up to ' : ''}${p.times_requested} times`,
      runs: `${p.runs_done - p.runs_cancelled} of ${p.runs_total} runs done · ${running} running · ${pending} pending`,
      spent: app.finished + app.in_flight + judge.finished + judge.in_flight,
      spentLine:
        app.planned + judge.planned
          ? `${app.finished + app.in_flight} application, ${judge.finished + judge.in_flight} judge` +
            ` · ${app.in_flight + judge.in_flight} in flight · ${app.planned + judge.planned} planned`
          : 'Nothing to pay for: recorded answers and no judge checks.',
      stopLine:
        `The ${pending} pending run${pending === 1 ? '' : 's'} won’t run${p.waves ? ', and no more waves' : ''}.` +
        (running
          ? ` The ${running} running finish${running === 1 ? 'es' : ''}: already paid for.`
          : ''),
    };
  });
  /** Once finished: the outcome, the checks by verdict, the runs, the calls. */
  outcome = computed(() => {
    const b = this.batch();
    const r = b?.result;
    if (!b || !r) return null;
    const v = r.verdicts;
    const p = b.progress;
    const parts = [
      v['fail'] && `${v['fail']} failed`,
      v['inconclusive'] && `${v['inconclusive']} inconclusive`,
      v['pass'] && `${v['pass']} passed`,
      v['none'] && `${v['none']} without a verdict`,
    ].filter(Boolean);
    return {
      line:
        b.status === 'Incomplete'
          ? `Stopped at ${timesRun(p)} of ${p.waves ? 'up to ' : ''}${p.times_requested} times.`
          : p.waves?.stopped_early
            ? `${OUTCOME_LINE[b.status] ?? ''} Every check had its answer by ${timesRun(p)} of up to ${p.times_requested} times, so it stopped there.`.trim()
            : (OUTCOME_LINE[b.status] ?? ''),
      stack: ['fail', 'inconclusive', 'none', 'pass']
        .filter((k) => v[k])
        .map((k) => ({ key: k, n: v[k] })),
      checks: parts.join(' · '),
      runs: p.runs_total,
      runsLine:
        runsLine(p.runs) +
        (p.runs_cancelled ? ` · ${p.runs_cancelled} of them cancelled by the stop` : ''),
      app: p.calls.application.finished,
      judge: p.calls.judge.finished,
    };
  });
  /** The runs grid: the result's strips once finished, the live ones while running (if sent). */
  grid = computed<GridRow[]>(() => {
    const b = this.batch();
    if (!b) return [];
    // While it runs, the live strips; once the result is stored, the result's.
    const rows = b.result
      ? b.result.entries.filter((e) => e.strip?.length)
      : (b.progress.entries ?? []);
    // In a plan, the set each entry comes from.
    const plan = b.scope.kind === 'test_plan';
    return rows.map((e, i) => ({
      key: `${e.entry_id ?? e.test_id}:${i}`,
      name: e.name,
      sub: plan ? e.test_set_name : null,
      testId: e.test_id,
      strip: e.strip ?? [],
    }));
  });
  isScores = computed(() => this.batch()?.engine === 'one_sample_t');
  /** The catalogue row's name, for an engine with no short question. */
  private testName = computed(() => {
    const b = this.batch();
    return b ? (this.tests.byId().get(b.statistical_test)?.name ?? '') : '';
  });
  /** The rate axis every pass-rate row shares: from 50% - or lower, when a range reaches lower. */
  axisMin = computed(() => {
    const lows = this.allChecks()
      .map((c) => c.statistic?.interval?.lower ?? c.pass_rate?.point)
      .filter((x): x is number => x != null);
    const low = lows.length ? Math.min(...lows) : 0.5;
    return Math.min(0.5, Math.floor(low * 10) / 10);
  });
  axisTicks = computed(() => {
    const min = this.axisMin();
    const step = min <= 0.2 ? 0.25 : 0.1;
    const out: number[] = [];
    for (let t = min; t <= 1.0001; t += step) out.push(Math.round(t * 100) / 100);
    return out;
  });
  private allChecks = computed(() =>
    (this.batch()?.result?.entries ?? []).flatMap((e) => e.checks.filter((c) => c.applies)),
  );
  filters = computed(() => {
    const v = this.batch()?.result?.verdicts ?? {};
    const total = this.allChecks().length;
    return [
      { key: 'all' as Filter, label: `All ${total}` },
      ...FILTERS.filter((f) => v[f.key]).map((f) => ({ ...f, label: `${f.label} ${v[f.key]}` })),
    ].map((f) => ({ ...f, on: this.filter() === f.key }));
  });
  /** Entries worst first, each check's row ready to draw; the ones it doesn't apply to apart. */
  entries = computed(() => {
    const b = this.batch();
    const r = b?.result;
    if (!b || !r) return [];
    const f = this.filter();
    return r.entries
      .map((e) => ({
        e,
        rank: Math.min(...e.checks.filter((c) => c.applies).map((c) => RANK[verdictKey(c)]), 9),
      }))
      .sort((x, y) => x.rank - y.rank)
      .map(({ e }) => this.entryRow(b, e, f))
      .filter((e) => e.checks.length || (f === 'all' && e.skipped.length));
  });
  multiEntry = computed(() => (this.batch()?.result?.entries.length ?? 0) > 1);
  failures = computed(() => {
    const fb = this.batch()?.result?.failures_by_entry;
    if (!fb || !this.multiEntry()) return null;
    const most = Math.max(1, ...fb.entries.map((e) => e.passed + e.failed));
    return {
      ...fb,
      title:
        fb.verdict === 'concentrated'
          ? 'Failures concentrate in some entries'
          : fb.verdict === 'no_evidence'
            ? 'No sign that failures concentrate'
            : 'Where the failures are',
      rows: fb.entries.map((e) => ({
        ...e,
        passW: (e.passed / most) * 100,
        failW: (e.failed / most) * 100,
      })),
    };
  });

  constructor() {
    this.tests.load();
    effect(() => {
      this.id();
      untracked(() => {
        this.batch.set(null);
        this.openKey.set(null);
        this.filter.set('all');
        this.load();
      });
    });
    // Every few seconds while a run is pending or running; a read is cheap until the last run
    // finishes, when the API computes the result once.
    pollWhile(
      () => this.inFlight(),
      () => this.load(),
      3000,
    );
  }

  load() {
    if (this.loading) return;
    this.loading = true;
    this.api.batch(this.id()).subscribe({
      next: (b) => {
        this.loading = false;
        this.loadError.set(null);
        this.batch.set(b);
      },
      error: (e) => {
        this.loading = false;
        this.loadError.set(errText(e));
      },
    });
  }

  stop() {
    this.stopping.set(true);
    this.stopError.set(null);
    this.api.stop(this.id()).subscribe({
      next: (b) => {
        this.stopping.set(false);
        this.confirmingStop.set(false);
        this.batch.set(b);
      },
      error: (e) => {
        this.stopping.set(false);
        this.stopError.set(errText(e));
      },
    });
  }

  toggle(key: string) {
    this.openKey.set(this.openKey() === key ? null : key);
  }

  compared(c: Comparison) {
    this.dlg.set(null);
    this.router.navigate(['/statistics/comparisons', c.id]);
  }

  private entryRow(b: Batch, e: EntryResult, f: Filter) {
    const applying = e.checks.filter((c) => c.applies);
    const tally = (k: string) => applying.filter((c) => verdictKey(c) === k).length;
    const counts = [
      tally('fail') && `${tally('fail')} failed`,
      tally('inconclusive') && `${tally('inconclusive')} inconclusive`,
      tally('none') && `${tally('none')} without a verdict`,
      tally('pass') && `${tally('pass')} passed`,
    ].filter(Boolean);
    return {
      key: `${e.entry_id ?? e.test_id}`,
      name: e.name,
      sub: e.test_set_name,
      summary: `${applying.length} check${applying.length === 1 ? '' : 's'} · ${counts.join(' · ')}`,
      link: e.test_id && b.scope.kind !== 'test' ? ['/tests', e.test_id] : null,
      checks: applying
        .filter((c) => f === 'all' || verdictKey(c) === f)
        .sort((x, y) => RANK[verdictKey(x)] - RANK[verdictKey(y)])
        .map((c) => this.checkRow(b, e, c)),
      skipped: e.checks.filter((c) => !c.applies),
    };
  }

  private checkRow(b: Batch, e: EntryResult, c: CheckResult) {
    const s = c.statistic;
    const key = `${e.entry_id ?? e.test_id}|${c.label}`;
    const v = verdictKey(c);
    const series = c.series ?? [];
    const interval = s?.interval ?? null;
    const scored = b.engine === 'one_sample_t';
    // A scored check is drawn on its own scale; a rate on the axis every rate row shares.
    const scale = scored
      ? {
          min: c.scale?.min ?? Math.min(c.scores?.min ?? 0, c.threshold ?? 0),
          max: c.scale?.max ?? Math.max(c.scores?.max ?? 1, c.threshold ?? 1),
        }
      : { min: this.axisMin(), max: 1 };
    const misses = series.filter((p) => p.passed === false);
    const errors = series.filter((p) => p.passed == null);
    const firstError = errors.find((p) => p.error)?.error ?? null;
    const n = c.counts;
    return {
      key,
      label: c.label,
      type: c.test_type !== c.label ? c.test_type : null,
      open: this.openKey() === key,
      evaluated: `${n.evaluated} of ${n.evaluated + n.errored + n.not_ran}`,
      apart: [n.errored && `${n.errored} errored`, n.not_ran && `${n.not_ran} Not Ran`]
        .filter(Boolean)
        .join(' · '),
      verdict: v,
      word: markLabel(v),
      // The sentence that explains the verdict; when undecided, what would settle it.
      line:
        v === 'inconclusive' ? (s?.times_to_decide_message ?? s?.reason ?? '') : (s?.reason ?? ''),
      chart: {
        min: scale.min,
        max: scale.max,
        lower: interval?.lower ?? null,
        upper: interval?.upper ?? null,
        point: scored
          ? (interval?.point ?? c.scores?.mean ?? null)
          : (interval?.point ?? c.pass_rate?.point ?? null),
        line: scored ? c.threshold : (c.target ?? null),
      },
      // A rate row shares the heading's axis; a score row labels its own scale and threshold.
      ticks: scored ? [scale.min, scale.max] : this.axisTicks(),
      labels: scored
        ? [
            { at: scale.min, text: String(scale.min) },
            ...(c.threshold != null
              ? [{ at: c.threshold, text: String(c.threshold), line: true }]
              : []),
            { at: scale.max, text: String(scale.max) },
          ]
        : [],
      series,
      testId: e.test_id,
      target: c.target,
      threshold: c.threshold,
      comparison: c.comparison,
      scores: c.scores,
      interval,
      reason: s?.reason ?? c.reason ?? '',
      // The maths behind the range (its method, t, p-values) stays in the API: the page says
      // in words what the range is for. Scores that never vary have no range (both bounds at the
      // average): their verdict compared the score to the threshold directly.
      decidedOn:
        interval && interval.lower !== interval.upper
          ? `The verdict was decided on this range (${pct(interval.level)} sure).`
          : null,
      rule: s?.rule
        ? `At ${s.rule.times} times: ${ruleText(s.rule, b.engine === 'judge_stability' || b.engine === 'sequential_judge_stability' ? 'in agreement' : 'met')}`
        : null,
      misses: misses.map((p) => ({ index: p.index, link: runLink(b.scope, p, e.test_id) })),
      errors: errors.length
        ? `${errors.length} time${errors.length === 1 ? '' : 's'} without a value${
            firstError ? ` - ${firstError}` : ''
          }`
        : null,
      errorPoints: errors.map((p) => ({
        index: p.index,
        link: runLink(b.scope, p, e.test_id),
        title: pointText(p),
      })),
    };
  }
}
