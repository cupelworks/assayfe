import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { forkJoin, map } from 'rxjs';
import * as M from './models';
import { ApiBase, PAGE } from './api-base';

@Injectable({ providedIn: 'root' })
export class TestsApiService extends ApiBase {
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
  createTestsFromDataset(datasetId: string, test_type_assignments?: M.TestTypeAssignment[]) {
    return this.http.post<{ id: string; test_cases: M.Ref[] }>(this.u('/tests/from-dataset'), {
      id: datasetId,
      ...(test_type_assignments?.length ? { test_type_assignments } : {}),
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
