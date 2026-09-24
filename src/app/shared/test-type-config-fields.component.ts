import { Component, inject, input, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TestTypesStore, assignmentFields } from '../api/test-types.store';

/**
 * Per-assignment config for the currently-selected test types - one labeled textarea per
 * non-reference config_fields entry (kind "multiline" or "rubric"; "reference" always resolves
 * from the test case's own expected_output instead and never appears here, see TestType.config_fields).
 * Grouped by type so it's clear which field belongs to which selected type, since two types can
 * each contribute their own fields to the same test case.
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
        return { name, fields };
      })
      .filter((s) => s.fields.length);
  });

  fieldValue(typeName: string, key: string) {
    return this.value()[typeName]?.[key] ?? '';
  }
  setFieldValue(typeName: string, key: string, v: string) {
    const cur = this.value();
    this.valueChange.emit({
      ...cur,
      [typeName]: { ...cur[typeName], [key]: v },
    });
  }
}
