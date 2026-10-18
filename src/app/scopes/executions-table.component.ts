// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { RunsApiService } from '../api/runs-api.service';
import { ExecutionMetadata, Kind } from '../api/models';
import { StatusCount, errText, isInFlight, statusCountsOf } from '../shared/format';
import { Paged } from '../shared/paged';
import { pollWhile } from '../shared/poll';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { StatusCountsComponent } from '../shared/status-counts.component';
import { CATALOG, CatalogColumn, CatalogTag, idColumn } from '../shared/catalog';

/** A run of a set or plan: its execution, and its runs counted by status. */
export interface ExecutionRow {
  e: ExecutionMetadata;
  counts: StatusCount[];
}

/** What a run of a set or plan ran, in words. */
export const whatRan = (e: ExecutionMetadata, kind: Kind) =>
  e.replayed_execution_id
    ? 'Replayed an earlier run, with the same copies'
    : kind === 'test-sets'
      ? 'Live: the tests in the set at the time'
      : 'Live: the sets as they were';

/**
 * A set's or plan's runs outside a batch, newest first, five a page, as a catalogue's table: a
 * live run or a replay (to its page), how it went - its runs counted by status, as each one comes
 * (`runs`) - when, and Replay. Polls every 2 seconds while a run is under way. The newest
 * (`newest`) is the page's latest run.
 */
@Component({
  selector: 'assay-executions-table',
  standalone: true,
  imports: [CATALOG, PagerComponent, RelTimeComponent, StatusCountsComponent],
  styleUrls: ['../shared/guide/head-aside.css', '../shared/work/work.css'],
  styles: `
    :host {
      display: block;
      grid-column: 1 / -1;
      min-width: 0;
    }
  `,
  template: `
    <assay-catalog-table label="Its runs" [columns]="columns" [empty]="emptyLine()">
      @for (r of rows(); track r.e.id) {
        <assay-catalog-row
          [name]="r.e.replayed_execution_id ? 'Replay' : 'Live run'"
          [link]="['/', kind(), id(), 'executions', r.e.id]"
          [tags]="r.e.replayed_execution_id ? replayTag : []"
          [expandable]="false"
        >
          <assay-catalog-cell caption="How it went">
            @if (r.counts.length) {
              <assay-status-counts [counts]="r.counts" />
            } @else {
              <span class="muted">Nothing ran: no tests</span>
            }
          </assay-catalog-cell>
          <assay-catalog-cell caption="When"
            ><span class="when"><assay-rel-time [iso]="r.e.created_at" /></span
          ></assay-catalog-cell>
          <assay-catalog-cell caption="ID" [copyId]="r.e.id" />
          <assay-catalog-cell caption="">
            <button type="button" class="row-act" [disabled]="busy()" (click)="replay.emit(r.e.id)">
              Replay
            </button>
          </assay-catalog-cell>
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
  `,
})
export class ExecutionsTableComponent {
  kind = input.required<Kind>();
  id = input.required<string>();
  busy = input(false);
  /** Bump to read again - after Run live or Replay. */
  version = input(0);
  replay = output<string>();
  private api = inject(RunsApiService);
  columns: CatalogColumn[] = [
    { label: 'Run', width: 2 },
    { label: 'How it went', width: 4.2 },
    { label: 'When', width: 1.6 },
    idColumn(),
    { label: '', width: 1.2 },
  ];
  replayTag: CatalogTag[] = [{ text: 'Of an earlier run' }];
  page = new Paged<ExecutionMetadata>(
    // A statistics batch's runs are on its own page - dozens of them would bury these.
    (o, l) => this.api.executionsPage(this.kind(), this.id(), o, l, 'none'),
    5,
    errText,
  );
  rows = computed<ExecutionRow[]>(() =>
    this.page.items().map((e) => ({ e, counts: statusCountsOf(e.runs) })),
  );
  /** The newest run - undefined while it's read, null with none. */
  newest = signal<ExecutionRow | null | undefined>(undefined);
  emptyLine = computed(() =>
    this.page.loading() || this.page.items().length
      ? null
      : 'Never run outside a batch - Run live runs it.',
  );

  constructor() {
    effect(() => {
      this.kind();
      this.id();
      this.version();
      untracked(() => this.page.reload());
    });
    // The newest, from the first page once it's in - kept while another page is shown.
    effect(() => {
      const rows = this.rows();
      if (!this.page.loading() && this.page.offset() === 0) this.newest.set(rows[0] ?? null);
    });
    pollWhile(
      () => this.rows().some((r) => r.counts.some((c) => isInFlight(c.key))),
      () => {
        if (!this.page.loading()) this.page.reload();
      },
    );
  }
}
