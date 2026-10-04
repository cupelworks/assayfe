import {
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { CatalogStore } from '../api/catalog.store';
import { RunsApiService } from '../api/runs-api.service';
import { TestTypesStore } from '../api/test-types.store';
import {
  AnyRunMetadata,
  RunDetails,
  RunOrigin,
  StandaloneRunDetails,
  TestStatus,
} from '../api/models';
import { counted, displayName, errText, statusLabel } from '../shared/format';
import { filterMissText } from '../shared/filter-miss';
import { Paged } from '../shared/paged';
import { TextFilter } from '../shared/text-filter';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { CATALOG, CatalogColumn, idColumn } from '../shared/catalog';
import { SmartFilterComponent } from '../shared/work/smart-filter.component';
import { FilterChoice, FilterFacet, createdFacet } from '../shared/work/filters';
import { ChecksMet, ChecksMetComponent, checksMet } from '../shared/work/checks-met.component';
import {
  FROM_LABEL,
  ORIGINS,
  RUN_STATUSES,
  RUN_TILE_GROUPS,
  fromFacet,
  runTiles,
  statusFacet,
} from './runs-list';

/** What a row reads of its run, one call each: its test's name, the test it's a copy of (a set's
 *  or plan's run) or is, and its checks. */
interface RunRead {
  name: string;
  testId: string | null;
  checks: ChecksMet;
}

/**
 * Runs, on the Guide's layout as the work's lists are: every run
 * started one at a time - a test on its own, or a set's or plan's, a test at a time - newest
 * first; a statistics batch's runs are on its page. A tile per status, grouped as the Overview
 * groups them, each with the API's total; the smart filter; a ruled row per run - how it went (to
 * its page), its test, where it was started from, its checks, when - read one call each, as the
 * list carries ids only; the pager.
 *
 * The API filters by one status and one origin (`?status=`, `?origin=`): the tiles and the
 * Status and From facets set them, in the address - the Overview's tally rows open a status. The
 * Test set, Test plan, Checks and Created facets are chosen but not applied, the sort reverses
 * the page shown, and the words search the page shown - see
 * docs/to_be_implemented_after_be_version_2/dev_notes.md.
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
  /** ?status= and ?origin=, bound by withComponentInputBinding() - none: every run. */
  status = input<TestStatus | undefined>();
  origin = input<RunOrigin | undefined>();
  private api = inject(RunsApiService);
  private store = inject(CatalogStore);
  private types = inject(TestTypesStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  statusLabel = statusLabel;

  page = new Paged<AnyRunMetadata>(
    (o, l) => this.api.latestRunsPage(o, l, this.status(), this.origin(), 'none'),
    25,
    errText,
  );
  /** Each row's run as read - null: it couldn't be. */
  reads = signal<Record<string, RunRead | null>>({});
  /** The page's words: each run's test, its set or plan, its checks, its error. */
  filter = new TextFilter<AnyRunMetadata>((r) => {
    const x = this.reads()[r.id];
    return [x?.name, this.scope(r)?.name, ...(x?.checks.names ?? []), x?.checks.error]
      .filter(Boolean)
      .join(' ');
  });
  sort = signal('Newest');
  sortOptions = ['Newest', 'Oldest'];
  rows = computed(() => {
    const rows = this.filter.apply(this.page.items());
    return this.sort() === 'Oldest' ? [...rows].reverse() : rows;
  });

  /** The API's totals: runs with each status (given the chosen origin), from each origin (given
   *  the chosen status), and every run outside a batch. */
  statusCounts = signal<Record<string, number> | null>(null);
  fromCounts = signal<Record<string, number> | null>(null);
  everything = signal<number | null>(null);

  tiles = computed(() => runTiles(this.statusCounts()));
  tileGroups = RUN_TILE_GROUPS;
  /** The choice, its status and origin as the address says - the other facets kept as chosen. */
  choice = linkedSignal<{ status?: TestStatus; origin?: RunOrigin }, FilterChoice>({
    source: () => ({ status: this.status(), origin: this.origin() }),
    computation: (s, prev) => ({
      ...(prev?.value ?? {}),
      status: s.status ? [s.status] : [],
      from: s.origin ? [s.origin] : [],
    }),
  });
  facets = computed<FilterFacet[]>(() => [
    statusFacet(this.statusCounts()),
    fromFacet(this.fromCounts()),
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

  shownText = computed(() => {
    if (this.filter.terms().length)
      return `${this.rows().length} of ${this.page.items().length} on this page`;
    const n = this.page.total(),
      all = this.everything();
    return (this.status() || this.origin()) && all != null
      ? `${n} of ${all} shown`
      : counted(n, 'run');
  });
  emptyText = computed(() => {
    if (this.page.loading()) return null;
    if (this.filter.terms().length)
      return filterMissText('run', this.filter.text(), this.page.total() > this.page.limit());
    if (this.page.total()) return null;
    return this.status() || this.origin()
      ? 'No run matches these filters. Take one out, or clear them all.'
      : 'No runs yet. Run a test, a test set or a test plan, and its runs show here.';
  });

  columns: CatalogColumn[] = [
    { label: 'How it went', width: 1.2 },
    { label: 'Test', width: 3.1 },
    { label: 'From', width: 3.1 },
    { label: 'Its checks', width: 3.6 },
    { label: 'When', width: 1 },
    idColumn(),
  ];
  /** A row as the table shows it. */
  view = computed(() => {
    const reads = this.reads();
    return this.rows().map((r) => ({
      r,
      read: reads[r.id],
      /** Not read yet: undefined; couldn't be: null. */
      failed: reads[r.id] === null,
      link: this.runLink(r),
      scope: this.scope(r),
      label: `Open the run: ${statusLabel(r.status)}${reads[r.id] ? `, ${reads[r.id]!.name}` : ''}`,
    }));
  });

  constructor() {
    this.store.loadSets();
    this.store.loadPlans();
    this.types.load();
    this.count().subscribe((n) => this.everything.set(n));
    effect(() => {
      const status = this.status(),
        origin = this.origin();
      // untracked: page.reset() -> reload() reads page's own offset()/limit() signals.
      untracked(() => {
        this.page.reset();
        forkJoin(Object.fromEntries(RUN_STATUSES.map((s) => [s, this.count(s, origin)]))).subscribe(
          (c) => this.statusCounts.set(c),
        );
        forkJoin(Object.fromEntries(ORIGINS.map((o) => [o, this.count(status, o)]))).subscribe(
          (c) => this.fromCounts.set(c),
        );
      });
    });
    effect(() => {
      const items = this.page.items();
      untracked(() => this.read(items));
    });
  }

  /** A tile: its status alone, or every one again. */
  pickTile(key: string | null) {
    this.choose({ ...this.choice(), status: key ? [key] : [] });
  }
  /** The smart filter's choice: its status and origin go to the address, which the API reads. */
  choose(c: FilterChoice) {
    this.choice.set(c);
    const status = c['status']?.[0] ?? null,
      origin = c['from']?.[0] ?? null;
    if (status !== (this.status() ?? null) || origin !== (this.origin() ?? null))
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { status, origin },
        queryParamsHandling: 'merge',
      });
  }

  /** How many runs outside a batch have this status and origin - the API's total. */
  private count(status?: TestStatus, origin?: RunOrigin) {
    return this.api.latestRunsPage(0, 1, status, origin, 'none').pipe(
      map((p) => p.total),
      catchError(() => of(0)),
    );
  }
  /** Each row's run, one call each - the list carries ids only. */
  private read(items: AnyRunMetadata[]) {
    if (!items.length) {
      this.reads.set({});
      return;
    }
    forkJoin(
      items.map((r) =>
        this.details(r).pipe(
          map((d): [string, RunRead | null] => [
            r.id,
            d
              ? {
                  name: displayName(d.name, d.test_case_id?.id ?? r.id),
                  testId: d.test_case_id?.id ?? null,
                  checks: checksMet(d),
                }
              : null,
          ]),
          catchError(() => of<[string, RunRead | null]>([r.id, null])),
        ),
      ),
    ).subscribe((pairs) => this.reads.set(Object.fromEntries(pairs)));
  }
  private details(r: AnyRunMetadata): Observable<RunDetails | StandaloneRunDetails | null> {
    if (r.origin === 'Standalone' && r.test_case_id)
      return this.api.standaloneRun(r.test_case_id.id, r.id);
    if (r.origin === 'TestSet' && r.test_set_id && r.test_set_execution_id)
      return this.api.runDetails('test-sets', r.test_set_id.id, r.test_set_execution_id.id, r.id);
    if (r.origin === 'TestPlan' && r.test_plan_id && r.test_plan_execution_id)
      return this.api.runDetails(
        'test-plans',
        r.test_plan_id.id,
        r.test_plan_execution_id.id,
        r.id,
      );
    return of(null);
  }
  /** The set or plan a run was started from: its kind, name and page. */
  private scope(r: AnyRunMetadata) {
    const set = r.origin === 'TestSet' ? r.test_set_id : null,
      plan = r.origin === 'TestPlan' ? r.test_plan_id : null,
      ref = set ?? plan;
    if (!ref) return null;
    const found = (set ? this.store.sets() : this.store.plans()).find((x) => x.id === ref.id);
    return {
      kind: FROM_LABEL[r.origin],
      name: found ? displayName(found.name, found.id) : '…',
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
