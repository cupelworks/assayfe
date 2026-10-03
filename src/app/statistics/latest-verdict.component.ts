import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BatchSummary } from '../api/models';
import { StatisticalTestsStore } from '../api/statistics-api.service';
import { isInFlight, rel } from '../shared/format';
import { ArrowOutComponent } from '../shared/arrow-out.component';
import { ProgressBarComponent } from '../shared/progress-bar.component';
import { StateBlockComponent } from '../shared/work/state-block.component';
import { batchProgress, question, runAgainLink, timesText, verdictLine } from './stats-format';

/**
 * A test's, set's or plan's latest verdict, at the top of its page: its newest batch's verdict as
 * a big word ("■ Failed"), what it means, the question · how many times · when, and on: "Run again
 * ↗" on a Failed or Inconclusive one, "Open the batch →". While it runs, a progress bar; with none,
 * "Not yet" and "Run with statistics ↗"; while it's read, "…".
 */
@Component({
  selector: 'assay-latest-verdict',
  standalone: true,
  imports: [RouterLink, ArrowOutComponent, ProgressBarComponent, StateBlockComponent],
  styleUrls: ['../shared/guide/head-aside.css', '../shared/work/work.css'],
  template: `
    @if (v(); as v) {
      <assay-state-block caption="Latest verdict" [of]="v.b.status" [say]="v.say" [facts]="v.facts">
        @if (v.progress; as p) {
          <assay-progress-bar class="prog" [pct]="p.donePct" />
        }
        @if (v.again) {
          <a
            class="go new-tab"
            [routerLink]="runAgainLink(v.b.scope)"
            [queryParams]="{ from: v.b.id }"
            target="_blank"
            rel="noopener"
            aria-label="Run again, opens in a new tab"
            >Run again<assay-arrow-out
          /></a>
        }
        <a class="go" [routerLink]="['/statistics/batches', v.b.id]">Open the batch →</a>
      </assay-state-block>
    } @else if (batch() === undefined) {
      <assay-state-block caption="Latest verdict" word="…" />
    } @else {
      <assay-state-block
        caption="Latest verdict"
        word="Not yet"
        say="Never run with statistics: no verdict to go by."
      >
        @if (canRun()) {
          <a
            class="go new-tab"
            routerLink="run-with-statistics"
            target="_blank"
            rel="noopener"
            aria-label="Run with statistics, opens in a new tab"
            >Run with statistics<assay-arrow-out
          /></a>
        }
      </assay-state-block>
    }
  `,
})
export class LatestVerdictComponent {
  /** The newest batch: undefined while it's read, null with none. */
  batch = input<BatchSummary | null | undefined>(undefined);
  /** It can be run with statistics (it has checks, or entries). */
  canRun = input(true);
  private tests = inject(StatisticalTestsStore);
  runAgainLink = runAgainLink;
  v = computed(() => {
    const b = this.batch();
    if (!b) return null;
    const line = verdictLine(b);
    const q = question(b.engine, b.parameters, this.tests.byId().get(b.statistical_test)?.name);
    return {
      b,
      say: line.text.charAt(0).toUpperCase() + line.text.slice(1),
      progress: isInFlight(b.status) ? batchProgress(b.progress) : null,
      again: b.status === 'Failed' || b.status === 'Inconclusive',
      facts: `${q} · ${timesText(b)} · ${rel(b.created_at)}`,
    };
  });
  constructor() {
    this.tests.load();
  }
}
