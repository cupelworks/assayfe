import { Component, inject, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogComponent } from './dialog.component';
import { TestCaseBody, TestTypeAssignment } from '../../api/models';
import {
  TestTypesStore,
  assignmentFields,
  needsReference,
  configIssuesFor,
} from '../../api/test-types.store';
import { TestTypePickerComponent } from '../test-type-picker.component';
import { TestTypeConfigFieldsComponent } from '../test-type-config-fields.component';

/** name / input / expected_output / model_output / test_type_assignments - the CreateTestCaseRequest & ModifyTestCaseRequest shape. */
@Component({
  selector: 'assay-test-form-dialog',
  standalone: true,
  imports: [DialogComponent, FormsModule, TestTypePickerComponent, TestTypeConfigFieldsComponent],
  templateUrl: './test-form-dialog.component.html',
  styleUrl: './test-form-dialog.component.css',
})
export class TestFormDialogComponent {
  kicker = input('');
  title = input('New test');
  submitLabel = input('Create test');
  initial = input<Partial<TestCaseBody> | null>(null);
  busy = input(false);
  error = input<string | null>(null);
  confirm = output<TestCaseBody>();
  closed = output<void>();
  private store = inject(TestTypesStore);
  name = signal('');
  inp = signal('');
  expected = signal('');
  modelOut = signal('');
  types = signal<string[]>([]);
  /** Per-type config values, keyed by type name then field key - see TestTypeConfigFieldsComponent. */
  configs = signal<Record<string, Record<string, string>>>({});
  hasReference = computed(() => !!this.expected().trim());
  /** The Expected output label's hint, live as types are ticked: "required by BLEU, ROUGE" when
   *  any selected type needs a reference (per its config_fields - `needsReference`, the same rule
   *  as the catalogue's tag), "optional" when none does. It says up front what configIssues would
   *  otherwise only report when saving is blocked. */
  expectedHint = computed(() => {
    const byName = this.store.byName();
    const needing = this.types().filter((n) => {
      const t = byName.get(n);
      return !!t && needsReference(t);
    });
    return needing.length ? `required by ${needing.join(', ')}` : 'optional';
  });
  /** What blocks saving and is listed as "Fix before saving": every selected type's required
   *  field left empty (a "reference" field checks this test's own expected output) and every
   *  filled one that isn't fit to send (a number out of range, JSON that doesn't parse, …) - see
   *  configIssuesFor in test-types.store.ts, shared with the dataset batch. The API repeats the
   *  JSON/JSONPath checks on save; the rest this is the only guard for. */
  configIssues = computed(() =>
    configIssuesFor(
      this.types(),
      this.store.byName(),
      (type, key) => this.configs()[type]?.[key] ?? '',
      this.hasReference(),
    ),
  );
  valid = computed(() => !!this.inp().trim() && !this.configIssues().length);
  ngOnInit() {
    const i = this.initial();
    if (i) {
      this.name.set(i.name ?? '');
      this.inp.set(i.input ?? '');
      this.expected.set(i.expected_output ?? '');
      this.modelOut.set(i.model_output ?? '');
      const assignments = i.test_type_assignments ?? [];
      this.types.set(assignments.map((a) => a.name));
      this.configs.set(Object.fromEntries(assignments.map((a) => [a.name, a.config ?? {}])));
    }
  }
  go() {
    if (!this.valid() || this.busy()) return;
    const byName = this.store.byName();
    const configs = this.configs();
    const assignments: TestTypeAssignment[] = this.types().map((name) => {
      const t = byName.get(name);
      const fields = t ? assignmentFields(t) : [];
      const cfg = configs[name] ?? {};
      const config: Record<string, string> = {};
      for (const f of fields) if (cfg[f.key]?.trim()) config[f.key] = cfg[f.key].trim();
      return { name, config: Object.keys(config).length ? config : null };
    });
    this.confirm.emit({
      name: this.name().trim() || undefined,
      input: this.inp(),
      expected_output: this.expected().trim() || null,
      model_output: this.modelOut().trim() || null,
      test_type_assignments: assignments,
    });
  }
}
