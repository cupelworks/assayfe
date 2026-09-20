import { Injectable, inject, signal, computed } from '@angular/core';
import { forkJoin, of, switchMap, map } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { DatasetsApiService } from './datasets-api.service';
import { TestsApiService } from './tests-api.service';
import { TestSetsApiService } from './test-sets-api.service';
import { TestPlansApiService } from './test-plans-api.service';
import { RunsApiService } from './runs-api.service';
import {
  AnyRunMetadata,
  DataSetMetadata,
  ExecutionMetadata,
  Kind,
  ScopeMetadata,
  TestCase,
} from './models';

/** How many of the newest executions the "Recent executions" table on the overview page shows. */
export const RECENT_EXECUTIONS_LIMIT = 10;
/** How many of the newest runs (any origin) feed the "Run status" sample on the overview page. */
export const RUN_STATUS_SAMPLE_LIMIT = 500;

export interface ExecRow extends ExecutionMetadata {
  kind: Kind;
  parentId: string;
  scope: 'Test set' | 'Test plan';
  target: string;
}

/** Root store: catalogs + every execution (per set/plan) + a run-status sample. Pages read signals; mutations call load(). */
@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private datasetsApi = inject(DatasetsApiService);
  private testsApi = inject(TestsApiService);
  private testSetsApi = inject(TestSetsApiService);
  private testPlansApi = inject(TestPlansApiService);
  private runsApi = inject(RunsApiService);
  loading = signal(true);
  error = signal<string | null>(null);
  datasets = signal<DataSetMetadata[]>([]);
  tests = signal<TestCase[]>([]);
  sets = signal<ScopeMetadata[]>([]);
  plans = signal<ScopeMetadata[]>([]);
  executions = signal<ExecRow[]>([]);
  recentRuns = signal<AnyRunMetadata[]>([]);
  statusLabel = computed(() =>
    this.loading() ? 'Connecting…' : this.error() ? 'API unreachable' : 'Connected',
  );

  byParent(kind: Kind, id: string) {
    return this.executions().filter((e) => e.kind === kind && e.parentId === id);
  }
  parent(kind: Kind, id: string) {
    return (kind === 'test-sets' ? this.sets() : this.plans()).find((x) => x.id === id);
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      datasets: this.datasetsApi.datasets().pipe(map((p) => p.items)),
      tests: this.testsApi.tests().pipe(map((p) => p.test_cases)),
      sets: this.testSetsApi.testSets().pipe(map((p) => p.items)),
      plans: this.testPlansApi.testPlans().pipe(map((p) => p.items)),
      runs: this.runsApi.latestRuns(RUN_STATUS_SAMPLE_LIMIT),
    })
      .pipe(
        switchMap((o) => {
          const reqs = [
            ...o.sets.map((s) =>
              this.runsApi.executions('test-sets', s.id).pipe(
                map((x) =>
                  x.map((e) => ({
                    ...e,
                    kind: 'test-sets' as Kind,
                    parentId: s.id,
                    scope: 'Test set' as const,
                    target: s.name,
                  })),
                ),
              ),
            ),
            ...o.plans.map((p) =>
              this.runsApi.executions('test-plans', p.id).pipe(
                map((x) =>
                  x.map((e) => ({
                    ...e,
                    kind: 'test-plans' as Kind,
                    parentId: p.id,
                    scope: 'Test plan' as const,
                    target: p.name,
                  })),
                ),
              ),
            ),
          ];
          return (reqs.length ? forkJoin(reqs) : of([] as ExecRow[][])).pipe(
            map((ex) => ({
              ...o,
              executions: ex
                .flat()
                .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
            })),
          );
        }),
      )
      .subscribe({
        next: (o) => {
          this.datasets.set(o.datasets);
          this.tests.set(o.tests);
          this.sets.set(o.sets);
          this.plans.set(o.plans);
          this.executions.set(o.executions);
          this.recentRuns.set(o.runs);
          this.loading.set(false);
        },
        error: (e: HttpErrorResponse) => {
          this.error.set(e.message);
          this.loading.set(false);
        },
      });
  }
}
