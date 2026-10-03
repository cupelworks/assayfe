import { Component, input, output } from '@angular/core';

/** One of the other things to do with a page's thing: "Edit", "Rename", "Delete". */
export interface QuietAction {
  key: string;
  label: string;
  disabled?: boolean;
}

/**
 * The other things to do with a page's thing, beside its title under the one in red: quiet, in
 * small capitals, a dot between them - "Edit · Duplicate · Delete". One that can't be done is
 * pale, and why is said under the row (`why`), not hidden in a tooltip.
 */
@Component({
  selector: 'assay-quiet-actions',
  standalone: true,
  template: `
    <span class="row">
      @for (a of actions(); track a.key) {
        <button
          type="button"
          [disabled]="a.disabled"
          [attr.aria-describedby]="a.disabled && why() ? id + '-why' : null"
          (click)="act.emit(a.key)"
        >
          {{ a.label }}
        </button>
      }
    </span>
    @if (why(); as w) {
      <span class="why" [id]="id + '-why'">{{ w }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      min-height: 32px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    button {
      all: unset;
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      color: var(--color-neutral-800);
      cursor: pointer;
    }
    button:hover:not(:disabled) {
      color: var(--color-accent);
    }
    button:disabled {
      color: var(--color-neutral-500);
      cursor: default;
    }
    button:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
    button + button::before {
      content: '·';
      margin: 0 10px;
      color: var(--color-neutral-500);
    }
    .why {
      font-size: 12px;
      line-height: 1.4;
      color: var(--color-neutral-600);
    }
  `,
})
export class QuietActionsComponent {
  private static next = 0;
  readonly id = `qa${QuietActionsComponent.next++}`;
  actions = input.required<QuietAction[]>();
  /** Why the pale ones can't be done. */
  why = input<string | null>(null);
  act = output<string>();
}
