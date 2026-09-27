import { Component, inject, input, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TestTypesStore, assignmentFields } from '../api/test-types.store';

/**
 * Per-assignment config for the currently-selected test types - one labeled field per
 * non-reference config_fields entry ("reference" always resolves from the test case's own
 * expected_output instead and never appears here, see TestType.config_fields): a textarea for
 * "multiline"/"rubric", a bounded number input for "numeric" clamped to that field's own
 * min/max (the API stores it as a plain string and does not validate format or range itself, so
 * these client-side bounds - read from the descriptor, not assumed - are the only guard it
 * gets). Grouped by type so it's clear which field belongs to which selected type, since two
 * types can each contribute their own fields to the same test case.
 */
@Component({
  selector: 'assay-test-type-config-fields',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './test-type-config-fields.component.html',
  styleUrl: './test-type-config-fields.component.css',
})
export class TestTypeConfigFieldsComponent {
  selected = input.required<string[]>();
  value = input<Record<string, Record<string, string>>>({});
  valueChange = output<Record<string, Record<string, string>>>();

  private store = inject(TestTypesStore);
  sections = computed(() => {
    const byName = this.store.byName();
    return this.selected()
      .map((name) => {
        const t = byName.get(name);
        const fields = t ? assignmentFields(t) : [];
        return { name, fields, comparison: t?.comparison ?? null };
      })
      .filter((s) => s.fields.length);
  });

  fieldValue(typeName: string, key: string) {
    return this.value()[typeName]?.[key] ?? '';
  }
  /** "- 0 to 100, passes when score ≥ threshold" - built as one string rather than concatenated
   *  in the template, since an `@if` split across the range and the pass-rule clause left stray
   *  whitespace between them. `comparison` is null for a numeric field with no pass direction
   *  (there's no such field today, but nothing here assumes one exists). */
  numericHint(f: { min?: number | null; max?: number | null }, comparison: 'gte' | 'lte' | null) {
    const rule = comparison
      ? `, passes when score ${comparison === 'gte' ? '≥' : '≤'} threshold`
      : '';
    return `- ${f.min} to ${f.max}${rule}`;
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
