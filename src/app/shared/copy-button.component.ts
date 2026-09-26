import { Component, input, signal } from '@angular/core';
import { copyText } from './format';

/**
 * A click-to-copy id/text button - shows "Copied" for 1.2s on success. The exact button + signal
 * + setTimeout this app had copy-pasted across four components (execution runs table, global
 * runs list, executions panel, test detail's standalone runs) before this existed.
 *
 * Renders its own monospace font, since every current use is an id - the caller's own wrapping
 * element still supplies size/color (`.small`/`.muted`/etc.), inherited normally; no `.mono`
 * wrapper needed at the call site anymore.
 */
@Component({
  selector: 'assay-copy-button',
  standalone: true,
  styles: `
    button {
      all: unset;
      cursor: pointer;
      color: inherit;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    button:hover {
      color: var(--color-accent);
    }
  `,
  template: `
    <button type="button" [title]="value()" (click)="copy()">
      {{ copied() ? 'Copied' : (label() ?? value()) }}
    </button>
  `,
})
export class CopyButtonComponent {
  /** The text actually copied to the clipboard, and the tooltip - e.g. a full id. */
  value = input.required<string>();
  /** Display text if different from `value` (e.g. a shortened id). Defaults to `value` itself. */
  label = input<string | null>(null);
  copied = signal(false);
  async copy() {
    if (await copyText(this.value())) {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1200);
    }
  }
}
