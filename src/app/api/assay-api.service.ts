import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map, of, catchError } from 'rxjs';
import { ASSAY_API_BASE } from './api-base.token';
import * as M from './models';

const PAGE = (offset = 0, limit = 100) => new HttpParams({ fromObject: { offset, limit } });

/** One method per Assay endpoint. Bulk bodies are plain arrays of {id} - exactly what the spec declares. */
@Injectable({ providedIn: 'root' })
export class AssayApiService {
  private http = inject(HttpClient);
  readonly base = inject(ASSAY_API_BASE).replace(/\/$/, '');
  private u(p: string) {
    return `${this.base}${p}`;
  }
  private ids(list: string[]) {
    return list.map((id) => ({ id }));
  }
  safe<T>(o: Observable<T[]>) {
    return o.pipe(catchError(() => of([] as T[])));
  }
  private items<T>(o: Observable<M.Page<T>>) {
    return o.pipe(map((p) => p.items));
  }

  health() {
    return this.http.get<unknown>(this.u('/health'));
  }

  // ---- datasets ----
  datasets(offset = 0, limit = 100) {
    return this.http.get<M.Page<M.DataSetMetadata>>(this.u('/datasets'), {
      params: PAGE(offset, limit),
    });
  }
  dataset(id: string) {
    return this.http.get<M.DataSetMetadata>(this.u(`/datasets/${id}`));
  }
  datasetRows(id: string, offset = 0, limit = 50) {
    return this.http.get<M.DataSetRowPage>(this.u(`/datasets/${id}/rows`), {
      params: PAGE(offset, limit),
    });
  }
  createDatasetFromPath(path: string, dataset_name: string) {
    return this.http.post<M.DataSetImportResult>(this.u('/datasets/path'), { path, dataset_name });
  }
  addDatasetRows(id: string, rows: M.DataSetRowSchema[]) {
    return this.http.post<M.DataSetImportResult>(this.u('/datasets/rows'), { id, rows });
  }
  replaceDatasetRows(id: string, rows: M.DataSetRowSchema[]) {
    return this.http.put<M.DataSetImportResult>(this.u('/datasets/rows'), { id, rows });
  }
  updateDatasetRows(rows: M.DataSetRow[]) {
    return this.http.patch<M.DataSetMutationResult>(this.u('/datasets/rows'), rows);
  }
  deleteDatasetRows(row_ids: string[]) {
    return this.http.delete<M.DataSetMutationResult>(this.u('/datasets/rows'), {
      body: { row_ids },
    });
  }
  renameDataset(id: string, name: string) {
    return this.http.patch<M.DataSetInfo>(this.u('/datasets/name'), { id, name });
  }
  deleteDataset(id: string) {
    return this.http.delete<M.DataSetMutationResult>(this.u('/datasets'), { body: { id } });
  }

  // ---- tests ----
  tests(offset = 0, limit = 100) {
    return this.http.get<M.TestCasePage>(this.u('/tests'), { params: PAGE(offset, limit) });
  }
  /** tests() normalised to the common Page shape (the API names the array `test_cases`). */
  testsPage(offset = 0, limit = 100) {
    return this.tests(offset, limit).pipe(
      map(
        (p) =>
          ({
            total: p.total,
            offset: p.offset,
            limit: p.limit,
            items: p.test_cases,
          }) as M.Page<M.TestCase>,
      ),
    );
  }
  test(id: string) {
    return this.http.get<M.TestCase>(this.u(`/tests/${id}`));
  }
  createTest(body: M.TestCaseBody) {
    return this.http.post<M.TestCase>(this.u('/tests'), body);
  }
  updateTest(id: string, body: M.ModifyTestCase) {
    return this.http.patch<M.TestCase>(this.u(`/tests/${id}`), body);
  }
  deleteTests(ids: string[]) {
    return this.http.delete<unknown>(this.u('/tests'), { body: this.ids(ids) });
  }
  createTestsFromDataset(datasetId: string, test_type_names?: string[]) {
    return this.http.post<{ id: string; test_cases: M.Ref[] }>(this.u('/tests/from-dataset'), {
      id: datasetId,
      ...(test_type_names?.length ? { test_type_names } : {}),
    });
  }

  // ---- test types catalogue ----
  testTypes(category: M.TestCategory) {
    return this.http.get<M.TestType[]>(this.u('/tests/types'), {
      params: new HttpParams({ fromObject: { test_category: category } }),
    });
  }
  /** All three categories in one call. */
  allTestTypes() {
    return forkJoin(
      (['deterministic', 'nlp_metric', 'llm_as_judge'] as M.TestCategory[]).map((c) =>
        this.safe(this.testTypes(c)),
      ),
    ).pipe(map((x) => x.flat()));
  }

  // ---- test sets ----
  testSets(offset = 0, limit = 100) {
    return this.http.get<M.Page<M.ScopeMetadata>>(this.u('/test-sets'), {
      params: PAGE(offset, limit),
    });
  }
  testSet(id: string) {
    return this.http.get<M.ScopeMetadata>(this.u(`/test-sets/${id}`));
  }
  createTestSet(name: string) {
    return this.http.post<M.DataSetInfo>(this.u('/test-sets'), { name });
  }
  renameTestSet(id: string, name: string) {
    return this.http.patch<M.ScopeMetadata>(this.u(`/test-sets/${id}`), { name });
  }
  deleteTestSet(id: string) {
    return this.http.delete<unknown>(this.u(`/test-sets/${id}`));
  }
  testSetEntries(id: string, offset = 0, limit = 100) {
    return this.http.get<M.Page<M.TestSetEntry>>(this.u(`/test-sets/${id}/entries`), {
      params: PAGE(offset, limit),
    });
  }
  testSetEntry(setId: string, entryId: string) {
    return this.http.get<M.TestSetEntry>(this.u(`/test-sets/${setId}/entries/${entryId}`));
  }
  updateTestSetEntry(setId: string, entryId: string, body: M.ModifyTestCase) {
    return this.http.patch<M.TestSetEntry>(this.u(`/test-sets/${setId}/entries/${entryId}`), body);
  }
  /** Snapshot tests into frozen entries. */
  addTestsToSet(setId: string, testIds: string[]) {
    return this.http.post<M.Ref[]>(this.u(`/test-sets/${setId}/entries`), this.ids(testIds));
  }
  /** Non-destructive: clears membership, keeps entry + its runs. */
  unlinkEntries(setId: string, entryIds: string[]) {
    return this.http.patch<unknown>(this.u(`/test-sets/${setId}/entries`), this.ids(entryIds));
  }
  /** Destructive; 409 if any entry has runs. */
  deleteEntries(setId: string, entryIds: string[]) {
    return this.http.delete<unknown>(this.u(`/test-sets/${setId}/entries`), {
      body: this.ids(entryIds),
    });
  }

  // ---- test plans ----
  testPlans(offset = 0, limit = 100) {
    return this.http.get<M.Page<M.ScopeMetadata>>(this.u('/test-plans'), {
      params: PAGE(offset, limit),
    });
  }
  testPlan(id: string) {
    return this.http.get<M.ScopeMetadata>(this.u(`/test-plans/${id}`));
  }
  createTestPlan(name: string) {
    return this.http.post<M.DataSetInfo>(this.u('/test-plans'), { name });
  }
  renameTestPlan(id: string, name: string) {
    return this.http.patch<M.ScopeMetadata>(this.u(`/test-plans/${id}`), { name });
  }
  deleteTestPlan(id: string) {
    return this.http.delete<unknown>(this.u(`/test-plans/${id}`));
  }
  testPlanEntries(id: string, offset = 0, limit = 100) {
    return this.http.get<M.Page<M.TestPlanEntry>>(this.u(`/test-plans/${id}/entries`), {
      params: PAGE(offset, limit),
    });
  }
  linkSetsToPlan(planId: string, setIds: string[]) {
    return this.http.post<M.Ref[]>(this.u(`/test-plans/${planId}/entries`), this.ids(setIds));
  }
  unlinkSetsFromPlan(planId: string, setIds: string[]) {
    return this.http.delete<unknown>(this.u(`/test-plans/${planId}/entries`), {
      body: this.ids(setIds),
    });
  }

  // ---- runs ----
  runStandalone(testId: string) {
    return this.http.post<M.StandaloneRun>(this.u(`/runs/standalone/${testId}`), null);
  }
  standaloneRunsPage(testId: string, offset = 0, limit = 50) {
    return this.http.get<M.Page<M.StandaloneRun>>(this.u(`/runs/standalone/${testId}/test-runs`), {
      params: PAGE(offset, limit),
    });
  }
  standaloneRun(testId: string, runId: string) {
    return this.http.get<M.StandaloneRunDetails>(
      this.u(`/runs/standalone/${testId}/test-runs/${runId}`),
    );
  }
  runLive(kind: M.Kind, id: string) {
    return this.http.post<M.ExecutionMetadata>(this.u(`/runs/${kind}/${id}`), null);
  }
  replay(kind: M.Kind, id: string, execId: string) {
    return this.http.post<M.ExecutionMetadata>(
      this.u(`/runs/${kind}/${id}/executions/${execId}`),
      null,
    );
  }
  executionsPage(kind: M.Kind, id: string, offset = 0, limit = 50) {
    return this.http.get<M.Page<M.ExecutionMetadata>>(this.u(`/runs/${kind}/${id}/executions`), {
      params: PAGE(offset, limit),
    });
  }
  executions(kind: M.Kind, id: string) {
    return this.safe(this.items(this.executionsPage(kind, id, 0, 100)));
  }
  executionRunsPage(kind: M.Kind, id: string, execId: string, offset = 0, limit = 50) {
    return this.http.get<M.Page<M.RunMetadata>>(
      this.u(`/runs/${kind}/${id}/executions/${execId}/test-runs`),
      { params: PAGE(offset, limit) },
    );
  }
  executionRuns(kind: M.Kind, id: string, execId: string) {
    return this.safe(this.items(this.executionRunsPage(kind, id, execId, 0, 100)));
  }
  runDetails(kind: M.Kind, id: string, execId: string, runId: string) {
    return this.http.get<M.RunDetails>(
      this.u(`/runs/${kind}/${id}/executions/${execId}/test-runs/${runId}`),
    );
  }

  overview() {
    return forkJoin({
      datasets: this.items(this.datasets()),
      tests: this.tests().pipe(map((p) => p.test_cases)),
      sets: this.items(this.testSets()),
      plans: this.items(this.testPlans()),
    });
  }
}
