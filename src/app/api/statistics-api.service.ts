import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import * as M from './models';
import { ApiBase, QUERY } from './api-base';

/** What a list of batches or comparisons is narrowed by (API 2.1.0): a test, set or plan - or
 *  several, any of them. Different filters narrow together, so a test and a set match nothing: a
 *  batch has one scope. */
export type StatsScopeQuery = {
  test_id?: string | readonly string[];
  test_set_id?: string | readonly string[];
  test_plan_id?: string | readonly string[];
};
/** Batches by status too: any of them. */
export type BatchQuery = StatsScopeQuery & { status?: readonly string[] };
/** Comparisons by outcome too (any of them), or by one batch, as A or B. */
export type ComparisonQuery = StatsScopeQuery & { outcome?: readonly string[]; batch_id?: string };

/** Run with statistics: the catalogue of statistical tests, the estimate, batches (created, read,
 *  stopped, listed and counted) and comparisons of two batches (listed and counted too). */
@Injectable({ providedIn: 'root' })
export class StatisticsApiService extends ApiBase {
  catalogue() {
    return this.http.get<M.StatisticalTestCatalogue>(this.u('/statistics/tests'));
  }
  /** What a batch would need and cost - creates nothing. */
  estimate(body: M.EstimateRequest) {
    return this.http.post<M.Estimate>(this.u('/statistics/estimate'), body);
  }
  createBatch(body: M.BatchRequest) {
    return this.http.post<M.Batch>(this.u('/statistics/batches'), body);
  }
  /** Newest first. */
  batchesPage(query: BatchQuery, offset = 0, limit = 10) {
    return this.http.get<M.Page<M.BatchSummary>>(this.u('/statistics/batches'), {
      params: QUERY({ ...query, offset, limit }),
    });
  }
  /** The batches the query lets through, counted by status and by scope - each within the
   *  others. In-progress ones are brought up to date first, as the list does. */
  batchFacets(query: BatchQuery) {
    return this.http.get<M.BatchFacets>(this.u('/statistics/batches/facets'), {
      params: QUERY({ ...query }),
    });
  }
  /** `series: false` leaves out the per-run series and strips. */
  batch(id: string, series = true) {
    const params = series ? undefined : new HttpParams().set('series', 'false');
    return this.http.get<M.Batch>(this.u(`/statistics/batches/${id}`), { params });
  }
  /** Pending runs are cancelled; running ones finish. A finished batch is returned unchanged. */
  stop(id: string) {
    return this.http.post<M.Batch>(this.u(`/statistics/batches/${id}/stop`), null);
  }
  createComparison(body: M.ComparisonRequest) {
    return this.http.post<M.Comparison>(this.u('/statistics/comparisons'), body);
  }
  /** Newest first. */
  comparisonsPage(query: ComparisonQuery, offset = 0, limit = 10) {
    return this.http.get<M.Page<M.ComparisonSummary>>(this.u('/statistics/comparisons'), {
      params: QUERY({ ...query, offset, limit }),
    });
  }
  /** The comparisons the query lets through, counted by outcome and by scope - each within the
   *  others. */
  comparisonFacets(query: ComparisonQuery) {
    return this.http.get<M.ComparisonFacets>(this.u('/statistics/comparisons/facets'), {
      params: QUERY({ ...query }),
    });
  }
  comparison(id: string) {
    return this.http.get<M.Comparison>(this.u(`/statistics/comparisons/${id}`));
  }
}

/** The statistical tests catalogue, fetched once per app session - it only changes with the API. */
@Injectable({ providedIn: 'root' })
export class StatisticalTestsStore {
  private api = inject(StatisticsApiService);
  items = signal<M.StatisticalTest[]>([]);
  maxTimes = signal(1000);
  private loaded = false;
  /** The tests that decide one batch's checks, in the catalogue's order. */
  batchTests = computed(() => this.items().filter((t) => t.kind === 'batch'));
  /** The tests that compare two batches. */
  comparisonTests = computed(() => this.items().filter((t) => t.kind === 'comparison'));
  byId = computed(() => new Map(this.items().map((t) => [t.id, t])));
  load() {
    if (this.loaded) return;
    this.loaded = true;
    this.api.catalogue().subscribe({
      next: (c) => {
        this.items.set(c.items);
        this.maxTimes.set(c.max_times);
      },
      error: () => (this.loaded = false),
    });
  }
}
