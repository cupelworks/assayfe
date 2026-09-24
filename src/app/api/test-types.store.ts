import { Injectable, inject, signal, computed } from '@angular/core';
import { TestsApiService } from './tests-api.service';
import { TestCategory, TestType } from './models';

/** Whether a type needs an expected_output to work at all - derived from config_fields instead
 *  of the removed required_reference bool, since a type can now need config without needing a
 *  reference (Regex Match/Contains: required config_fields, but kind "multiline" not "reference"). */
export const needsReference = (t: TestType) =>
  t.config_fields.some((f) => f.kind === 'reference' && f.required);
/** The fields a type actually needs stored per-assignment - excludes "reference" entries, which
 *  always resolve from the test case's own expected_output and are never written into config. */
export const assignmentFields = (t: TestType) =>
  t.config_fields.filter((f) => f.kind !== 'reference');

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
