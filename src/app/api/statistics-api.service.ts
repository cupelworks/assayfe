import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import * as M from './models';
import { ApiBase, PAGE } from './api-base';

/** The scope filter of a list: exactly one of the three ids (or a batch's, for comparisons). */
const scopeParams = (params: HttpParams, filter: Record<string, string | undefined>) =>
  Object.entries(filter).reduce((p, [k, v]) => (v ? p.set(k, v) : p), params);

/** Run with statistics: the catalogue of statistical tests, the estimate, batches (created, read,
 *  stopped, listed per scope) and comparisons of two batches. */
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
  batchesPage(scope: M.StatsScopeRef, offset = 0, limit = 10) {
    return this.http.get<M.Page<M.BatchSummary>>(this.u('/statistics/batches'), {
      params: scopeParams(PAGE(offset, limit), { ...scope }),
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
  comparisonsPage(filter: M.StatsScopeRef & { batch_id?: string }, offset = 0, limit = 10) {
    return this.http.get<M.Page<M.ComparisonSummary>>(this.u('/statistics/comparisons'), {
      params: scopeParams(PAGE(offset, limit), { ...filter }),
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
