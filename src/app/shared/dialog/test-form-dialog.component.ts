import { Component, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogComponent } from './dialog.component';
import { TestCaseBody } from '../../api/models';
import { TestTypePickerComponent } from '../test-type-picker.component';

/** name / input / expected_output / model_output / test_type_names - the CreateTestCaseRequest & ModifyTestCaseRequest shape. */
@Component({
  selector: 'assay-test-form-dialog',
  standalone: true,
  imports: [DialogComponent, FormsModule, TestTypePickerComponent],
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
  name = signal('');
  inp = signal('');
  expected = signal('');
  modelOut = signal('');
  types = signal<string[]>([]);
  hasReference = computed(() => !!this.expected().trim());
  valid = computed(() => !!this.inp().trim());
  ngOnInit() {
    const i = this.initial();
    if (i) {
      this.name.set(i.name ?? '');
      this.inp.set(i.input ?? '');
      this.expected.set(i.expected_output ?? '');
      this.modelOut.set(i.model_output ?? '');
      this.types.set([...(i.test_type_names ?? [])]);
    }
  }
  go() {
    if (!this.valid() || this.busy()) return;
    this.confirm.emit({
      name: this.name().trim() || undefined,
      input: this.inp(),
      expected_output: this.expected().trim() || null,
      model_output: this.modelOut().trim() || null,
      test_type_names: this.types(),
    });
  }
}
