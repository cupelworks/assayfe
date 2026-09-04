import { Component, input, output } from '@angular/core';
import { DialogComponent } from './dialog.component';
@Component({
  selector: 'assay-confirm-dialog', standalone: true, imports: [DialogComponent],
  template: `<assay-dialog [kicker]="kicker()" [title]="title()" [primaryLabel]="busy() ? 'Working…' : confirmLabel()" [primaryDisabled]="busy()" [danger]="danger()" [error]="error()" (primary)="confirm.emit()" (close)="closed.emit()">
    <p style="margin:0;font-size:14px;line-height:1.5;text-wrap:pretty">{{ body() }}</p>
  </assay-dialog>`,
})
export class ConfirmDialogComponent {
  kicker = input(''); title = input.required<string>(); body = input(''); confirmLabel = input('Confirm'); danger = input(true);
  busy = input(false); error = input<string | null>(null);
  confirm = output<void>(); closed = output<void>();
}
