import { Component, input } from '@angular/core';
import { StatusMarkComponent } from './status-mark.component';

/**
 * A sentence after its status's mark - "■ Failed: 2 of the 4 checks fell short of the goal." - the
 * mark on the first line however the sentence wraps, and whatever is given after the sentence (a
 * progress bar, a link) under it, in the sentence's column.
 */
@Component({
  selector: 'assay-marked',
  standalone: true,
  imports: [StatusMarkComponent],
  template: `<assay-mark [of]="of()" />
    <div class="text"><ng-content /></div>`,
  styles: `
    :host {
      display: grid;
      grid-template-columns: 8px minmax(0, 1fr);
      column-gap: 10px;
      align-items: start;
    }
    assay-mark {
      margin-top: 7px;
    }
    .text {
      min-width: 0;
      text-wrap: pretty;
    }
  `,
})
export class MarkedComponent {
  /** The status whose mark it is: a run's, a batch's or a verdict's. */
  of = input.required<string>();
}
