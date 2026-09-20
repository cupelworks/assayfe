import { Injectable } from '@angular/core';
import * as M from './models';
import { ApiBase, PAGE } from './api-base';

@Injectable({ providedIn: 'root' })
export class TestPlansApiService extends ApiBase {
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
}
