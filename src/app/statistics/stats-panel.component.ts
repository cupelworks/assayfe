import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BatchSummary, ComparisonSummary, StatsScopeRef } from '../api/models';
import { StatisticalTestsStore, StatisticsApiService } from '../api/statistics-api.service';
import { Paged } from '../shared/paged';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { StatusMarkComponent, markLabel } from '../shared/status-mark.component';
import { errText, isInFlight } from '../shared/format';
import { pollWhile } from '../shared/poll';
import { question, timesText } from './stats-format';

/** One square per check, failed first: the batch's verdicts at a glance. */
const VERDICT_ORDER = ['fail', 'inconclusive', 'none', 'pass'];

/**
 * A test's, set's or plan's statistics batches, newest first, and the comparisons made of them -
 * nothing at all until the first batch exists, so the page stays as it was for anyone who never
 * runs with statistics. Polls while a batch is still pending or running.
 */
@Component({
  selector: 'assay-stats-panel',
  standalone: true,
  imports: [RouterLink, PagerComponent, RelTimeComponent, StatusMarkComponent],
  styleUrls: ['../shared/page.css', './stats-panel.component.css'],
  templateUrl: './stats-panel.component.html',
})
export class StatsPanelComponent {
  scope = input.required<StatsScopeRef>();
  /** What one time runs, for the copy: "test", "set" or "plan". */
  noun = input('set');
  /** Bump to reload, e.g. after a batch was started from the page. */
  version = input(0);
  private api = inject(StatisticsApiService);
  private tests = inject(StatisticalTestsStore);
  markLabel = markLabel;
  page = new Paged<BatchSummary>((o, l) => this.api.batchesPage(this.scope(), o, l), 5, errText);
  comparisons = new Paged<ComparisonSummary>(
    (o, l) => this.api.comparisonsPage(this.scope(), o, l),
    5,
    errText,
  );
  rows = computed(() =>
    this.page.items().map((b) => {
      const p = b.progress;
      const verdicts = b.verdicts;
      return {
        b,
        question: question(b.engine, b.parameters, this.tests.byId().get(b.statistical_test)?.name),
        size: timesText(b),
        running: isInFlight(b.status),
        donePct: p.times_requested ? Math.round((p.times_done / p.times_requested) * 100) : 0,
        progressLine: `${p.times_done} of ${p.waves ? 'up to ' : ''}${p.times_requested} times done · ${p.runs_done} of ${p.runs_total} runs`,
        squares: verdicts
          ? VERDICT_ORDER.flatMap((v) => Array.from({ length: verdicts[v] ?? 0 }, () => v))
          : [],
      };
    }),
  );
  private inFlight = computed(() => this.page.items().some((b) => isInFlight(b.status)));
  constructor() {
    this.tests.load();
    effect(() => {
      this.scope();
      this.version();
      // untracked: reset() reads the pages' own offset/limit signals.
      untracked(() => {
        this.page.reset();
        this.comparisons.reset();
      });
    });
    pollWhile(
      () => this.inFlight(),
      () => {
        if (!this.page.loading()) this.page.reload();
      },
      3000,
    );
  }
}
