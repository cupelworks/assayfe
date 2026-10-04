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
import { CatalogStore } from '../api/catalog.store';
import { RunQuery, RunSort, RunsApiService } from '../api/runs-api.service';
import { TestTypesStore } from '../api/test-types.store';
import { AnyRunMetadata, RunFacets, RunOrigin, TestStatus } from '../api/models';
import { counted, displayName, errText, statusLabel } from '../shared/format';
import { Paged } from '../shared/paged';
import { SearchWords } from '../shared/text-filter';
import { debounced } from '../shared/debounced';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { CATALOG, CatalogColumn, idColumn } from '../shared/catalog';
import { SmartFilterComponent } from '../shared/work/smart-filter.component';
import {
  FilterChoice,
  FilterFacet,
  chosenCount,
  createdFacet,
  createdParams,
} from '../shared/work/filters';
import { ChecksMetComponent, checksListed } from '../shared/work/checks-met.component';
import { FROM_LABEL, RUN_TILE_GROUPS, fromFacet, runTiles, statusFacet } from './runs-list';

/** A value of the address's ?status= or ?origin=: once, several times, or not there. */
type Several<T> = T | T[] | undefined;
const several = <T>(v: Several<T>): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const same = (a: readonly string[], b: readonly string[]) => a.join(' ') === b.join(' ');
const sumOf = (counts: Partial<Record<string, number>>) =>
  Object.values(counts).reduce<number>((a, b) => a + (b ?? 0), 0);

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

  /** The words, looked for in each run's test's, set's or plan's name - by the API. */
  words = new SearchWords();
  sort = signal('Newest');
  sortOptions = ['Newest', 'Oldest'];
  /** The choice, its statuses and origins as the address says - the other facets kept as
   *  chosen. */
  choice = linkedSignal<{ status: TestStatus[]; origin: RunOrigin[] }, FilterChoice>({
    source: () => ({ status: this.statuses(), origin: this.origins() }),
    computation: (s, prev) => ({ ...(prev?.value ?? {}), status: s.status, from: s.origin }),
  });
  /** The words as the API gets them: once they've stood still. */
  private terms = debounced(() => this.words.terms());
  /** What the API is asked for: every facet's choice and the words. */
  private query = computed<RunQuery>(() => {
    const c = this.choice();
    return {
      batch: 'none',
      status: this.statuses(),
      origin: this.origins(),
      test_set_id: c['set'],
      test_plan_id: c['plan'],
      check_type: c['check'],
      ...createdParams(c['created']),
      q: this.terms(),
    };
  });
  private apiSort = computed<RunSort>(() => (this.sort() === 'Oldest' ? 'oldest' : 'newest'));
  /** Something narrows the list: a facet's choice or words. */
  private narrowed = computed(() => chosenCount(this.choice()) > 0 || this.terms().length > 0);
  /** Something besides the statuses narrows it - the status counts then count within it. */
  private narrowedBeyondStatus = computed(
    () => chosenCount({ ...this.choice(), status: [] }) > 0 || this.terms().length > 0,
  );

  page = new Paged<AnyRunMetadata>(
    (o, l) => this.api.runsPage(this.query(), o, l, this.apiSort()),
    25,
    errText,
  );
  /** The runs counted by status and by origin, each within the other filters - the tiles' and
   *  the Status and From facets' counts. */
  counts = signal<RunFacets | null>(null);
  /** Every run outside a batch. */
  everything = signal<number | null>(null);

  tiles = computed(() => runTiles(this.counts()?.status ?? null));
  tileGroups = RUN_TILE_GROUPS;
  /** The tile chosen: the one status, when only one is. */
  oneStatus = computed(() => (this.statuses().length === 1 ? this.statuses()[0] : null));
  facets = computed<FilterFacet[]>(() => [
    statusFacet(this.counts()?.status ?? null),
    fromFacet(this.counts()?.origin ?? null),
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
    const n = this.page.total(),
      all = this.everything();
    return this.narrowed() && all != null ? `${n} of ${all} shown` : counted(n, 'run');
  });
  emptyText = computed(() => {
    if (this.page.loading() || this.page.total()) return null;
    return this.narrowed()
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
  /** A row as the table shows it - all of it from the list. */
  view = computed(() =>
    this.page.items().map((r) => {
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
    // The list, from its first page, whenever what's asked or the order changes.
    effect(() => {
      this.query();
      this.apiSort();
      // untracked: page.reset() -> reload() reads page's own offset()/limit() signals.
      untracked(() => this.page.reset());
    });
    // The counts, whenever what's asked changes; a newer answer drops the one before it. The
    // status counts leave the statuses chosen out, so with nothing else narrowing they add up to
    // every run - otherwise every run is asked for once.
    effect((onCleanup) => {
      const alone = !this.narrowedBeyondStatus();
      const sub = this.api.runFacets(this.query()).subscribe({
        next: (f) => {
          this.counts.set(f);
          if (alone) this.everything.set(sumOf(f.status));
          else if (untracked(() => this.everything()) == null) this.readEverything();
        },
        error: () => this.counts.set(null),
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  /** A tile: its status alone, or every one again. */
  pickTile(key: string | null) {
    this.choose({ ...this.choice(), status: key ? [key] : [] });
  }
  /** The smart filter's choice: its statuses and origins go to the address, and with the rest to
   *  the API. */
  choose(c: FilterChoice) {
    this.choice.set(c);
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

  /** Every run outside a batch - when the counts can't say it. */
  private readEverything() {
    this.api.runFacets({ batch: 'none' }).subscribe({
      next: (f) => this.everything.set(sumOf(f.status)),
      error: () => {},
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
