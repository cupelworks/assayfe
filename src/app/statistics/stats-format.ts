import {
  BatchSummary,
  GateRule,
  Outlook,
  SizeSuggestion,
  StatisticalEngine,
  StatsScope,
  StatsScopeKind,
  StatsScopeRef,
} from '../api/models';
import { isInFlight } from '../shared/format';
import { GuideCrumb } from '../shared/guide/breadcrumb.component';
import { markLabel } from '../shared/status-mark.component';

/** 0.9019 → "90.2%", 1 → "100%": a share of 1 as a percentage, to one decimal when it has one. */
export function pct(x: number | null | undefined): string {
  if (x == null) return '-';
  const v = Math.round(x * 1000) / 10;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}
/** A difference of two rates in percentage points, signed: "+34.5", "-8.2", "0". */
export function points(x: number): string {
  const v = Math.round(x * 1000) / 10;
  const s = Math.abs(v).toFixed(1);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : '0.0';
}

/** How many decimals a score difference gets, from its scale: 3 on a 0-1 metric, 1 on BLEU's
 *  0-100 (3 when the scale isn't known). */
export const scoreDecimals = (scale: { min: number; max: number } | null) =>
  scale ? Math.max(0, 3 - Math.round(Math.log10(scale.max - scale.min))) : 3;

/** A difference of scores to a given number of decimals, signed with a true minus: 0.05 at 3 →
 *  "+0.050", −1.2 at 1 → "−1.2". */
export function signedScore(x: number, decimals = 3): string {
  const v = Number(x.toFixed(decimals));
  const s = Math.abs(v).toFixed(decimals);
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : (0).toFixed(decimals);
}

/** B − A as a comparison's row writes it under its range: the change (set in bold), then the
 *  range, all three at one precision - "−27.6" + " points · −46.0 to −8.2" for pass rates (one
 *  decimal: percentage points), "+0.050" + " · −0.010 to +0.110" for scores (the decimals of
 *  their scale). */
export function diffCaption(
  d: number,
  lo: number | null,
  hi: number | null,
  scores: boolean,
  decimals = 3,
) {
  const f = scores ? (x: number) => signedScore(x, decimals) : points;
  const range = lo != null && hi != null ? ` · ${f(lo)} to ${f(hi)}` : '';
  return { main: f(d), rest: (scores ? '' : ' points') + range };
}

/** A rate the way people say it, worded as the API's sentences word it: 0.9 → "9 times in 10",
 *  0.95 → "19 times in 20", 0.999 → "999 times in 1000"; "87% of the time" when no small count
 *  fits. */
export function often(rate: number): string {
  for (const outOf of [10, 20, 100, 1000]) {
    const count = Math.round(rate * outOf);
    if (Math.abs(rate * outOf - count) < 1e-9 && count > 0 && count <= outOf) {
      return `${count} times in ${outOf}`;
    }
  }
  return `${pct(rate)} of the time`;
}

/** A target, short: 0.9 → "9 in 10", 0.85 → "17 in 20", 0.875 → "87.5%". */
export function inTen(rate: number): string {
  const o = often(rate);
  return o.endsWith(' of the time') ? pct(rate) : o.replace(' times in ', ' in ');
}

/** How sure, as how rarely it's wrong: 0.95 → 20, for "wrong at most 1 time in 20". */
export function oneIn(confidence: number): number {
  return confidence >= 1 ? 0 : Math.round(1 / (1 - confidence));
}

/** An API sentence cut to its first clause - its first sentence, less what follows a dash or a
 *  colon: "Does each check pass almost every time?", "None of these checks gives a score." */
export function firstClause(text: string): string {
  const first = text.match(/^.*?[.?!](?=\s|$)/)?.[0] ?? text;
  return first.split(/ — |: /)[0].replace(/[.?!]$/, '') + (first.endsWith('?') ? '?' : '.');
}

/** A chance of an answer, as a whole percent: 0.6624 → "66%". Never "100%" unless certain, never
 *  "0%" unless impossible. */
export function chanceText(x: number): string {
  if (x >= 1) return '100%';
  if (x > 0 && x < 0.005) return 'under 1%';
  return `${Math.min(99, Math.round(x * 100))}%`;
}

/** How each check looks against its target, in words - the API's `outlook`. */
export const OUTLOOK: Record<Outlook, string> = {
  likely_pass: 'Likely to pass',
  likely_fail: 'Likely to fail',
  too_close: 'Too close to call',
  unknown: 'Unknown',
  certain: 'Certain',
};

/** "no failure allowed", "one failure allowed", "11 failures allowed". */
export const failuresText = (n: number) =>
  n === 0 ? 'no failure allowed' : n === 1 ? 'one failure allowed' : `${n} failures allowed`;

/** What a suggested size is for, under its number: from its kind, or the API's own caption (less
 *  its leading "29 times · ") for a kind this doesn't word. `fixed` when "until there's an answer"
 *  is offered beside it: "the suggested fixed size", "the best any fixed size gets". */
export function sizeWhat(s: SizeSuggestion, fixed = false): string {
  const fails = s.failures_allowed != null ? failuresText(s.failures_allowed) : null;
  const size = fixed ? 'fixed size' : 'size';
  const own: Partial<Record<SizeSuggestion['kind'], string>> = {
    floor: 'the minimum',
    reaches_goal: 'reaches the goal',
    worth_its_cost: `the suggested ${size}: within 5 points of the best`,
    best_chance: `the best any ${size} gets`,
  };
  const what = own[s.kind] ?? s.label.replace(/^\d+ times? · /, '');
  return own[s.kind] && fails ? `${what} · ${fails}` : what;
}

/** The engines that run until there's an answer: in waves, up to a maximum. */
export const runsInWaves = (engine: StatisticalEngine) =>
  engine === 'sequential_gate' ||
  engine === 'sequential_judge_stability' ||
  engine === 'sequential_t';

/** The engines that judge an average score - at a fixed size, or until there's an answer. */
export const readsScores = (engine: StatisticalEngine) =>
  engine === 'one_sample_t' || engine === 'sequential_t';

/** The question a batch answers, short: the kicker of its page and its line in lists - by its
 *  engine; `name` (the catalogue row's) for an engine with no short question. */
export function question(
  engine: StatisticalEngine,
  params: Record<string, number>,
  name = '',
): string {
  switch (engine) {
    case 'binomial_gate':
      return `Passes at least ${often(params['target'])}?`;
    case 'judge_stability':
      return `Does the judge agree with itself at least ${often(params['target'])}?`;
    case 'sequential_gate':
      return `Passes at least ${often(params['target'])}? Until there's an answer`;
    case 'sequential_judge_stability':
      return `Does the judge agree with itself at least ${often(params['target'])}? Until there's an answer`;
    case 'one_sample_t':
      return 'Is the average score on the passing side of the threshold?';
    case 'sequential_t':
      return "Is the average score on the passing side of the threshold? Until there's an answer";
    default:
      return name || engine;
  }
}

/** The times a batch ran, or is running - for one that runs until there's an answer, up to the
 *  end of its last wave released (`times_requested` is its maximum). */
export function timesRun(p: BatchSummary['progress']): number {
  const w = p.waves;
  return (w ? (w.looks[w.released - 1] ?? 0) : p.times_requested) - p.times_cancelled;
}

/** "29 times", or how far a stopped batch got: "stopped at 12 of 29 times"; until there's an
 *  answer, "up to 750 times" while it runs, then "143 of up to 750 times" when it stopped early,
 *  or "750 times, the most it could run". */
export function timesText(b: Pick<BatchSummary, 'status' | 'progress'>): string {
  const p = b.progress;
  const ran = timesRun(p);
  if (p.waves) {
    const max = p.times_requested;
    if (b.status === 'Incomplete') return `stopped at ${ran} of up to ${max} times`;
    if (!p.waves.closed) return `up to ${max} times`;
    return p.waves.stopped_early
      ? `${ran} of up to ${max} times`
      : `${ran} times, the most it could run`;
  }
  return b.status === 'Incomplete'
    ? `stopped at ${ran} of ${p.times_requested} times`
    : `${p.times_requested} time${p.times_requested === 1 ? '' : 's'}`;
}

/** How many times, as a table's figure: the times it ran - "211 of 300" for one stopped before
 *  the end (Incomplete) - or, while it runs, the times asked for. */
export function timesFigure(b: Pick<BatchSummary, 'status' | 'progress'>): string {
  const p = b.progress;
  if (isInFlight(b.status)) return String(p.times_requested);
  const ran = timesRun(p);
  return b.status === 'Incomplete' ? `${ran} of ${p.times_requested}` : String(ran);
}

/** How far a running batch is: the share of its times done, and "18 of 45 times done · 36 of 90
 *  runs" ("of up to" for one that runs until there's an answer). */
export function batchProgress(p: BatchSummary['progress']) {
  return {
    donePct: p.times_requested ? Math.round((p.times_done / p.times_requested) * 100) : 0,
    line: `${p.times_done} of ${p.waves ? 'up to ' : ''}${p.times_requested} times done · ${p.runs_done} of ${p.runs_total} runs`,
  };
}

/**
 * A batch's verdict as a list's row says it: its word ("Failed") and the rest of the API's
 * sentence ("the check fell short of the goal.") - or, while it runs, how far it got.
 */
export function verdictLine(b: BatchSummary) {
  const label = markLabel(b.status);
  const sentence = (isInFlight(b.status) ? batchProgress(b.progress).line : b.summary) ?? '';
  // The API's sentence leads with the verdict ("Failed: …"), which the row shows in bold.
  return {
    label,
    text: sentence.startsWith(label + ': ') ? sentence.slice(label.length + 2) : sentence,
  };
}

/** How often a page re-reads a batch, or a list of batches, while one is still pending or running:
 *  a read is cheap until the last run finishes, when the API computes the result once. */
export const BATCH_POLL_MS = 3000;

/** A scope's place in the app: its list (for crumbs) and its page, and what one is called. */
const SCOPE_PLACES: Record<
  StatsScopeKind,
  { list: string; label: string; noun: string; one: string }
> = {
  test: { list: '/tests', label: 'Tests', noun: 'test', one: 'Test' },
  test_set: { list: '/test-sets', label: 'Test sets', noun: 'set', one: 'Test set' },
  test_plan: { list: '/test-plans', label: 'Test plans', noun: 'plan', one: 'Test plan' },
};
export const scopePlace = (kind: StatsScopeKind) => SCOPE_PLACES[kind];
export const scopeLink = (s: StatsScope) => [SCOPE_PLACES[s.kind].list, s.id];
/** The pages above a batch, a comparison or Run with statistics: the scope's list, then the scope
 *  by its name ("Tests / Password Reset Instructions"). */
export const scopeCrumbs = (s: StatsScope): GuideCrumb[] => [
  { label: SCOPE_PLACES[s.kind].label, link: SCOPE_PLACES[s.kind].list },
  { label: s.name, link: scopeLink(s) },
];
/** Words that end a sentence as they are ("…time?"), else with a full stop: a batch's question can
 *  end in "?", in "Until there's an answer", or be a statistical test's name. */
export const endSentence = (s: string) => (/[.?!]$/.test(s) ? s : `${s}.`);
/** "Run again ↗": the scope's Run with statistics page - with `?from=` the batch it starts from. */
export const runAgainLink = (s: StatsScope) => [
  SCOPE_PLACES[s.kind].list,
  s.id,
  'run-with-statistics',
];
export const scopeRef = (s: StatsScope): StatsScopeRef =>
  s.kind === 'test'
    ? { test_id: s.id }
    : s.kind === 'test_set'
      ? { test_set_id: s.id }
      : { test_plan_id: s.id };

/** The page of one run of a batch - where a square of a strip or a point of a series leads. */
export function runLink(
  s: StatsScope,
  p: { run_id: string; execution_id: string | null },
  testId?: string | null,
): any[] {
  if (s.kind === 'test') return ['/tests', testId ?? s.id, 'runs', p.run_id];
  const kind = s.kind === 'test_set' ? 'test-sets' : 'test-plans';
  return ['/', kind, s.id, 'executions', p.execution_id, 'runs', p.run_id];
}

/** What a verdict takes at this size, in words: "Passed only when met all 29 times. Failed when
 *  met 22 times or fewer, Inconclusive from 23 to 28." `what` is what a time counts as: "met" for
 *  the gate, "in agreement" for judge stability. */
export function ruleText(r: GateRule, what = 'met'): string {
  const pass =
    r.pass_at_least == null
      ? 'Can’t be Passed at this size'
      : r.pass_at_least === r.times
        ? `Passed only when ${what} all ${r.times} times`
        : `Passed when ${what} at least ${r.pass_at_least} of ${r.times} times`;
  const fail =
    r.fail_at_most == null
      ? 'Can’t be Failed at this size'
      : `Failed when ${what} ${r.fail_at_most} times or fewer`;
  const mid =
    r.pass_at_least != null && r.fail_at_most != null && r.pass_at_least - r.fail_at_most > 1
      ? `, Inconclusive from ${r.fail_at_most + 1} to ${r.pass_at_least - 1}`
      : '';
  return `${pass}. ${fail}${mid}.`;
}
