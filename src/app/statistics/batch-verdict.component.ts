import { Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BatchSummary } from '../api/models';
import { isInFlight } from '../shared/format';
import { ArrowOutComponent } from '../shared/arrow-out.component';
import { MarkedComponent } from '../shared/marked.component';
import { ProgressBarComponent } from '../shared/progress-bar.component';
import { batchProgress, runAgainLink, verdictLine } from './stats-format';

/**
 * A batch's verdict as a list's row says it: its word in bold and the rest of the API's sentence
 * ("Failed: the check fell short of the goal.") - or, while it runs, how far it got, over a
 * progress bar; then "Run again ↗" on a Failed or Inconclusive one (its scope's Run with
 * statistics, from this batch, in a new tab). `marked`: after the verdict's mark, where the row's
 * own name isn't the verdict (the Overview's latest verdicts, a test's, set's or plan's batches);
 * `note`: the note the user wrote, quoted under the sentence, where the row has no other place for
 * it (Batches, whose rows are named by their verdicts).
 */
@Component({
  selector: 'assay-batch-verdict',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, ArrowOutComponent, MarkedComponent, ProgressBarComponent],
  styleUrls: ['./verdict.css'],
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
  `,
  template: `
    @if (marked()) {
      <assay-marked [of]="batch().status"><ng-container *ngTemplateOutlet="said" /></assay-marked>
    } @else {
      <ng-container *ngTemplateOutlet="said" />
    }
    <ng-template #said>
      <b class="lead">{{ line().label }}</b
      >{{ line().text ? ': ' + line().text : '' }}
      @if (note() && batch().note; as n) {
        <span class="quoted">“{{ n }}”</span>
      }
      @if (progress(); as p) {
        <assay-progress-bar class="prog" [pct]="p.donePct" />
      }
      @if (again()) {
        <a
          class="again new-tab"
          [routerLink]="runAgainLink(batch().scope)"
          [queryParams]="{ from: batch().id }"
          target="_blank"
          rel="noopener"
          aria-label="Run again, opens in a new tab"
          >Run again<assay-arrow-out
        /></a>
      }
    </ng-template>
  `,
})
export class BatchVerdictComponent {
  batch = input.required<BatchSummary>();
  marked = input(true);
  note = input(false);
  runAgainLink = runAgainLink;
  line = computed(() => verdictLine(this.batch()));
  progress = computed(() =>
    isInFlight(this.batch().status) ? batchProgress(this.batch().progress) : null,
  );
  again = computed(() => ['Failed', 'Inconclusive'].includes(this.batch().status));
}
