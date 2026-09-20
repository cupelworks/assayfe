import { Injectable } from '@angular/core';
import * as M from './models';
import { ApiBase, PAGE } from './api-base';

@Injectable({ providedIn: 'root' })
export class RunsApiService extends ApiBase {
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
}
