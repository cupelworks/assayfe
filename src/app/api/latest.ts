import { effect, inject, signal, untracked } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { BatchSummary, Kind } from './models';
import { RunsApiService } from './runs-api.service';
import { StatisticsApiService } from './statistics-api.service';
import { StatusCount, isInFlight, statusCountsOf } from '../shared/format';
import { pollWhile, whenTabShown } from '../shared/poll';
import { BATCH_POLL_MS } from '../statistics/stats-format';

/**
 * The newest item of each key, in the list's order - the latest verdict, run or comparison of each
 * test, set or plan, from a list that comes newest first - and how many items had that key.
 */
export function firstOfEach<T>(items: T[], key: (item: T) => string) {
  const firsts = new Map<string, { item: T; count: number }>();
  for (const item of items) {
    const k = key(item);
    const seen = firsts.get(k);
    if (seen) seen.count++;
    else firsts.set(k, { item, count: 1 });
  }
  return [...firsts.values()];
}

/** What a row of a work list is: a test, or a set or plan (`Kind`). */
export type LatestKind = 'tests' | Kind;

/** A row's latest run: a test's one status, or a set's or plan's run counted by status - and how
 *  many runs it has had (a set's or plan's executions; a test's runs outside a batch). */
export interface LatestRun {
  status: string | null;
  counts: StatusCount[];
  at: string;
  total: number;
  /** A set's or plan's execution id, to open it; a test's run id. */
  id: string;
  replayed: boolean;
}

const SCOPE_PARAM: Record<LatestKind, 'test_id' | 'test_set_id' | 'test_plan_id'> = {
  tests: 'test_id',
  'test-sets': 'test_set_id',
  'test-plans': 'test_plan_id',
};

/**
 * Each shown row's latest verdict (its newest statistics batch) and latest run (outside a batch -
 * a set's or plan's counted as it comes), for a work list or a page's table - a call each per row,
 * as the API has no "latest" per item yet (see docs/to_be_implemented_after_be_version_2/
 * dev_notes.md). Read again whenever the rows change; polled as the pages that show them are - the
 * runs every 2 seconds while one is pending
 * or running, the batches every 3 - and again when the tab comes back into view ("Run with
 * statistics ↗" opens its own).
 *
 * Create it in a field initializer: it injects, and starts its own effect and polls. A value is
 * `undefined` while it's read, `null` when there's none.
 */
export class LatestByRow {
  private runsApi = inject(RunsApiService);
  private statsApi = inject(StatisticsApiService);
  verdicts = signal<Record<string, BatchSummary | null>>({});
  runs = signal<Record<string, LatestRun | null>>({});

  constructor(
    private kind: () => LatestKind,
    private ids: () => string[],
    private want: { verdicts?: boolean; runs?: boolean } = { verdicts: true, runs: true },
  ) {
    effect((onCleanup) => {
      const ids = this.ids();
      const kind = this.kind();
      const subs = untracked(() => [this.loadVerdicts(kind, ids), this.loadRuns(kind, ids)]);
      onCleanup(() => subs.forEach((s) => s?.unsubscribe()));
    });
    pollWhile(
      () =>
        Object.values(this.runs()).some(
          (r) => isInFlight(r?.status) || !!r?.counts.some((c) => isInFlight(c.key)),
        ),
      () => this.loadRuns(this.kind(), this.ids()),
    );
    pollWhile(
      () => Object.values(this.verdicts()).some((b) => isInFlight(b?.status)),
      () => this.loadVerdicts(this.kind(), this.ids()),
      BATCH_POLL_MS,
    );
    whenTabShown(() => this.reload());
  }

  reload() {
    this.loadVerdicts(this.kind(), this.ids());
    this.loadRuns(this.kind(), this.ids());
  }

  private loadVerdicts(kind: LatestKind, ids: string[]) {
    if (!this.want.verdicts) return null;
    if (!ids.length) {
      this.verdicts.set({});
      return null;
    }
    return forkJoin(
      ids.map((id) =>
        this.statsApi.batchesPage({ [SCOPE_PARAM[kind]]: id }, 0, 1).pipe(
          map((p) => [id, p.items[0] ?? null] as const),
          catchError(() => of([id, null] as const)),
        ),
      ),
    ).subscribe((pairs) => this.verdicts.set(Object.fromEntries(pairs)));
  }

  private loadRuns(kind: LatestKind, ids: string[]) {
    if (!this.want.runs) return null;
    if (!ids.length) {
      this.runs.set({});
      return null;
    }
    return forkJoin(ids.map((id) => this.latestRun(kind, id))).subscribe((pairs) =>
      this.runs.set(Object.fromEntries(pairs)),
    );
  }

  private latestRun(kind: LatestKind, id: string): Observable<readonly [string, LatestRun | null]> {
    if (kind === 'tests') {
      return this.runsApi.standaloneRunsPage(id, 0, 1, 'none').pipe(
        map((p) => {
          const r = p.items[0];
          return [
            id,
            r
              ? {
                  status: r.status,
                  counts: [],
                  at: r.created_at,
                  total: p.total,
                  id: r.id,
                  replayed: false,
                }
              : null,
          ] as const;
        }),
        catchError(() => of([id, null] as const)),
      );
    }
    return this.runsApi.executionsPage(kind, id, 0, 1, 'none').pipe(
      map((p) => {
        const e = p.items[0];
        return [
          id,
          e
            ? {
                status: null,
                counts: statusCountsOf(e.runs),
                at: e.created_at,
                total: p.total,
                id: e.id,
                replayed: !!e.replayed_execution_id,
              }
            : null,
        ] as const;
      }),
      catchError(() => of([id, null] as const)),
    );
  }
}
