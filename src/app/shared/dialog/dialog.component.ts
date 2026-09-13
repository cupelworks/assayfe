import { Component, input, output } from '@angular/core';
/** Modernist .dialog over .dialog-backdrop; body projected; footer = primary + Cancel. */
@Component({
  selector: 'assay-dialog',
  standalone: true,
  templateUrl: './dialog.component.html',
  styleUrl: './dialog.component.css',
})
export class DialogComponent {
  kicker = input('');
  title = input.required<string>();
  wide = input(false);
  primaryLabel = input('Save');
  primaryDisabled = input(false);
  danger = input(false);
  error = input<string | null>(null);
  primary = output<void>();
  close = output<void>();
}
