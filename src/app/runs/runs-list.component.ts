import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogStore } from '../api/catalog.store';
import { RunQuery, RunsApiService } from '../api/runs-api.service';
import { TestTypesStore } from '../api/test-types.store';
import { AnyRunMetadata, RunFacets, RunOrigin, TestStatus } from '../api/models';
import { displayName, statusLabel } from '../shared/format';
import { ApiList } from '../shared/work/api-list';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { CATALOG, CatalogColumn, idColumn } from '../shared/catalog';
import { SmartFilterComponent } from '../shared/work/smart-filter.component';
import { FilterChoice, FilterFacet, createdFacet, createdParams } from '../shared/work/filters';
import { ChecksMetComponent, checksListed } from '../shared/work/checks-met.component';
import { FROM_LABEL, RUN_TILE_GROUPS, fromFacet, runTiles, statusFacet } from './runs-list';

/** A value of the address's ?status= or ?origin=: once, several times, or not there. */
type Several<T> = T | T[] | undefined;
const several = <T>(v: Several<T>): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const same = (a: readonly string[], b: readonly string[]) => a.join(' ') === b.join(' ');

/**
 * Runs, on the Guide's layout as the work's lists are: every run
 * started one at a time - a test on its own, or a set's or plan's, a test at a time - newest
 * first; a statistics batch's runs are on its page. A tile per status, grouped as the Overview
 * groups them, each with how many runs have it; the smart filter; a ruled row per run - how it
 * went (to its page), its test, where it was started from, its checks, when; the pager.
 *
 * The API does the work (API 2.0): the list carries each run's name, its set's or plan's, its
 * checks counted and its error; every facet's choice, the words and the sort go to it as
 * parameters (`GET /runs`), and the tiles' and the facets' counts come from `GET /runs/facets`,
 * each within the other filters. The statuses and origins chosen are in the address, so the
 * Overview's tally rows open a status.
 */
@Component({
  selector: 'assay-runs-list',
  standalone: true,
  imports: [
    RouterLink,
    GuideHeadComponent,
    CATALOG,
    SmartFilterComponent,
    ChecksMetComponent,
    PagerComponent,
    RelTimeComponent,
  ],
  templateUrl: './runs-list.component.html',
  styleUrls: ['../shared/guide/guide.css', '../shared/work/work.css', './runs-list.component.css'],
})
export class RunsListComponent {
  /** ?status= and ?origin= - once per value - bound by withComponentInputBinding(); none: every
   *  run. */
  status = input<Several<TestStatus>>();
  origin = input<Several<RunOrigin>>();
  private statuses = computed(() => several(this.status()));
  private origins = computed(() => several(this.origin()));
  private api = inject(RunsApiService);
  private store = inject(CatalogStore);
  private types = inject(TestTypesStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  statusLabel = statusLabel;
  sortOptions = ['Newest', 'Oldest'];

  /** The runs as the API searches, filters, counts and sorts them - the choice, its statuses and
   *  origins as the address says, the other facets kept as chosen. */
  list = new ApiList<AnyRunMetadata, RunFacets, RunQuery>({
    noun: 'run',
    sort: 'Newest',
    choice: linkedSignal<{ status: TestStatus[]; origin: RunOrigin[] }, FilterChoice>({
      source: () => ({ status: this.statuses(), origin: this.origins() }),
      computation: (s, prev) => ({ ...(prev?.value ?? {}), status: s.status, from: s.origin }),
    }),
    params: (c, q, sort) => ({
      batch: 'none',
      status: c['status'],
      origin: c['from'],
      test_set_id: c['set'],
      test_plan_id: c['plan'],
      check_type: c['check'],
      ...createdParams(c['created']),
      q,
      sort: sort === 'Oldest' ? 'oldest' : 'newest',
    }),
    fetch: (p, o, l) => this.api.runsPage(p, o, l),
    counts: (p) => this.api.runFacets(p),
  });

  tiles = computed(() => runTiles(this.list.counts()?.status ?? null));
  tileGroups = RUN_TILE_GROUPS;
  /** The tile chosen: the one status, when only one is. */
  oneStatus = computed(() => (this.statuses().length === 1 ? this.statuses()[0] : null));
  facets = computed<FilterFacet[]>(() => [
    statusFacet(this.list.counts()?.status ?? null),
    fromFacet(this.list.counts()?.origin ?? null),
    {
      key: 'set',
      label: 'Test set',
      many: true,
      values: this.store.sets().map((s) => ({ key: s.id, label: displayName(s.name, s.id) })),
    },
    {
      key: 'plan',
      label: 'Test plan',
      many: true,
      values: this.store.plans().map((p) => ({ key: p.id, label: displayName(p.name, p.id) })),
    },
    {
      key: 'check',
      label: 'Checks',
      many: true,
      values: this.types.all().map((t) => ({ key: t.name, label: t.name })),
    },
    createdFacet(null),
  ]);
  emptyText = computed(() =>
    this.list.empty('No runs yet. Run a test, a test set or a test plan, and its runs show here.'),
  );

  columns: CatalogColumn[] = [
    { label: 'How it went', width: 1.2 },
    { label: 'Test', width: 3.1 },
    { label: 'From', width: 3.1 },
    { label: 'Its checks', width: 3.6 },
    { label: 'When', width: 1 },
    idColumn(),
  ];
  /** A row as the table shows it - all of it from the list. */
  view = computed(() =>
    this.list.page.items().map((r) => {
      const name = displayName(r.test_name, r.test_case_id?.id ?? r.id);
      return {
        r,
        name,
        testId: r.test_case_id?.id ?? null,
        checks: checksListed(r),
        link: this.runLink(r),
        scope: this.scope(r),
        label: `Open the run: ${statusLabel(r.status)}, ${name}`,
      };
    }),
  );

  constructor() {
    this.store.loadSets();
    this.store.loadPlans();
    this.types.load();
  }

  /** A tile: its status alone, or every one again. */
  pickTile(key: string | null) {
    this.choose({ ...this.list.choice(), status: key ? [key] : [] });
  }
  /** The smart filter's choice: its statuses and origins go to the address, and with the rest to
   *  the API. */
  choose(c: FilterChoice) {
    this.list.choice.set(c);
    const status = c['status'] ?? [],
      origin = c['from'] ?? [];
    if (!same(status, this.statuses()) || !same(origin, this.origins()))
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          status: status.length ? status : null,
          origin: origin.length ? origin : null,
        },
        queryParamsHandling: 'merge',
      });
  }

  /** The set or plan a run was started from: its kind, name and page. */
  private scope(r: AnyRunMetadata) {
    const set = r.origin === 'TestSet' ? r.test_set_id : null,
      plan = r.origin === 'TestPlan' ? r.test_plan_id : null,
      ref = set ?? plan;
    if (!ref) return null;
    return {
      kind: FROM_LABEL[r.origin],
      name: displayName(r.scope_name, ref.id),
      link: [set ? '/test-sets' : '/test-plans', ref.id],
    };
  }
  /** The run's own page: a test's run, or a test in a set's or plan's run. */
  runLink(r: AnyRunMetadata): unknown[] | null {
    if (r.origin === 'Standalone' && r.test_case_id)
      return ['/tests', r.test_case_id.id, 'runs', r.id];
    if (r.origin === 'TestSet' && r.test_set_id && r.test_set_execution_id)
      return [
        '/test-sets',
        r.test_set_id.id,
        'executions',
        r.test_set_execution_id.id,
        'runs',
        r.id,
      ];
    if (r.origin === 'TestPlan' && r.test_plan_id && r.test_plan_execution_id)
      return [
        '/test-plans',
        r.test_plan_id.id,
        'executions',
        r.test_plan_execution_id.id,
        'runs',
        r.id,
      ];
    return null;
  }
}
