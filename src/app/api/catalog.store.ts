import { Injectable, inject, signal, computed } from '@angular/core';
import { forkJoin, map } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { DatasetsApiService } from './datasets-api.service';
import { TestsApiService } from './tests-api.service';
import { TestSetsApiService } from './test-sets-api.service';
import { TestPlansApiService } from './test-plans-api.service';
import { RunsApiService } from './runs-api.service';
import { short } from '../shared/format';
import {
  AnyExecutionMetadata,
  AnyRunMetadata,
  DataSetMetadata,
  ExecutionMetadata,
  Kind,
  ScopeMetadata,
  TestCase,
} from './models';

/**
 * How many of the newest test-set/test-plan executions CatalogStore fetches and the "Recent
 * executions" table on the overview page shows - the fetch and the display are the same size,
 * so this also bounds the byParent()/hasRuns() lookups other pages use to predict 409s (a scope
 * whose most recent execution isn't in this window reads as "no runs" until it 409s for real).
 */
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
  /** Catalog (datasets/tests/sets/plans) loading/error - drives the shell's connection status. */
  loading = signal(true);
  error = signal<string | null>(null);
  /** Independent of `loading`: true while the global executions sample is in flight. */
  executionsLoading = signal(true);
  /** Independent of `loading`: true while the global run-status sample is in flight. */
  runsLoading = signal(true);
  datasets = signal<DataSetMetadata[]>([]);
  tests = signal<TestCase[]>([]);
  sets = signal<ScopeMetadata[]>([]);
  plans = signal<ScopeMetadata[]>([]);
  private rawExecutions = signal<AnyExecutionMetadata[]>([]);
  /** Joins the raw GET /runs/executions rows against sets()/plans() for a display name - reactive to either changing. */
  executions = computed<ExecRow[]>(() => this.rawExecutions().map((e) => this.toExecRow(e)));
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

  /** Three independent pipelines: catalog, executions, and the run-status sample. None blocks the others. */
  load() {
    this.loadCatalog();
    this.loadExecutions();
    this.loadRunStatus();
  }

  private loadCatalog() {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      datasets: this.datasetsApi.datasets().pipe(map((p) => p.items)),
      tests: this.testsApi.tests().pipe(map((p) => p.test_cases)),
      sets: this.testSetsApi.testSets().pipe(map((p) => p.items)),
      plans: this.testPlansApi.testPlans().pipe(map((p) => p.items)),
    }).subscribe({
      next: (o) => {
        this.datasets.set(o.datasets);
        this.tests.set(o.tests);
        this.sets.set(o.sets);
        this.plans.set(o.plans);
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(e.message);
        this.loading.set(false);
      },
    });
  }

  private loadExecutions() {
    this.executionsLoading.set(true);
    this.runsApi.latestExecutions(RECENT_EXECUTIONS_LIMIT).subscribe((executions) => {
      this.rawExecutions.set(executions);
      this.executionsLoading.set(false);
    });
  }

  private loadRunStatus() {
    this.runsLoading.set(true);
    this.runsApi.latestRuns(RUN_STATUS_SAMPLE_LIMIT).subscribe((runs) => {
      this.recentRuns.set(runs);
      this.runsLoading.set(false);
    });
  }

  private toExecRow(e: AnyExecutionMetadata): ExecRow {
    const isSet = e.origin === 'TestSet';
    const kind: Kind = isSet ? 'test-sets' : 'test-plans';
    const parentId = (isSet ? e.test_set_id : e.test_plan_id)!.id;
    const replayed = isSet ? e.replayed_test_set_execution_id : e.replayed_test_plan_execution_id;
    const name = (isSet ? this.sets() : this.plans()).find((x) => x.id === parentId)?.name;
    return {
      id: e.id,
      created_at: e.created_at,
      run_count: e.run_count,
      replayed_execution_id: replayed ?? null,
      kind,
      parentId,
      scope: isSet ? 'Test set' : 'Test plan',
      target: name ?? short(parentId),
    };
  }
}
