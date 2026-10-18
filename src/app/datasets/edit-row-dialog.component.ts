// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataSetRow, DataSetRowSchema } from '../api/models';
import { DialogComponent } from '../shared/dialog/dialog.component';

/**
 * A row, edited: its prompt, expected output and model output, one under the other, each a line
 * that grows as it's typed in. The tests made from it keep their own copy.
 */
@Component({
  selector: 'assay-edit-row-dialog',
  standalone: true,
  imports: [DialogComponent, FormsModule],
  template: `<assay-dialog
    [busy]="busy()"
    [kicker]="kicker()"
    [title]="'Edit row ' + no()"
    [primaryLabel]="busy() ? 'Saving…' : 'Save row'"
    [primaryDisabled]="busy()"
    [error]="error()"
    (primary)="confirm.emit(draft())"
    (close)="closed.emit()"
  >
    <div class="lfield">
      <label for="er-prompt">Prompt</label
      ><textarea
        id="er-prompt"
        rows="2"
        [ngModel]="draft().prompt"
        (ngModelChange)="set('prompt', $event)"
        autofocus
      ></textarea>
    </div>
    <div class="lfield">
      <label for="er-expected">Expected output</label
      ><textarea
        id="er-expected"
        rows="2"
        [ngModel]="draft().expected_output"
        (ngModelChange)="set('expected_output', $event)"
      ></textarea>
    </div>
    <div class="lfield">
      <label for="er-model">Model output</label
      ><textarea
        id="er-model"
        rows="2"
        [ngModel]="draft().model_output"
        (ngModelChange)="set('model_output', $event)"
      ></textarea>
      <span class="lfield-help"
        >Leave it empty to have the tests made from it ask the application.</span
      >
    </div>
    <p class="say">
      The tests made from it keep their own copy: editing the row leaves them as they are.
    </p>
  </assay-dialog>`,
  styles: `
    .say {
      margin: 0;
      font-size: 14px;
      line-height: 1.55;
      color: var(--color-neutral-800);
    }
  `,
})
export class EditRowDialogComponent {
  kicker = input('');
  row = input.required<DataSetRow>();
  /** Its place in the dataset, from 1. */
  no = input(1);
  busy = input(false);
  error = input<string | null>(null);
  confirm = output<DataSetRowSchema>();
  closed = output<void>();
  draft = signal<DataSetRowSchema>({ prompt: '', expected_output: '', model_output: '' });
  ngOnInit() {
    this.draft.set({ ...this.row().row_info });
  }
  set<K extends keyof DataSetRowSchema>(k: K, v: string) {
    this.draft.update((d) => ({ ...d, [k]: v }));
  }
}
