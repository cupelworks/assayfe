import { Component, inject, input, signal, effect, untracked, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, forkJoin, map, catchError, of } from 'rxjs';
import { RunsApiService } from '../api/runs-api.service';
import { TestsApiService } from '../api/tests-api.service';
import { AnyRunMetadata, RunOrigin, TestStatus } from '../api/models';
import { rel, short, statusColor } from '../shared/format';
import { Paged } from '../shared/paged';
import { PagerComponent } from '../shared/pager.component';

const ORIGIN_LABEL: Record<string, string> = {
  Standalone: 'Standalone',
  TestSet: 'Test set',
  TestPlan: 'Test plan',
};
export const ORIGINS: RunOrigin[] = ['Standalone', 'TestSet', 'TestPlan'];

/** Every run in the system, optionally restricted to one status (?status=Green, set from the
 *  Overview page's "Run status" tiles) and/or one origin (?origin=TestSet, set from the chips
 *  on this page) - not filtered client-side, the API does the filtering
 *  (GET /runs?status=...&origin=...) so total() reflects the true count, not a capped sample. */
@Component({
  selector: 'assay-runs-list',
  standalone: true,
  imports: [RouterLink, PagerComponent],
  templateUrl: './runs-list.component.html',
  styleUrls: ['../shared/page.css', './runs-list.component.css'],
})
export class RunsListComponent {
  /** Bound from the ?status=/?origin= query params via withComponentInputBinding() - undefined shows every run/origin. */
  status = input<TestStatus | undefined>();
  origin = input<RunOrigin | undefined>();
  private runsApi = inject(RunsApiService);
  private testsApi = inject(TestsApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  rel = rel;
  short = short;
  statusColor = statusColor;
  origins = ORIGINS;
  /** Resolved "Target" name per run id, keyed by row - fetched one call per visible row (25/page)
   *  since there's no batch lookup: GET /tests/{id} for Standalone (its run details carry no
   *  name), GET /runs/{kind}/{id}/executions/{execId}/test-runs/{runId} for TestSet/TestPlan
   *  (their run details already carry the frozen entry's name directly). '…' while a row's
   *  lookup hasn't resolved yet. */
  names = signal<Record<string, string>>({});
  originLabel = (o: string) => ORIGIN_LABEL[o] ?? o;
  title = computed(() => {
    const bits = [this.status() ?? '', this.origin() ? this.originLabel(this.origin()!) : ''];
    const label = bits.filter(Boolean).join(' ');
    return label ? `${label} runs` : 'All runs';
  });
  page = new Paged<AnyRunMetadata>(
    (o, l) => this.runsApi.latestRunsPage(o, l, this.status(), this.origin()),
    25,
  );
  runs = this.page.items;
  constructor() {
    effect(() => {
      this.status();
      this.origin();
      // untracked: page.reset() -> reload() reads page's own offset()/limit() signals - see
      // scopes-list.component.ts's identical comment.
      untracked(() => this.page.reset());
    });
    effect(() => {
      const items = this.page.items();
      if (!items.length) {
        this.names.set({});
        return;
      }
      forkJoin(items.map((r) => this.resolveName(r))).subscribe((pairs) =>
        this.names.set(Object.fromEntries(pairs)),
      );
    });
  }
  private resolveName(r: AnyRunMetadata): Observable<[string, string]> {
    const fallback = `Untitled · ${short(r.id)}`;
    let name$: Observable<string | null | undefined>;
    if (r.origin === 'Standalone' && r.test_case_id) {
      name$ = this.testsApi.test(r.test_case_id.id).pipe(map((t) => t.name));
    } else if (r.origin === 'TestSet' && r.test_set_id && r.test_set_execution_id) {
      name$ = this.runsApi
        .runDetails('test-sets', r.test_set_id.id, r.test_set_execution_id.id, r.id)
        .pipe(map((d) => d.name));
    } else if (r.origin === 'TestPlan' && r.test_plan_id && r.test_plan_execution_id) {
      name$ = this.runsApi
        .runDetails('test-plans', r.test_plan_id.id, r.test_plan_execution_id.id, r.id)
        .pipe(map((d) => d.name));
    } else {
      name$ = of(null);
    }
    return name$.pipe(
      map((n) => [r.id, n?.trim() || fallback] as [string, string]),
      catchError(() => of([r.id, fallback] as [string, string])),
    );
  }
  /** Toggles the ?origin= query param in place - clicking the active chip clears it back to "every origin". */
  toggleOrigin(o: RunOrigin) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { origin: this.origin() === o ? null : o },
      queryParamsHandling: 'merge',
    });
  }
  /** The nested run-detail route for this row, or null if the payload doesn't carry enough to
   *  build one. Now that RunMetadata carries test_set_id/test_plan_id alongside the execution
   *  id, every origin resolves - kept as a guard rather than an assumption, since a row missing
   *  its expected id (rather than erroring) would otherwise throw building the routerLink array. */
  runLink(r: AnyRunMetadata): unknown[] | null {
    if (r.origin === 'Standalone' && r.test_case_id) {
      return ['/tests', r.test_case_id.id, 'runs', r.id];
    }
    if (r.origin === 'TestSet' && r.test_set_id && r.test_set_execution_id) {
      return [
        '/test-sets',
        r.test_set_id.id,
        'executions',
        r.test_set_execution_id.id,
        'runs',
        r.id,
      ];
    }
    if (r.origin === 'TestPlan' && r.test_plan_id && r.test_plan_execution_id) {
      return [
        '/test-plans',
        r.test_plan_id.id,
        'executions',
        r.test_plan_execution_id.id,
        'runs',
        r.id,
      ];
    }
    return null;
  }
}
