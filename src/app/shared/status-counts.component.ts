import { Component, computed, input } from '@angular/core';
import { StatusCount } from './format';
import { StatusMarkComponent } from './status-mark.component';

/**
 * How a set of runs went: each status with its mark and count ("14 Green · 1 Amber") - one run is
 * just its status ("Amber"). Takes the counts with any status at none left out (`countByStatus`,
 * filtered); with none, it shows nothing.
 */
@Component({
  selector: 'assay-status-counts',
  standalone: true,
  imports: [StatusMarkComponent],
  template: `
    @for (s of counts(); track s.key) {
      <span class="fig"
        ><assay-mark [of]="s.key" />{{ many() ? s.value + ' ' : '' }}{{ s.label }}</span
      >
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      min-width: 0;
    }
    .fig {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class StatusCountsComponent {
  counts = input.required<StatusCount[]>();
  /** More than one run: each status shows its count. */
  many = computed(() => this.counts().reduce((n, s) => n + s.value, 0) > 1);
}
