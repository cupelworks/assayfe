import { Component, inject, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogComponent } from './dialog.component';
import { TestCaseBody, TestTypeAssignment } from '../../api/models';
import { TestTypesStore, assignmentFields } from '../../api/test-types.store';
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
  /** "<field label> (<type name>)" for every required config_fields entry still empty on a
   *  selected type - a "reference" entry checks expected_output (shared), everything else
   *  checks this type's own configs() slot. Drives both the submit-disable guard and the
   *  on-screen hint, since the API accepts an incomplete "reference" field silently (see
   *  docs/test_type_config/next_move.md 3.1 - the required-field check explicitly excludes
   *  kind "reference") and would otherwise let a test save that can never be scored. */
  missingRequired = computed(() => {
    const byName = this.store.byName();
    const configs = this.configs();
    const out: string[] = [];
    for (const name of this.types()) {
      const t = byName.get(name);
      if (!t) continue;
      for (const f of t.config_fields) {
        if (!f.required) continue;
        const empty =
          f.kind === 'reference' ? !this.hasReference() : !configs[name]?.[f.key]?.trim();
        if (empty) out.push(`${f.label} (${name})`);
      }
    }
    return out;
  });
  valid = computed(() => !!this.inp().trim() && !this.missingRequired().length);
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
