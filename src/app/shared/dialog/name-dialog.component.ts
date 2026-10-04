import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogComponent } from './dialog.component';
/** A name, on a line - to make a test set or plan, or to rename one or a dataset. */
@Component({
  selector: 'assay-name-dialog',
  standalone: true,
  imports: [DialogComponent, FormsModule],
  template: `<assay-dialog
    [busy]="busy()"
    [kicker]="kicker()"
    [title]="title()"
    [primaryLabel]="busy() ? 'Saving…' : submitLabel()"
    [primaryDisabled]="!name().trim() || busy()"
    [error]="error()"
    (primary)="go()"
    (close)="closed.emit()"
  >
    <div class="lfield">
      <label for="nd">Name</label
      ><input
        id="nd"
        [ngModel]="name()"
        (ngModelChange)="name.set($event)"
        [placeholder]="placeholder()"
        (keydown.enter)="go()"
        autofocus
      />
      @if (help(); as h) {
        <span class="lfield-help">{{ h }}</span>
      }
    </div>
  </assay-dialog>`,
})
export class NameDialogComponent {
  kicker = input('');
  title = input.required<string>();
  submitLabel = input('Save');
  placeholder = input('');
  /** Under the line: what happens next ("You add its tests next, on its page."). */
  help = input<string | null>(null);
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
