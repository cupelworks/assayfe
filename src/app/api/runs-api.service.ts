import { Injectable } from '@angular/core';
import * as M from './models';
import { ApiBase, PAGE, QUERY } from './api-base';

/** Which runs or executions a list holds: `none` leaves out every statistics batch's - they're
 *  listed on their batch's page - and a batch id lists only that batch's. Omitted: all of them. */
export type BatchFilter = 'none' | string | undefined;
const withBatch = (offset: number, limit: number, batch: BatchFilter) =>
  batch ? PAGE(offset, limit).set('batch', batch) : PAGE(offset, limit);

/** What `GET /runs` and `GET /runs/facets` narrow by (API 2.0): several values of one filter add up
 *  (any of them), different filters narrow together; `q` - each phrase must be found in the run's
 *  test's, set's or plan's name, ignoring case; `created_from` is inclusive, `created_to` not. */
export interface RunQuery {
  status?: readonly M.TestStatus[];
  origin?: readonly M.RunOrigin[];
  test_set_id?: readonly string[];
  test_plan_id?: readonly string[];
  check_type?: readonly string[];
  created_from?: string | null;
  created_to?: string | null;
  q?: readonly string[];
  batch?: BatchFilter;
}
/** How `GET /runs` orders: by when each run was made. */
export type RunSort = 'newest' | 'oldest';
/** How a set's or plan's run lists its runs: worst first (Not Ran, Red, Amber, Green, Running,
 *  Pending - then by the test's name, ignoring case), by the test's name, or newest first. */
export type ExecutionRunSort = 'worst_first' | 'name' | 'newest';

@Injectable({ providedIn: 'root' })
export class RunsApiService extends ApiBase {
  runStandalone(testId: string) {
    return this.http.post<M.StandaloneRun>(this.u(`/runs/standalone/${testId}`), null);
  }
  standaloneRunsPage(testId: string, offset = 0, limit = 50, batch?: BatchFilter) {
    return this.http.get<M.Page<M.StandaloneRun>>(this.u(`/runs/standalone/${testId}/test-runs`), {
      params: withBatch(offset, limit, batch),
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
  executionsPage(kind: M.Kind, id: string, offset = 0, limit = 50, batch?: BatchFilter) {
    return this.http.get<M.Page<M.ExecutionMetadata>>(this.u(`/runs/${kind}/${id}/executions`), {
      params: withBatch(offset, limit, batch),
    });
  }
  executions(kind: M.Kind, id: string, batch?: BatchFilter) {
    return this.safe(this.items(this.executionsPage(kind, id, 0, 100, batch)));
  }
  /** A set's or plan's run, read on its own: its runs counted by status, its checks counted. */
  execution(kind: M.Kind, id: string, execId: string) {
    return this.http.get<M.ExecutionDetails>(this.u(`/runs/${kind}/${id}/executions/${execId}`));
  }
  executionRunsPage(
    kind: M.Kind,
    id: string,
    execId: string,
    offset = 0,
    limit = 50,
    sort?: ExecutionRunSort,
  ) {
    return this.http.get<M.Page<M.ExecutionRun>>(
      this.u(`/runs/${kind}/${id}/executions/${execId}/test-runs`),
      { params: QUERY({ offset, limit, sort }) },
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

  // ---- run (all) ----
  /** Every run in the system that the query lets through - newest first unless `sort` says. */
  runsPage(query: RunQuery, offset = 0, limit = 100, sort?: RunSort) {
    return this.http.get<M.Page<M.AnyRunMetadata>>(this.u('/runs'), {
      params: QUERY({ ...query, offset, limit, sort }),
    });
  }
  latestRuns(limit = 100, batch?: BatchFilter) {
    return this.safe(this.items(this.runsPage({ batch }, 0, limit)));
  }
  /** The runs the query lets through, counted by status and by origin - each within the others. */
  runFacets(query: RunQuery) {
    return this.http.get<M.RunFacets>(this.u('/runs/facets'), { params: QUERY({ ...query }) });
  }
  /** Every test set and test plan execution in the system, newest first. Excludes standalone runs - they have no execution wrapper. */
  latestExecutionsPage(offset = 0, limit = 100, batch?: BatchFilter) {
    return this.http.get<M.Page<M.AnyExecutionMetadata>>(this.u('/runs/executions'), {
      params: withBatch(offset, limit, batch),
    });
  }
  latestExecutions(limit = 100, batch?: BatchFilter) {
    return this.safe(this.items(this.latestExecutionsPage(0, limit, batch)));
  }
}
