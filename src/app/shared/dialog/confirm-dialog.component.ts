// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input, output } from '@angular/core';
import { DialogComponent } from './dialog.component';
/**
 * Are you sure: what it acts on, named (projected - `<assay-named-list>`, a quote), then what
 * happens, in a sentence. `danger` (the default) rules it in red: it can't be undone; unlinking,
 * removing a link or clearing an answer keeps everything else, and isn't.
 */
@Component({
  selector: 'assay-confirm-dialog',
  standalone: true,
  imports: [DialogComponent],
  template: `<assay-dialog
    [busy]="busy()"
    [kicker]="kicker()"
    [title]="title()"
    [primaryLabel]="busy() ? 'Working…' : confirmLabel()"
    [primaryDisabled]="busy() || blocked()"
    [danger]="danger()"
    [error]="error()"
    (primary)="confirm.emit()"
    (close)="closed.emit()"
  >
    <ng-content />
    @if (body()) {
      <p class="say">{{ body() }}</p>
    }
  </assay-dialog>`,
  styles: `
    .say {
      margin: 0;
      font-size: 15px;
      line-height: 1.55;
      color: var(--color-neutral-900);
      text-wrap: pretty;
    }
  `,
})
export class ConfirmDialogComponent {
  kicker = input('');
  title = input.required<string>();
  body = input('');
  confirmLabel = input('Confirm');
  danger = input(true);
  busy = input(false);
  /** Nothing to do yet (still checking, or nothing it can act on). */
  blocked = input(false);
  error = input<string | null>(null);
  confirm = output<void>();
  closed = output<void>();
}
