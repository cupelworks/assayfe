import { Component, computed, input } from '@angular/core';
import { StatusCount } from './format';
import { StatusMarkComponent } from './status-mark.component';

/**
 * How a set of runs went: each status with its mark and count ("14 Green · 1 Amber"), and under
 * them a bar split by status in their colours - one run is just its status ("Amber"), no bar.
 * Takes the counts with any status at none left out (`countByStatus`, filtered); with none, it
 * shows nothing.
 */
@Component({
  selector: 'assay-status-counts',
  standalone: true,
  imports: [StatusMarkComponent],
  template: `
    <span class="figs">
      @for (s of counts(); track s.key) {
        <span class="fig"
          ><assay-mark [of]="s.key" />{{ many() ? s.value + ' ' : '' }}{{ s.label }}</span
        >
      }
    </span>
    @if (many()) {
      <span class="stack" aria-hidden="true">
        @for (s of counts(); track s.key) {
          <i [style.flex-grow]="s.value" [style.background]="s.color"></i>
        }
      </span>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .figs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
    }
    .fig {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-variant-numeric: tabular-nums;
    }
    .stack {
      display: flex;
      gap: 2px;
      max-width: 240px;
      height: 6px;
      margin-top: 10px;
    }
    .stack i {
      display: block;
      flex: 0 1 0;
      height: 6px;
    }
  `,
})
export class StatusCountsComponent {
  counts = input.required<StatusCount[]>();
  /** More than one run: each count shows, and the bar. */
  many = computed(() => this.counts().reduce((n, s) => n + s.value, 0) > 1);
}
