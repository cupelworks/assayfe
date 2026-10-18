// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { forkJoin, map } from 'rxjs';
import * as M from './models';
import { ApiBase, PAGE, QUERY } from './api-base';
import { ListParams } from '../shared/work/api-list';

@Injectable({ providedIn: 'root' })
export class TestsApiService extends ApiBase {
  /** The tests the parameters let through (API 2.0: search, filters, sort - `ListParams`). */
  tests(offset = 0, limit = 100, params: ListParams = {}) {
    return this.http.get<M.TestCasePage>(this.u('/tests'), {
      params: QUERY({ ...params, offset, limit }),
    });
  }
  /** The tests' counts beside each filter value, within the others chosen - the list's own
   *  parameters, and the Created edges to count from. */
  testFacets(params: ListParams, edges: readonly string[]) {
    return this.http.get<M.FacetCounts>(this.u('/tests/facets'), {
      params: QUERY({ ...params, sort: undefined, created_edges: edges }),
    });
  }
  /** tests() normalised to the common Page shape (the API names the array `test_cases`). */
  testsPage(params: ListParams, offset = 0, limit = 100) {
    return this.tests(offset, limit, params).pipe(
      map(
        (p) =>
          ({
            total: p.total,
            offset: p.offset,
            limit: p.limit,
            items: p.test_cases,
          }) as M.Page<M.TestCaseRead>,
      ),
    );
  }
  test(id: string) {
    return this.http.get<M.TestCaseRead>(this.u(`/tests/${id}`));
  }
  /** The sets holding a copy of the test, by name - 500 at most, a test's sets all at once. */
  setsHolding(id: string, offset = 0, limit = 500) {
    return this.http.get<M.SetsHoldingTest>(this.u(`/tests/${id}/test-sets`), {
      params: PAGE(offset, limit),
    });
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
  /** Tests from a dataset's rows - every row, or `row_ids` (used in row-number order) - each named
   *  after its prompt or numbered, with its row's recorded answer or none (API 2.0), and every one
   *  with the same checks. */
  createTestsFromDataset(
    datasetId: string,
    test_type_assignments?: M.TestTypeAssignment[],
    how: M.FromDatasetOptions = {},
  ) {
    return this.http.post<{ id: string; test_cases: M.Ref[] }>(this.u('/tests/from-dataset'), {
      id: datasetId,
      ...(test_type_assignments?.length ? { test_type_assignments } : {}),
      ...how,
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
}
