import { Injectable, inject, signal, computed } from '@angular/core';
import { TestsApiService } from './tests-api.service';
import { ConfigFieldDescriptor, TestCategory, TestType } from './models';
import { parseDecimal } from '../shared/number';

/** Whether a type needs an expected_output to work at all - derived from config_fields instead
 *  of the removed required_reference bool, since a type can now need config without needing a
 *  reference (Regex Match/Contains: required config_fields, but kind "multiline" not "reference"). */
export const needsReference = (t: TestType) =>
  t.config_fields.some((f) => f.kind === 'reference' && f.required);
/** Whether a type needs ANY required input before it'll score anything - reference or not.
 *  Catalogue-level, context-free (unlike ChecksTableComponent's own needsAttention(), which
 *  also knows whether the current test already has a reference filled in) - use this where
 *  there's no specific test to check against, e.g. the catalogue page's per-card tag. */
export const needsSetup = (t: TestType) => t.config_fields.some((f) => f.required);
/** A type's cost in words, as the catalogue shows it: "very_fast" is "very fast". */
export const costLabel = (t: TestType) => t.cost.replaceAll('_', ' ');
/** The fields a type actually needs stored per-assignment - excludes "reference" entries, which
 *  always resolve from the test case's own expected_output and are never written into config. */
export const assignmentFields = (t: TestType) =>
  t.config_fields.filter((f) => f.kind !== 'reference');
/** For a non-empty "numeric" field value: null if it parses to a plain number - a whole one when
 *  the descriptor says `integer` - within its own min/max (each independently optional),
 *  otherwise a short problem phrase to append to the field's label. Bounds come from the
 *  descriptor, never assumed; the API enforces the same rules on save (a 422), so this only says
 *  so before the round trip. */
export const numericFieldIssue = (f: ConfigFieldDescriptor, raw: string): string | null => {
  const n = parseDecimal(raw);
  if (n == null) return 'must be a number';
  if (f.integer && !Number.isInteger(n)) return 'must be a whole number';
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
/** The label and help for a check's optional answer_path, shared by every form that edits one.
 *  The API sends no hint for this field; this one line is ours, kept short on purpose - it only
 *  says what an empty field does. */
export const ANSWER_PATH = {
  label: 'Read from (JSONPath)',
  placeholder: '$.stop_reason',
  hint: 'Leave empty to use the Answer path set in Settings.',
};
/** For a non-empty config value: a short problem phrase to append to the field's label, or null
 *  when it's fit to send - by the field's kind. "numeric": `numericFieldIssue`. "json": must
 *  parse ("json_schema" too - whether it's a valid schema is the API's 422). "jsonpath": must
 *  start with "$" - there's no standard JS JSONPath parser, so this is a light check and the
 *  API's own on-save check (a 422 naming the field) is the full one. "regex" isn't checked here:
 *  the API compiles it with Python's `re`, whose syntax differs from JS's (`(?P<name>…)` is valid
 *  there, not here), so a JS check could block a valid pattern - the 422 carries the reason.
 *  Other kinds (multiline, rubric) take any text. */
export const configFieldIssue = (f: ConfigFieldDescriptor, raw: string): string | null => {
  switch (f.kind) {
    case 'numeric':
      return numericFieldIssue(f, raw);
    case 'json':
    case 'json_schema':
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
/** Fields whose value is code rather than prose - JSON, a JSON Schema, a JSONPath, a regex -
 *  shown in monospace (and not spell-checked) wherever they're edited or displayed. */
export const isCodeField = (f: ConfigFieldDescriptor): boolean =>
  f.kind === 'json' || f.kind === 'json_schema' || f.kind === 'jsonpath' || f.kind === 'regex';
/** "0 to 100, met when score ≥ threshold" - a numeric field's bounds plus the type's pass
 *  direction, each part only when known, led by "a whole number" for an `integer` field (the
 *  API's hints leave that to the flag): a one-sided bound reads "at least 0" / "at most 100"
 *  (the same shapes `numericFieldIssue` validates), `comparison` is null for a type with no
 *  threshold, and with neither there's nothing to say - null, so callers skip the hint entirely.
 *  Null for any non-numeric field too, so a caller iterating mixed fields needn't check the kind.
 *  Shared by the config input's hint and the catalogue card's field list, so the two can't drift
 *  apart. */
/** A scored type's scale: its numeric threshold field's min and max (BLEU 0 to 100, cosine
 *  similarity -1 to 1) - null for a type with no comparison, or when the field gives no range. */
export const scoreScale = (t: TestType | undefined): { min: number; max: number } | null => {
  if (!t?.comparison) return null;
  const f = assignmentFields(t).find((x) => x.kind === 'numeric');
  return f?.min != null && f?.max != null && f.max > f.min ? { min: f.min, max: f.max } : null;
};

export const numericFieldHint = (
  f: ConfigFieldDescriptor,
  comparison: TestType['comparison'],
): string | null => {
  if (f.kind !== 'numeric') return null;
  const whole = f.integer ? 'a whole number' : null;
  const bounds =
    f.min != null && f.max != null
      ? `${f.min} to ${f.max}`
      : f.min != null
        ? `at least ${f.min}`
        : f.max != null
          ? `at most ${f.max}`
          : null;
  const rule = comparison ? `met when score ${comparison === 'gte' ? '≥' : '≤'} threshold` : null;
  return [whole, bounds, rule].filter(Boolean).join(', ') || null;
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
