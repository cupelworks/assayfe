import { Injectable } from '@angular/core';
import * as M from './models';
import { ApiBase, PAGE } from './api-base';

/** Which runs or executions a list holds: `none` leaves out every statistics batch's - they're
 *  listed on their batch's page - and a batch id lists only that batch's. Omitted: all of them. */
export type BatchFilter = 'none' | string | undefined;
const withBatch = (offset: number, limit: number, batch: BatchFilter) =>
  batch ? PAGE(offset, limit).set('batch', batch) : PAGE(offset, limit);

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

  // ---- run (all) ----
  /** Every run in the system, newest first - optionally restricted to one status and/or one origin. */
  latestRunsPage(
    offset = 0,
    limit = 100,
    status?: M.TestStatus,
    origin?: M.RunOrigin,
    batch?: BatchFilter,
  ) {
    let params = withBatch(offset, limit, batch);
    if (status) params = params.set('status', status);
    if (origin) params = params.set('origin', origin);
    return this.http.get<M.Page<M.AnyRunMetadata>>(this.u('/runs'), { params });
  }
  latestRuns(limit = 100, batch?: BatchFilter) {
    return this.safe(this.items(this.latestRunsPage(0, limit, undefined, undefined, batch)));
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
