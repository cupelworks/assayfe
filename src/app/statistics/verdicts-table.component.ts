// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Batch, BatchSummary, Comparison, StatsScopeRef } from '../api/models';
import { StatisticalTestsStore, StatisticsApiService } from '../api/statistics-api.service';
import { Paged } from '../shared/paged';
import { errText, isInFlight } from '../shared/format';
import { pollWhile, whenTabShown } from '../shared/poll';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { CATALOG, CatalogColumn, idColumn } from '../shared/catalog';
import { CompareDialogComponent } from './compare-dialog.component';
import { BatchVerdictComponent } from './batch-verdict.component';
import { BATCH_POLL_MS, question, timesText } from './stats-format';

/**
 * A test's, set's or plan's statistics batches, newest first, five a page, as a catalogue's table:
 * the question each asked (to its page), its verdict ("■ Failed: the check fell short of the
 * goal.", with "Run again ↗" on a Failed or Inconclusive one, a progress bar while it runs), how
 * many times, when. Under it, "Compare two of them…" - the compare dialog, on the newest finished
 * one. Polls every 3 seconds while one is under way, and reads again when the tab comes back into
 * view. The newest batch (`newest`) is the page's latest verdict.
 */
@Component({
  selector: 'assay-verdicts-table',
  standalone: true,
  imports: [
    CATALOG,
    PagerComponent,
    RelTimeComponent,
    BatchVerdictComponent,
    CompareDialogComponent,
  ],
  styleUrls: ['../shared/guide/head-aside.css', '../shared/work/work.css'],
  styles: `
    :host {
      display: block;
      grid-column: 1 / -1;
      min-width: 0;
    }
  `,
  template: `
    <assay-catalog-table [label]="label()" [columns]="columns" [empty]="emptyLine()">
      @for (v of rows(); track v.b.id) {
        <assay-catalog-row
          [name]="v.question"
          [link]="['/statistics/batches', v.b.id]"
          [note]="v.b.note"
          [expandable]="false"
        >
          <assay-catalog-cell caption="Verdict">
            <assay-batch-verdict [batch]="v.b" />
          </assay-catalog-cell>
          <assay-catalog-cell caption="Times"
            ><span class="num">{{ v.times }}</span></assay-catalog-cell
          >
          <assay-catalog-cell caption="When"
            ><span class="when"><assay-rel-time [iso]="v.b.created_at" /></span
          ></assay-catalog-cell>
          <assay-catalog-cell caption="Batch ID" [copyId]="v.b.id" />
        </assay-catalog-row>
      }
    </assay-catalog-table>
    <assay-pager
      [total]="page.total()"
      [offset]="page.offset()"
      [limit]="page.limit()"
      (offsetChange)="page.go($event)"
      (limitChange)="page.size($event)"
    />
    @if (page.total() > 1) {
      <div class="ends">
        <button type="button" class="go" [disabled]="finished().length < 2" (click)="compare()">
          Compare two of them…
        </button>
      </div>
    }
    @if (compareFrom(); as b) {
      <assay-compare-dialog
        [batch]="b"
        (created)="compared($event)"
        (closed)="compareFrom.set(null)"
      />
    }
  `,
})
export class VerdictsTableComponent {
  scope = input.required<StatsScopeRef>();
  /** Bump to read again - after something was started from the page. */
  version = input(0);
  label = input('Its batches');
  /** What it says with none: "Never run with statistics. …". */
  empty = input('Never run with statistics.');
  private api = inject(StatisticsApiService);
  private tests = inject(StatisticalTestsStore);
  private router = inject(Router);
  columns: CatalogColumn[] = [
    { label: 'The question', width: 3 },
    { label: 'Verdict', width: 4 },
    { label: 'Times', width: 1 },
    { label: 'When', width: 1.2 },
    idColumn('Batch ID'),
  ];
  page = new Paged<BatchSummary>((o, l) => this.api.batchesPage(this.scope(), o, l), 5, errText);
  /** The newest batch - undefined while it's read, null with none. */
  newest = signal<BatchSummary | null | undefined>(undefined);
  rows = computed(() =>
    this.page.items().map((b) => ({ b, question: this.questionOf(b), times: timesText(b) })),
  );
  emptyLine = computed(() =>
    this.page.loading() || this.page.items().length ? null : this.empty(),
  );
  /** Finished batches with a verdict: the newest is B, the change, in the compare dialog. */
  finished = computed(() =>
    this.page.items().filter((b) => !isInFlight(b.status) && b.status !== 'Done'),
  );
  compareFrom = signal<Batch | null>(null);

  constructor() {
    this.tests.load();
    effect(() => {
      this.scope();
      this.version();
      untracked(() => this.page.reset());
    });
    effect(() => {
      const items = this.page.items();
      if (!this.page.loading() && this.page.offset() === 0) this.newest.set(items[0] ?? null);
    });
    pollWhile(
      () => this.page.items().some((b) => isInFlight(b.status)),
      () => {
        if (!this.page.loading()) this.page.reload();
      },
      BATCH_POLL_MS,
    );
    // Run with statistics opens in its own tab: back here, the batch started there shows.
    whenTabShown(() => {
      if (!this.page.loading()) this.page.reload();
    });
  }

  questionOf(b: BatchSummary) {
    return question(b.engine, b.parameters, this.tests.byId().get(b.statistical_test)?.name);
  }
  compare() {
    const b = this.finished()[0];
    if (!b) return;
    this.api.batch(b.id, false).subscribe((full) => this.compareFrom.set(full));
  }
  compared(c: Comparison) {
    this.compareFrom.set(null);
    this.router.navigate(['/statistics/comparisons', c.id]);
  }
}
