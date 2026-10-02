import { StatisticalTest, StatisticalTestParameter } from '../api/models';
import { parseDecimal } from '../shared/number';
import { errText } from '../shared/format';

/** Shares of 1 (`rate`, `level`) are typed as percentages; a `share` of a score range as is. */
const asPercent = (p: StatisticalTestParameter) => p.kind !== 'share';
/** A value as the field shows it: 0.9 → "90" for a percentage. */
export const shownValue = (p: StatisticalTestParameter, v: number) =>
  String(asPercent(p) ? Math.round(v * 1000) / 10 : v);
/** The presets offered beside a percentage, within its range. */
const PRESETS: Record<string, number[]> = {
  rate: [0.8, 0.9, 0.95, 0.99],
  level: [0.9, 0.95, 0.99],
};

function issue(p: StatisticalTestParameter, text: string): string | null {
  const n = parseDecimal(text);
  if (n == null) return 'must be a number';
  const unit = asPercent(p) ? '%' : '';
  const v = asPercent(p) ? n / 100 : n;
  return v < p.min || v > p.max
    ? `from ${shownValue(p, p.min)}${unit} to ${shownValue(p, p.max)}${unit}`
    : null;
}
const value = (p: StatisticalTestParameter, text: string) => {
  const n = parseDecimal(text)!;
  return asPercent(p) ? Math.round(n * 10) / 1000 : n;
};

/** One parameter's field: what's typed (`typed`, keyed `<test>:<key>`, else the default), its
 *  unit, its presets and its problem - the field's own, else the API's (`param:<key>`). */
export interface ParamRow {
  p: StatisticalTestParameter;
  text: string;
  unit: string;
  issue: string | null;
  presets: { label: string; text: string; on: boolean }[];
}
export function paramRows(
  t: StatisticalTest,
  typed: Record<string, string>,
  apiProblems: Record<string, string> = {},
): ParamRow[] {
  return t.parameters.map((p) => {
    const text = typed[`${t.id}:${p.key}`] ?? shownValue(p, p.default);
    const own = issue(p, text);
    const v = own ? null : value(p, text);
    return {
      p,
      text,
      unit: asPercent(p) ? '%' : '',
      issue: own ?? apiProblems[`param:${p.key}`] ?? null,
      presets: (PRESETS[p.kind] ?? [])
        .filter((x) => x >= p.min && x <= p.max)
        .map((x) => ({ label: `${shownValue(p, x)}%`, text: shownValue(p, x), on: v === x })),
    };
  });
}
/** The parameters as the API takes them, or null while one is invalid. */
export function paramValues(
  t: StatisticalTest,
  typed: Record<string, string>,
): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const p of t.parameters) {
    const text = typed[`${t.id}:${p.key}`] ?? shownValue(p, p.default);
    if (issue(p, text)) return null;
    out[p.key] = value(p, text);
  }
  return out;
}
/** The typed texts for a test's parameter values, e.g. a batch's own for "Run again". */
export const typedFrom = (t: StatisticalTest, values: Record<string, number>) =>
  Object.fromEntries(
    t.parameters
      .filter((p) => values[p.key] != null)
      .map((p) => [`${t.id}:${p.key}`, shownValue(p, values[p.key])]),
  );

/** A 422's problems keyed the way the statistics forms show them: `times`, `test`,
 *  `param:<key>`, `note`, `batch_a`, `batch_b` - and `other` for the rest (or any non-422). */
export function problems(e: any): Record<string, string> {
  const list = e?.status === 422 && Array.isArray(e?.error?.detail) ? e.error.detail : null;
  if (!list) return { other: errText(e) };
  const out: Record<string, string> = {};
  for (const x of list) {
    const loc: string[] = (x?.loc ?? []).slice(1).map(String);
    const key =
      loc[0] === 'statistical_test'
        ? 'test'
        : loc[0] === 'parameters' && loc[1]
          ? `param:${loc[1]}`
          : ['times', 'note', 'batch_a', 'batch_b'].includes(loc[0])
            ? loc[0]
            : 'other';
    out[key] = out[key] ? `${out[key]}; ${x.msg}` : x.msg;
  }
  return out;
}
