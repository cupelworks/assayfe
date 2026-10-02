import { Injectable, inject, signal, computed } from '@angular/core';
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

/** How many of the newest test-set/test-plan executions the Overview table displays. */
export const RECENT_EXECUTIONS_LIMIT = 10;
/**
 * How many of the newest test-set/test-plan executions CatalogStore actually fetches -
 * independent of RECENT_EXECUTIONS_LIMIT (Overview only ever shows the first 10 of these).
 * Feeds the hasRuns() delete-guard on test-set/test-plan detail pages and
 * ExecutionComponent's exec() lookup - both tolerate an incomplete sample (hasRuns() just
 * reads false, exec() just renders without the extra detail it would show), so there's no
 * hard requirement driving this number; 50 is a generous-but-cheap default. NOT used for any
 * displayed count anymore - the scopes list's "Executions" column moved to a per-row fetch
 * against the scoped endpoint instead, since this capped, recency-biased sample can never
 * give an accurate count for an arbitrary row (see dev_notes.md's "Scopes list 'Executions'
 * column moved off the global sample" note).
 */
export const EXECUTIONS_SAMPLE_LIMIT = 50;
/** How many of the newest runs (any origin) feed the "Run status" sample on the overview page. */
export const RUN_STATUS_SAMPLE_LIMIT = 500;

export interface ExecRow extends ExecutionMetadata {
  kind: Kind;
  parentId: string;
  scope: 'Test set' | 'Test plan';
  target: string;
}

/**
 * Root store: catalogs + every execution (per set/plan) + a run-status sample - but nothing
 * loads itself. Every field has its own independent load*() method; pages call only the ones
 * they actually read from, in their own ngOnInit()/constructor. There is no app-wide bootstrap
 * fetch here - the shell doesn't touch this store at all, so visiting any page only ever
 * triggers what that specific page needs.
 */
@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private datasetsApi = inject(DatasetsApiService);
  private testsApi = inject(TestsApiService);
  private testSetsApi = inject(TestSetsApiService);
  private testPlansApi = inject(TestPlansApiService);
  private runsApi = inject(RunsApiService);
  datasets = signal<DataSetMetadata[]>([]);
  tests = signal<TestCase[]>([]);
  sets = signal<ScopeMetadata[]>([]);
  plans = signal<ScopeMetadata[]>([]);
  private rawExecutions = signal<AnyExecutionMetadata[]>([]);
  /** Joins the raw GET /runs/executions rows against sets()/plans() for a display name - reactive to either changing. */
  executions = computed<ExecRow[]>(() => this.rawExecutions().map((e) => this.toExecRow(e)));
  /** Independent of every other loading flag: true while the global executions sample is in flight. */
  executionsLoading = signal(true);
  recentRuns = signal<AnyRunMetadata[]>([]);
  /** Independent of every other loading flag: true while the global run-status sample is in flight. */
  runsLoading = signal(true);

  byParent(kind: Kind, id: string) {
    return this.executions().filter((e) => e.kind === kind && e.parentId === id);
  }
  parent(kind: Kind, id: string) {
    return (kind === 'test-sets' ? this.sets() : this.plans()).find((x) => x.id === id);
  }

  /** Everything - used only by OverviewComponent, which reads every field. */
  load() {
    this.loadDatasets();
    this.loadTests();
    this.loadSets();
    this.loadPlans();
    this.loadExecutions();
    this.loadRunStatus();
  }

  loadDatasets() {
    this.datasetsApi
      .datasets()
      .subscribe({ next: (p) => this.datasets.set(p.items), error: () => {} });
  }

  loadTests() {
    this.testsApi.tests().subscribe({ next: (p) => this.tests.set(p.test_cases), error: () => {} });
  }

  loadSets() {
    this.testSetsApi.testSets().subscribe({ next: (p) => this.sets.set(p.items), error: () => {} });
  }

  loadPlans() {
    this.testPlansApi
      .testPlans()
      .subscribe({ next: (p) => this.plans.set(p.items), error: () => {} });
  }

  loadExecutions() {
    this.executionsLoading.set(true);
    // Ordinary executions only: one statistics batch alone would fill the sample.
    this.runsApi.latestExecutions(EXECUTIONS_SAMPLE_LIMIT, 'none').subscribe((executions) => {
      this.rawExecutions.set(executions);
      this.executionsLoading.set(false);
    });
  }

  loadRunStatus() {
    this.runsLoading.set(true);
    this.runsApi.latestRuns(RUN_STATUS_SAMPLE_LIMIT, 'none').subscribe((runs) => {
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
