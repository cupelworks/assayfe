import { TestType, TestTypeAssignment } from './models';
import {
  ANSWER_PATH,
  assignmentFields,
  configFieldIssue,
  jsonPathIssue,
  needsReference,
} from './test-types.store';

/**
 * A test's checks as a form edits them. A test holds a list of checks; each runs one catalogue
 * type with its own name, settings and answer path, and a type can appear more than once (two
 * Contains, two JSON Field Equals on different paths). Shared by the test form and the dataset
 * "Create tests from rows" batch, both through ChecksTableComponent.
 */
export interface CheckDraft {
  /** The form's own handle for the row (`track`) - never sent. */
  key: number;
  /** The catalogue type's name. */
  type: string;
  /** The check's name as typed; '' = let the API name it (see `effectiveLabels`). */
  label: string;
  /** Setting values by config field key, as text. */
  config: Record<string, string>;
  /** answer_path as typed; '' = the default answer. */
  answerPath: string;
}

/** The API's longest label. */
export const LABEL_MAX = 100;

let seq = 0;
export const newCheck = (type: string): CheckDraft => ({
  key: ++seq,
  type,
  label: '',
  config: {},
  answerPath: '',
});
/** A form's starting checks from a test's assignments - keeping each label the API gave, so a
 *  check keeps its identity when the test is saved again. */
export const checksFrom = (assignments?: readonly TestTypeAssignment[] | null): CheckDraft[] =>
  (assignments ?? []).map((a) => ({
    key: ++seq,
    type: a.name,
    label: a.label ?? '',
    config: { ...(a.config ?? {}) },
    answerPath: a.answer_path ?? '',
  }));

/** Each check's name as the API will store it, in order: a typed name as typed (trimmed), an
 *  empty one the type's name numbered past every name in use - "Contains", then "Contains 2" -
 *  the API's own rule, so the form can show it as the example before saving. */
export function effectiveLabels(checks: readonly CheckDraft[]): string[] {
  const used = new Set(checks.map((c) => c.label.trim().toLowerCase()).filter((l) => l));
  return checks.map((c) => {
    const typed = c.label.trim();
    if (typed) return typed;
    let label = c.type;
    for (let n = 2; used.has(label.toLowerCase()); n++) label = `${c.type} ${n}`;
    used.add(label.toLowerCase());
    return label;
  });
}

/** Names used by more than one check, ignoring letter case (the API's uniqueness rule). */
export function duplicateLabels(checks: readonly CheckDraft[]): Set<string> {
  const seen = new Map<string, number>();
  for (const l of effectiveLabels(checks)) {
    const k = l.toLowerCase();
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
}

/**
 * What blocks saving, listed as "Fix before saving": a name used twice; each check's required
 * setting left empty (a "reference" field needs the test's own expected output - `hasReference`
 * null skips those, for the dataset batch whose rows each bring one) and each filled one that
 * isn't fit to send (`configFieldIssue`); an answer path that isn't a plausible JSONPath. Named
 * "<field> (<check name>)" so two checks of one type can be told apart.
 */
export function checkIssues(
  checks: readonly CheckDraft[],
  byName: Map<string, TestType>,
  hasReference: boolean | null,
): string[] {
  const out: string[] = [];
  const labels = effectiveLabels(checks);
  const dups = duplicateLabels(checks);
  const reported = new Set<string>();
  checks.forEach((c, i) => {
    const label = labels[i];
    if (dups.has(label.toLowerCase()) && !reported.has(label.toLowerCase())) {
      reported.add(label.toLowerCase());
      out.push(`the name "${label}" is used by more than one check`);
    }
    if (c.label.trim().length > LABEL_MAX)
      out.push(`Check name (${label}) - at most ${LABEL_MAX} characters`);
    const path = c.answerPath.trim();
    const pathIssue = path ? jsonPathIssue(path) : null;
    if (pathIssue) out.push(`${ANSWER_PATH.label} (${label}) - ${pathIssue}`);
    const t = byName.get(c.type);
    if (!t) return;
    for (const f of t.config_fields) {
      if (f.kind === 'reference') {
        if (hasReference === false && f.required) out.push(`${f.label} (${label})`);
        continue;
      }
      const raw = (c.config[f.key] ?? '').trim();
      if (!raw) {
        if (f.required) out.push(`${f.label} (${label})`);
        continue;
      }
      const issue = configFieldIssue(f, raw);
      if (issue) out.push(`${f.label} (${label}) - ${issue}`);
    }
  });
  return out;
}

/** The checks' types that need the test's expected output, once each, in order. */
export const typesNeedingReference = (
  checks: readonly CheckDraft[],
  byName: Map<string, TestType>,
): string[] => [
  ...new Set(
    checks
      .map((c) => byName.get(c.type))
      .filter((t): t is TestType => !!t && needsReference(t))
      .map((t) => t.name),
  ),
];

/** The assignments a form sends: each check's type, its name (null when left empty, so the API
 *  names it), its non-empty settings (only the type's own non-reference fields) and ALWAYS its
 *  answer_path (null when empty) - the API replaces the whole list on save and reads a missing
 *  key as null, so leaving one out would silently reset it. */
export function toAssignments(
  checks: readonly CheckDraft[],
  byName: Map<string, TestType>,
): TestTypeAssignment[] {
  return checks.map((c) => {
    const t = byName.get(c.type);
    const config: Record<string, string> = {};
    for (const f of t ? assignmentFields(t) : []) {
      const v = c.config[f.key]?.trim();
      if (v) config[f.key] = v;
    }
    return {
      name: c.type,
      label: c.label.trim() || null,
      config: Object.keys(config).length ? config : null,
      answer_path: c.answerPath.trim() || null,
    };
  });
}

/** A check's name for display wherever a test's assignments are listed - its label, or the type
 *  for an assignment from before labels existed. */
export const checkName = (a: TestTypeAssignment) => a.label || a.name;

/** A test's checks summed up by type, in order of first appearance: "Contains" ×2, "Is Valid
 *  JSON" ×1 - how the tags on lists and the test page show what a test checks. */
export function typeCounts(
  assignments?: readonly TestTypeAssignment[] | null,
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of assignments ?? []) counts.set(a.name, (counts.get(a.name) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count }));
}
/** The same as one line: "Contains ×2, Is Valid JSON". */
export const typeSummary = (assignments?: readonly TestTypeAssignment[] | null) =>
  typeCounts(assignments)
    .map((t) => (t.count > 1 ? `${t.name} ×${t.count}` : t.name))
    .join(', ');
