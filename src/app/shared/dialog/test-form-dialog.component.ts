import { Component, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogComponent } from './dialog.component';
import { TestCaseBody } from '../../api/models';
import { TEST_TYPE_SUGGESTIONS } from '../format';

/** name / input / expected_output / model_output / test_type_names — the CreateTestCaseRequest & ModifyTestCaseRequest shape. */
@Component({
  selector: 'assay-test-form-dialog', standalone: true, imports: [DialogComponent, FormsModule],
  templateUrl: './test-form-dialog.component.html', styleUrl: './test-form-dialog.component.css',
})
export class TestFormDialogComponent {
  kicker = input(''); title = input('New test'); submitLabel = input('Create test'); initial = input<Partial<TestCaseBody> | null>(null);
  busy = input(false); error = input<string | null>(null);
  confirm = output<TestCaseBody>(); closed = output<void>();
  suggestions = TEST_TYPE_SUGGESTIONS;
  name = signal(''); inp = signal(''); expected = signal(''); modelOut = signal(''); types = signal<string[]>([]); custom = signal('');
  valid = computed(() => !!this.inp().trim());
  ngOnInit() { const i = this.initial(); if (i) { this.name.set(i.name ?? ''); this.inp.set(i.input ?? ''); this.expected.set(i.expected_output ?? ''); this.modelOut.set(i.model_output ?? ''); this.types.set([...(i.test_type_names ?? [])]); } }
  toggle(t: string) { this.types.update(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]); }
  addCustom() { const t = this.custom().trim().toLowerCase().replace(/\s+/g, '_'); if (t && !this.types().includes(t)) this.types.update(p => [...p, t]); this.custom.set(''); }
  go() {
    if (!this.valid() || this.busy()) return;
    this.confirm.emit({ name: this.name().trim() || undefined, input: this.inp(), expected_output: this.expected().trim() || null, model_output: this.modelOut().trim() || null, test_type_names: this.types() });
  }
}
