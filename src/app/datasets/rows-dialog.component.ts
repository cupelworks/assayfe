// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, input, output, viewChild } from '@angular/core';
import { DataSetRowSchema } from '../api/models';
import { counted } from '../shared/format';
import { DialogComponent } from '../shared/dialog/dialog.component';
import { PasteRowsComponent } from './paste-rows.component';

/**
 * Add rows to a dataset, or replace all of them: a paste, read line by line as it's typed, and
 * nothing sent while a line is wrong. Replacing can't be undone - its rule is red and the cost
 * is said first: how many rows go, and that the tests made from them keep their content.
 */
@Component({
  selector: 'assay-rows-dialog',
  standalone: true,
  imports: [DialogComponent, PasteRowsComponent],
  template: `<assay-dialog
    [busy]="busy()"
    [kicker]="kicker()"
    [title]="title()"
    [wide]="true"
    [danger]="replace()"
    [primaryLabel]="busy() ? 'Saving…' : label()"
    [primaryDisabled]="!paste()?.rows() || busy()"
    [blockers]="blockers()"
    [error]="error()"
    (primary)="go()"
    (close)="closed.emit()"
  >
    @if (replace()) {
      <p class="warn">
        <b>The {{ total() }} rows go</b>, and the ones pasted here take their place - all or
        nothing.
      </p>
    } @else {
      <p class="say">
        Paste one JSON object a line, each with <code>prompt</code>,
        <code>expected_output</code> and <code>model_output</code>.
      </p>
    }
    <assay-paste-rows
      #box
      [label]="replace() ? 'The rows to put instead' : 'Rows to add, one JSON object a line'"
    />
    @if (replace()) {
      <p class="say">
        The tests made from the old rows keep their content; they just stop showing which row they
        came from.
      </p>
    }
  </assay-dialog>`,
  styles: `
    .say {
      margin: 0;
      font-size: 15px;
      line-height: 1.55;
      color: var(--color-neutral-900);
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      color: var(--color-text);
    }
    .warn {
      margin: 0;
      padding: 10px 0 10px 14px;
      border-left: 4px solid var(--color-accent);
      font-size: 15px;
      line-height: 1.5;
      color: var(--color-text);
    }
  `,
})
export class RowsDialogComponent {
  mode = input<'add' | 'replace'>('add');
  kicker = input('');
  /** The rows it has now - what a replace removes. */
  total = input(0);
  busy = input(false);
  error = input<string | null>(null);
  confirm = output<DataSetRowSchema[]>();
  closed = output<void>();
  paste = viewChild<PasteRowsComponent>('box');
  replace = computed(() => this.mode() === 'replace');
  title = computed(() => (this.replace() ? `Replace all ${this.total()} rows?` : 'Add rows'));
  label = computed(() => {
    const n = this.paste()?.rows()?.length ?? 0;
    if (this.replace()) return n ? `Replace ${this.total()} rows with ${n}` : 'Replace rows';
    return n ? `Add ${counted(n, 'row')}` : 'Add rows';
  });
  blockers = computed(() => {
    const bad = this.paste()?.bad() ?? [];
    if (!bad.length) return [];
    const which = bad.map((l) => l.no).join(', ');
    return [
      `line ${which} first - nothing is ${this.replace() ? 'replaced' : 'added'} while a line is wrong`,
    ];
  });
  go() {
    const rows = this.paste()?.rows();
    if (rows && !this.busy()) this.confirm.emit(rows);
  }
}
