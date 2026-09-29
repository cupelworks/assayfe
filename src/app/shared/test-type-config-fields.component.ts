import { Component, inject, input, output, computed, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NumberInputDirective } from './number';
import {
  TestTypesStore,
  assignmentFields,
  numericFieldHint,
  ANSWER_PATH,
} from '../api/test-types.store';

/**
 * Per-assignment config for the currently-selected test types - one labeled field per
 * non-reference config_fields entry ("reference" always resolves from the test case's own
 * expected_output instead and never appears here, see TestType.config_fields): a textarea for
 * "multiline"/"rubric", a monospace textarea for "json", a single-line monospace input for
 * "jsonpath", and the shared `assayNumber` input for "numeric". Each shows the API's own
 * `placeholder` (an example value) and `hint` (a one-line note) when the descriptor has them -
 * nothing here is per type name. Validation lives in configIssuesFor (test-types.store.ts).
 *
 * Every selected type also gets a collapsed "Advanced" section holding its optional answer_path
 * ("Read from (JSONPath)") - an option most users never touch, so it stays out of the way: closed
 * by default, opened automatically only for a type that already has a path (nothing set is ever
 * hidden), and a small "reads $.x" chip on the type's header shows a set path at a glance. That's
 * why a type with no config fields (Is Valid JSON) still gets a section here.
 * Grouped by type so it's clear which field belongs to which selected type, since two
 * types can each contribute their own fields to the same test case.
 */
@Component({
  selector: 'assay-test-type-config-fields',
  standalone: true,
  imports: [FormsModule, NumberInputDirective],
  templateUrl: './test-type-config-fields.component.html',
  styleUrl: './test-type-config-fields.component.css',
})
export class TestTypeConfigFieldsComponent implements OnInit {
  selected = input.required<string[]>();
  value = input<Record<string, Record<string, string>>>({});
  valueChange = output<Record<string, Record<string, string>>>();
  /** Per-type answer_path text, keyed by type name ('' = the default answer). */
  answerPaths = input<Record<string, string>>({});
  answerPathsChange = output<Record<string, string>>();
  answerPath = ANSWER_PATH;
  /** Types whose Advanced section is open. */
  private opened = signal<ReadonlySet<string>>(new Set());

  private store = inject(TestTypesStore);
  sections = computed(() => {
    const byName = this.store.byName();
    return this.selected().map((name) => {
      const t = byName.get(name);
      const fields = t ? assignmentFields(t) : [];
      return { name, fields, comparison: t?.comparison ?? null };
    });
  });

  numericFieldHint = numericFieldHint;

  /** Open Advanced for every type that arrives with a path already set, so it's never hidden. */
  ngOnInit() {
    const withPath = Object.entries(this.answerPaths()).filter(([, p]) => p?.trim());
    this.opened.set(new Set(withPath.map(([name]) => name)));
  }
  isOpen(typeName: string) {
    return this.opened().has(typeName);
  }
  toggleAdvanced(typeName: string) {
    const next = new Set(this.opened());
    next.has(typeName) ? next.delete(typeName) : next.add(typeName);
    this.opened.set(next);
  }
  pathOf(typeName: string) {
    return this.answerPaths()[typeName] ?? '';
  }
  setPath(typeName: string, v: string | null) {
    this.answerPathsChange.emit({ ...this.answerPaths(), [typeName]: v ?? '' });
  }

  fieldValue(typeName: string, key: string) {
    return this.value()[typeName]?.[key] ?? '';
  }
  /** v is a number (or null, when cleared) from the numeric input's NumberValueAccessor, a plain
   *  string from the textarea - normalised to a string either way, since config values are
   *  always stored as strings. */
  setFieldValue(typeName: string, key: string, v: string | number | null) {
    const cur = this.value();
    this.valueChange.emit({
      ...cur,
      [typeName]: { ...cur[typeName], [key]: v === null ? '' : String(v) },
    });
  }
}
