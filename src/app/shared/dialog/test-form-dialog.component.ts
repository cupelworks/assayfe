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
  /** "<field label> (<type name>) - <problem>" for every selected type's config_fields entry
   *  that isn't fit to submit yet: a required field left empty (a "reference" entry checks
   *  expected_output, shared; everything else checks this type's own configs() slot), or a
   *  "numeric" entry that isn't a plain number in [0, 1]. Drives both the submit-disable guard
   *  and the on-screen hint - the API accepts both problems silently (see
   *  docs/test_type_config/next_move.md 3.1 for the required-field gap on "reference", and the
   *  "numeric" kind's own handover note for the lack of any format/range check at all), so this
   *  is the only thing standing between the user and a test that can never be scored correctly. */
  configIssues = computed(() => {
    const byName = this.store.byName();
    const configs = this.configs();
    const out: string[] = [];
    for (const name of this.types()) {
      const t = byName.get(name);
      if (!t) continue;
      for (const f of t.config_fields) {
        if (f.kind === 'reference') {
          if (f.required && !this.hasReference()) out.push(`${f.label} (${name})`);
          continue;
        }
        const raw = configs[name]?.[f.key]?.trim() ?? '';
        if (!raw) {
          if (f.required) out.push(`${f.label} (${name})`);
          continue;
        }
        if (f.kind === 'numeric') {
          const n = Number(raw);
          if (!Number.isFinite(n) || n < 0 || n > 1) {
            out.push(`${f.label} (${name}) - must be a number between 0 and 1`);
          }
        }
      }
    }
    return out;
  });
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
