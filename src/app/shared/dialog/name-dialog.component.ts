import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogComponent } from './dialog.component';
/** Single required name field - used for create and rename of datasets, sets, plans. */
@Component({
  selector: 'assay-name-dialog',
  standalone: true,
  imports: [DialogComponent, FormsModule],
  template: `<assay-dialog
    [kicker]="kicker()"
    [title]="title()"
    [primaryLabel]="busy() ? 'Saving…' : submitLabel()"
    [primaryDisabled]="!name().trim() || busy()"
    [error]="error()"
    (primary)="go()"
    (close)="closed.emit()"
  >
    <div class="field">
      <label for="nd">Name</label
      ><input
        id="nd"
        class="input"
        [ngModel]="name()"
        (ngModelChange)="name.set($event)"
        [placeholder]="placeholder()"
        (keydown.enter)="go()"
        autofocus
      />
    </div>
  </assay-dialog>`,
})
export class NameDialogComponent {
  kicker = input('');
  title = input.required<string>();
  submitLabel = input('Save');
  placeholder = input('');
  initial = input('');
  busy = input(false);
  error = input<string | null>(null);
  confirm = output<string>();
  closed = output<void>();
  name = signal('');
  ngOnInit() {
    this.name.set(this.initial());
  }
  go() {
    const n = this.name().trim();
    if (n && !this.busy()) this.confirm.emit(n);
  }
}
