import {
  BatchSummary,
  GateRule,
  StatisticalEngine,
  StatsScope,
  StatsScopeKind,
  StatsScopeRef,
} from '../api/models';

/** 0.9019 → "90.2%", 1 → "100%": a share of 1 as a percentage, to one decimal when it has one. */
export function pct(x: number | null | undefined): string {
  if (x == null) return '-';
  const v = Math.round(x * 1000) / 10;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}
/** A difference of two rates in percentage points, signed: "+34.5", "-8.2", "0". */
export function points(x: number): string {
  const v = Math.round(x * 1000) / 10;
  return v > 0 ? `+${v}` : `${v}`;
}

/** The question a batch answers, short: the kicker of its page and its line in lists - by its
 *  engine; `name` (the catalogue row's) for an engine with no short question. */
export function question(
  engine: StatisticalEngine,
  params: Record<string, number>,
  name = '',
): string {
  switch (engine) {
    case 'binomial_gate':
      return `Passes at least ${pct(params['target'])} of the time?`;
    case 'judge_stability':
      return `Does the judge agree with itself at least ${pct(params['target'])} of the time?`;
    case 'one_sample_t':
      return 'Is the average score on the passing side of the threshold?';
    default:
      return name || engine;
  }
}

/** "29 times", or how far a stopped batch got: "stopped at 12 of 29 times". */
export function timesText(b: Pick<BatchSummary, 'status' | 'progress'>): string {
  const p = b.progress;
  const ran = p.times_requested - p.times_cancelled;
  return b.status === 'Incomplete'
    ? `stopped at ${ran} of ${p.times_requested} times`
    : `${p.times_requested} time${p.times_requested === 1 ? '' : 's'}`;
}

/** A scope's place in the app: its list (for crumbs) and its page. */
const SCOPE_PLACES: Record<StatsScopeKind, { list: string; label: string; noun: string }> = {
  test: { list: '/tests', label: 'Tests', noun: 'test' },
  test_set: { list: '/test-sets', label: 'Test sets', noun: 'set' },
  test_plan: { list: '/test-plans', label: 'Test plans', noun: 'plan' },
};
export const scopePlace = (kind: StatsScopeKind) => SCOPE_PLACES[kind];
export const scopeLink = (s: StatsScope) => [SCOPE_PLACES[s.kind].list, s.id];
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
      ? 'Failed can’t be proven at this size'
      : `Failed when ${what} ${r.fail_at_most} times or fewer`;
  const mid =
    r.pass_at_least != null && r.fail_at_most != null && r.pass_at_least - r.fail_at_most > 1
      ? `, Inconclusive from ${r.fail_at_most + 1} to ${r.pass_at_least - 1}`
      : '';
  return `${pass}. ${fail}${mid}.`;
}
