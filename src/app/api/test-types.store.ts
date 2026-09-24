import { Injectable, inject, signal, computed } from '@angular/core';
import { TestsApiService } from './tests-api.service';
import { ConfigFieldDescriptor, TestCategory, TestType } from './models';

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
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'must be a number';
  if (f.min != null && f.max != null)
    return n < f.min || n > f.max ? `must be between ${f.min} and ${f.max}` : null;
  if (f.min != null) return n < f.min ? `must be at least ${f.min}` : null;
  if (f.max != null) return n > f.max ? `must be at most ${f.max}` : null;
  return null;
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
