import { Injectable } from '@angular/core';
import * as M from './models';
import { ApiBase, PAGE, QUERY } from './api-base';
import { ListParams } from '../shared/work/api-list';

@Injectable({ providedIn: 'root' })
export class TestPlansApiService extends ApiBase {
  /** The plans the parameters let through (API 2.0: search, filters, sort - `ListParams`). */
  testPlans(offset = 0, limit = 100, params: ListParams = {}) {
    return this.http.get<M.Page<M.ScopeRead>>(this.u('/test-plans'), {
      params: QUERY({ ...params, offset, limit }),
    });
  }
  testPlan(id: string) {
    return this.http.get<M.ScopeRead>(this.u(`/test-plans/${id}`));
  }
  createTestPlan(name: string) {
    return this.http.post<M.DataSetInfo>(this.u('/test-plans'), { name });
  }
  renameTestPlan(id: string, name: string) {
    return this.http.patch<M.ScopeRead>(this.u(`/test-plans/${id}`), { name });
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
}
