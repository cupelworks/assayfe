// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, inject, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogComponent } from './dialog.component';
import { TestCaseBody } from '../../api/models';
import { TestTypesStore } from '../../api/test-types.store';
import {
  CheckDraft,
  checkIssues,
  checksFrom,
  toAssignments,
  typesNeedingReference,
} from '../../api/checks';
import { ChecksTableComponent } from '../checks-table.component';

/** name / input / expected_output / model_output / test_type_assignments - the CreateTestCaseRequest & ModifyTestCaseRequest shape. */
@Component({
  selector: 'assay-test-form-dialog',
  standalone: true,
  imports: [DialogComponent, FormsModule, ChecksTableComponent],
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
  /** The test's checks - see api/checks.ts and ChecksTableComponent. */
  checks = signal<CheckDraft[]>([]);
  hasReference = computed(() => !!this.expected().trim());
  /** The Expected output label's hint, live as checks are added: "required by BLEU, ROUGE" when
   *  any check's type needs a reference (`needsReference`, the same rule as the catalogue's
   *  tag), "optional" when none does - up front, before saving is blocked for it. */
  expectedHint = computed(() => {
    const needing = typesNeedingReference(this.checks(), this.store.byName());
    return needing.length ? `required by ${needing.join(', ')}` : 'optional';
  });
  /** What blocks saving, listed as "Fix before saving" - `checkIssues` in api/checks.ts, shared
   *  with the dataset batch: a name used twice, required settings left empty, values that aren't
   *  fit to send. The API repeats its own checks on save (a 422, shown as sent). */
  configIssues = computed(() =>
    checkIssues(this.checks(), this.store.byName(), this.hasReference()),
  );
  /** Everything that keeps Save disabled, for the dialog's footer: an empty Input, then the
   *  checks' problems. */
  blockers = computed(() => [
    ...(this.inp().trim() ? [] : ['Input is empty']),
    ...this.configIssues(),
  ]);
  valid = computed(() => !this.blockers().length);
  ngOnInit() {
    const i = this.initial();
    if (i) {
      this.name.set(i.name ?? '');
      this.inp.set(i.input ?? '');
      this.expected.set(i.expected_output ?? '');
      this.modelOut.set(i.model_output ?? '');
      // Keeps every label the API gave, so each check keeps its identity when saved again.
      this.checks.set(checksFrom(i.test_type_assignments));
    }
  }
  go() {
    if (!this.valid() || this.busy()) return;
    this.confirm.emit({
      name: this.name().trim() || undefined,
      input: this.inp(),
      expected_output: this.expected().trim() || null,
      model_output: this.modelOut().trim() || null,
      test_type_assignments: toAssignments(this.checks(), this.store.byName()),
    });
  }
}
