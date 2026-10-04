import { Component, input, model } from '@angular/core';

/** "Sort: Newest ↓" - how a list is ordered, a select that reads as words (the smart filter's, a
 *  set's run's tests). */
@Component({
  selector: 'assay-sort',
  standalone: true,
  template: `<label class="sort"
    >Sort:
    <select [value]="value()" (change)="value.set($any($event.target).value)">
      @for (s of options(); track s) {
        <option [value]="s" [selected]="s === value()">{{ s }} ↓</option>
      }
    </select></label
  >`,
  styles: `
    .sort {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
      color: var(--color-neutral-800);
    }
    select {
      appearance: none;
      min-height: 44px;
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      font-weight: 700;
      color: var(--color-text);
      cursor: pointer;
    }
    select:hover {
      color: var(--color-accent);
    }
    select:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  `,
})
export class SortComponent {
  options = input.required<string[]>();
  value = model('');
}
