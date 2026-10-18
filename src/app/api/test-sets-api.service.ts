// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Injectable } from '@angular/core';
import * as M from './models';
import { ApiBase, PAGE, QUERY } from './api-base';
import { ListParams } from '../shared/work/api-list';

@Injectable({ providedIn: 'root' })
export class TestSetsApiService extends ApiBase {
  /** The sets the parameters let through (API 2.0: search, filters, sort - `ListParams`). */
  testSets(offset = 0, limit = 100, params: ListParams = {}) {
    return this.http.get<M.Page<M.ScopeRead>>(this.u('/test-sets'), {
      params: QUERY({ ...params, offset, limit }),
    });
  }
  /** The sets' counts beside each filter value, within the others chosen - the list's own
   *  parameters, and the Created edges to count from. */
  testSetFacets(params: ListParams, edges: readonly string[]) {
    return this.http.get<M.FacetCounts>(this.u('/test-sets/facets'), {
      params: QUERY({ ...params, sort: undefined, created_edges: edges }),
    });
  }
  testSet(id: string) {
    return this.http.get<M.ScopeRead>(this.u(`/test-sets/${id}`));
  }
  /** The plans linking the set, by name - 500 at most, a set's plans all at once. */
  plansLinking(id: string, offset = 0, limit = 500) {
    return this.http.get<M.Page<M.PlanLinkingSet>>(this.u(`/test-sets/${id}/test-plans`), {
      params: PAGE(offset, limit),
    });
  }
  createTestSet(name: string) {
    return this.http.post<M.DataSetInfo>(this.u('/test-sets'), { name });
  }
  renameTestSet(id: string, name: string) {
    return this.http.patch<M.ScopeRead>(this.u(`/test-sets/${id}`), { name });
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
}
