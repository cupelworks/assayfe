import { Injectable, inject, signal, computed } from '@angular/core';
import { TestsApiService } from './tests-api.service';
import { ConfigFieldDescriptor, TestCategory, TestType, TestTypeAssignment } from './models';
import { parseDecimal } from '../shared/number';

/** Whether a type needs an expected_output to work at all - derived from config_fields instead
 *  of the removed required_reference bool, since a type can now need config without needing a
 *  reference (Regex Match/Contains: required config_fields, but kind "multiline" not "reference"). */
export const needsReference = (t: TestType) =>
  t.config_fields.some((f) => f.kind === 'reference' && f.required);
/** Whether a type needs ANY required input before it'll score anything - reference or not.
 *  Catalogue-level, context-free (unlike TestTypePickerComponent's own needsAttention(), which
 *  also knows whether the current test already has a reference filled in) - use this where
 *  there's no specific test to check against, e.g. the catalogue page's per-card tag. */
export const needsSetup = (t: TestType) => t.config_fields.some((f) => f.required);
/** The fields a type actually needs stored per-assignment - excludes "reference" entries, which
 *  always resolve from the test case's own expected_output and are never written into config. */
export const assignmentFields = (t: TestType) =>
  t.config_fields.filter((f) => f.kind !== 'reference');
/** For a non-empty "numeric" field value: null if it parses to a plain number within the
 *  descriptor's own min/max (each independently optional), otherwise a short problem phrase to
 *  append to the field's label. Bounds come from the descriptor, never assumed - the API sends
 *  min/max as advisory metadata and does not itself validate a submitted value against them (or
 *  that it's numeric at all), so this is the only check it gets. */
export const numericFieldIssue = (f: ConfigFieldDescriptor, raw: string): string | null => {
  const n = parseDecimal(raw);
  if (n == null) return 'must be a number';
  if (f.min != null && f.max != null)
    return n < f.min || n > f.max ? `must be between ${f.min} and ${f.max}` : null;
  if (f.min != null) return n < f.min ? `must be at least ${f.min}` : null;
  if (f.max != null) return n > f.max ? `must be at most ${f.max}` : null;
  return null;
};
/** A light check for a JSONPath the user typed (a "jsonpath" config field, or a check's
 *  answer_path): it must start with "$". There's no standard JS JSONPath parser, so the API's own
 *  on-save check (a 422) is the full one. */
export const jsonPathIssue = (raw: string): string | null =>
  raw.startsWith('$') ? null : 'must start with $, e.g. $.status';
/** The label and help for a check's optional answer_path, shared by every form that edits one. */
export const ANSWER_PATH = {
  label: 'Read from (JSONPath)',
  placeholder: '$.stop_reason',
  hint:
    "Leave empty to check the answer. Set a path to check another part of the application's " +
    'reply, e.g. $.stop_reason or $.usage.output_tokens.',
  tip:
    'JSON checks need JSON: to check one field with JSON Field Equals, point this at an object ' +
    "(e.g. $) and use the check's own path for the field. To check a single text value like " +
    'stop_reason, use Contains or Exact Match with $.stop_reason.',
};
/** For a non-empty config value: a short problem phrase to append to the field's label, or null
 *  when it's fit to send - by the field's kind. "numeric": `numericFieldIssue`. "json": must
 *  parse. "jsonpath": must start with "$" - there's no standard JS JSONPath parser, so this is a
 *  light check and the API's own on-save check (a 422 naming the field) is the full one. Other
 *  kinds (multiline, rubric) take any text. */
export const configFieldIssue = (f: ConfigFieldDescriptor, raw: string): string | null => {
  switch (f.kind) {
    case 'numeric':
      return numericFieldIssue(f, raw);
    case 'json':
      try {
        JSON.parse(raw);
        return null;
      } catch {
        return 'is not valid JSON';
      }
    case 'jsonpath':
      return jsonPathIssue(raw);
    default:
      return null;
  }
};
/** "<field label> (<type name>)" for every selected type's required config field left empty, and
 *  (via `answerPathOf`) its answer_path when that isn't a plausible JSONPath; and
 *  "<field label> (<type name>) - <problem>" for a filled one that isn't fit to send
 *  (`configFieldIssue`) - what every form with type config blocks saving on and lists as "Fix
 *  before saving". `hasReference` says whether the item being edited has an expected output, for
 *  "reference" fields; pass null where every item always brings its own (the dataset batch, whose
 *  rows each carry one), so reference fields are skipped. */
export function configIssuesFor(
  types: readonly string[],
  byName: Map<string, TestType>,
  valueOf: (type: string, key: string) => string,
  hasReference: boolean | null,
  answerPathOf: (type: string) => string = () => '',
): string[] {
  const out: string[] = [];
  for (const name of types) {
    const path = answerPathOf(name).trim();
    const pathIssue = path ? jsonPathIssue(path) : null;
    if (pathIssue) out.push(`${ANSWER_PATH.label} (${name}) - ${pathIssue}`);
    const t = byName.get(name);
    if (!t) continue;
    for (const f of t.config_fields) {
      if (f.kind === 'reference') {
        if (hasReference === false && f.required) out.push(`${f.label} (${name})`);
        continue;
      }
      const raw = valueOf(name, f.key).trim();
      if (!raw) {
        if (f.required) out.push(`${f.label} (${name})`);
        continue;
      }
      const issue = configFieldIssue(f, raw);
      if (issue) out.push(`${f.label} (${name}) - ${issue}`);
    }
  }
  return out;
}
/** The assignments a form sends for the ticked types: each type's non-empty config values (only
 *  its own non-reference fields), and ALWAYS its answer_path (null when empty). Always, because
 *  the API replaces the whole list on save and reads a missing answer_path as null - leaving it
 *  out would silently reset a path the user set earlier. Shared by the test form and the dataset
 *  "Create tests from rows" batch. */
export function buildAssignments(
  types: readonly string[],
  byName: Map<string, TestType>,
  configs: Record<string, Record<string, string>>,
  answerPaths: Record<string, string>,
): TestTypeAssignment[] {
  return types.map((name) => {
    const t = byName.get(name);
    const config: Record<string, string> = {};
    for (const f of t ? assignmentFields(t) : []) {
      const v = configs[name]?.[f.key]?.trim();
      if (v) config[f.key] = v;
    }
    return {
      name,
      config: Object.keys(config).length ? config : null,
      answer_path: answerPaths[name]?.trim() || null,
    };
  });
}
/** "0 to 100, passes when score ≥ threshold" - a numeric field's bounds plus the type's pass
 *  direction, each part only when known: a one-sided bound reads "at least 0" / "at most 100"
 *  (the same shapes `numericFieldIssue` validates), `comparison` is null for a type with no
 *  threshold, and with neither there's nothing to say - null, so callers skip the hint entirely.
 *  Null for any non-numeric field too, so a caller iterating mixed fields needn't check the kind.
 *  Shared by the config input's hint and the catalogue card's field list, so the two can't drift
 *  apart. */
export const numericFieldHint = (
  f: ConfigFieldDescriptor,
  comparison: TestType['comparison'],
): string | null => {
  if (f.kind !== 'numeric') return null;
  const range =
    f.min != null && f.max != null
      ? `${f.min} to ${f.max}`
      : f.min != null
        ? `at least ${f.min}`
        : f.max != null
          ? `at most ${f.max}`
          : null;
  const rule = comparison
    ? `passes when score ${comparison === 'gte' ? '≥' : '≤'} threshold`
    : null;
  return range && rule ? `${range}, ${rule}` : (range ?? rule);
};
/** Engine settings that are prose rather than knobs (a judge's fallback rubric is a paragraph) -
 *  never listed by `engineSettingsLabel`, surfaced on their own via `defaultRubric` instead. */
const PROSE_SETTINGS = new Set(['default_rubric']);
/** "mode: search, timeout_seconds: 1" - an engine's settings as one line, or null when it has
 *  none worth listing, so callers skip the row. The engine name itself is shown on its own row
 *  next to this one, mirroring the API's separate `engine` / `engine_settings` fields. Shared by
 *  the catalogue card (the type's current settings) and the run detail's per-result lines (the
 *  settings stamped on that result at execution time - the two can legitimately differ if the
 *  catalogue changed since). */
export const engineSettingsLabel = (
  settings: Record<string, unknown> | null | undefined,
): string | null => {
  const parts = Object.entries(settings ?? {})
    .filter(([k]) => !PROSE_SETTINGS.has(k))
    .map(([k, v]) => `${k}: ${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`);
  return parts.length ? parts.join(', ') : null;
};
/** The rubric an LLM-judge engine grades with when the assignment leaves its own rubric empty -
 *  null for any engine that doesn't carry one. */
export const defaultRubric = (
  settings: Record<string, unknown> | null | undefined,
): string | null => {
  const r = settings?.['default_rubric'];
  return typeof r === 'string' && r ? r : null;
};

export const CATEGORIES: { key: TestCategory; label: string; blurb: string }[] = [
  {
    key: 'deterministic',
    label: 'Deterministic',
    blurb: 'Exact, regex and substring checks - binary, instant, no model involved.',
  },
  {
    key: 'nlp_metric',
    label: 'NLP metric',
    blurb:
      'ROUGE, BLEU, BERTScore and similar - overlap or embedding similarity against a reference.',
  },
  {
    key: 'llm_as_judge',
    label: 'LLM as judge',
    blurb: "A language model scores another model's output against a rubric.",
  },
];

/** Test type catalogue, loaded once and shared by the catalogue page and every test form. */
@Injectable({ providedIn: 'root' })
export class TestTypesStore {
  private api = inject(TestsApiService);
  all = signal<TestType[]>([]);
  loading = signal(false);
  loaded = signal(false);
  active = computed(() => this.all().filter((t) => t.is_active));
  byName = computed(() => new Map(this.all().map((t) => [t.name, t])));
  byCategory = (c: TestCategory) =>
    this.all()
      .filter((t) => t.category === c)
      .sort((a, b) => a.name.localeCompare(b.name));
  load(force = false) {
    if (this.loaded() && !force) return;
    this.loading.set(true);
    this.api.allTestTypes().subscribe({
      next: (t) => {
        this.all.set(t);
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
