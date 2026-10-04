import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CatalogStore } from '../api/catalog.store';
import { TestsApiService } from '../api/tests-api.service';
import { TestSetsApiService } from '../api/test-sets-api.service';
import { RunsApiService } from '../api/runs-api.service';
import { StatisticsApiService } from '../api/statistics-api.service';
import { holdersOf } from '../api/holders';
import { firstOfEach, latestRunOf, refreshStandings } from '../api/latest';
import { typeCounts, typeTimes } from '../api/checks';
import { BatchSummary, TestCase, TestCaseBody, TestCaseRead } from '../api/models';
import { ActionRunner } from '../shared/action-runner';
import { Paged } from '../shared/paged';
import { Selection } from '../shared/selection';
import { TextFilter } from '../shared/text-filter';
import { counted, displayName, errText } from '../shared/format';
import { filterMissText } from '../shared/filter-miss';
import { PagerComponent } from '../shared/pager.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { CATALOG, CatalogColumn, CatalogTag, idColumn } from '../shared/catalog';
import { SmartFilterComponent } from '../shared/work/smart-filter.component';
import { FilterChoice, FilterFacet, createdFacet } from '../shared/work/filters';
import { NOT_YET, latestRunFacet, verdictFacet, verdictTiles } from '../shared/work/verdicts';
import { LatestStatusComponent } from '../shared/work/latest-status.component';
import { BulkAction, BulkBarComponent } from '../shared/work/bulk-bar.component';
import { BannerComponent } from '../shared/work/banner.component';
import { NamedItem, NamedListComponent } from '../shared/work/named-list.component';
import { TestFormDialogComponent } from '../shared/dialog/test-form-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { PickDialogComponent, PickRow } from '../shared/dialog/pick-dialog.component';
import { BATCH_SAMPLE } from '../overview/overview';

type Dlg = null | 'new' | 'delete' | 'add';

/** A test that can't be deleted, and why: "in 2 test sets · has runs". */
interface Kept extends NamedItem {
  id: string;
}

/**
 * Tests, on the Guide's layout: the title with New test beside it, then a tile per latest verdict
 * (the quick filters), the smart filter, and the tests - each with its checks, its latest verdict
 * and its latest run, as the list has them (read again while one is under way). Ticked, a bar at
 * the foot adds them to a test set, runs each once, or deletes them - saying first which can't go
 * and why, from each test's own flags.
 *
 * What the API can't filter by yet is chosen but not applied: the tiles, the facets, the sort
 * (only the page's words narrow the list, as before) - see
 * docs/to_be_implemented_after_be_version_2/dev_notes.md.
 */
@Component({
  selector: 'assay-tests-list',
  standalone: true,
  imports: [
    RouterLink,
    GuideHeadComponent,
    CATALOG,
    SmartFilterComponent,
    LatestStatusComponent,
    BulkBarComponent,
    BannerComponent,
    NamedListComponent,
    PagerComponent,
    TestFormDialogComponent,
    ConfirmDialogComponent,
    PickDialogComponent,
  ],
  templateUrl: './tests-list.component.html',
  styleUrls: [
    '../shared/guide/guide.css',
    '../shared/guide/head-aside.css',
    '../shared/work/work.css',
  ],
})
export class TestsListComponent {
  store = inject(CatalogStore);
  private api = inject(TestsApiService);
  private setsApi = inject(TestSetsApiService);
  private runsApi = inject(RunsApiService);
  private statsApi = inject(StatisticsApiService);

  page = new Paged<TestCaseRead>((o, l) => this.api.testsPage(o, l), 10, errText);
  /** Names, inputs and checks - the page's words. */
  filter = new TextFilter<TestCaseRead>(
    (t) =>
      `${t.name ?? ''} ${t.input} ${(t.test_type_assignments ?? []).map((a) => `${a.name} ${a.label ?? ''}`).join(' ')}`,
  );
  rows = computed(() => {
    const rows = this.filter.apply(this.page.items());
    return this.sort() === 'Name'
      ? [...rows].sort((a, b) => displayName(a.name, a.id).localeCompare(displayName(b.name, b.id)))
      : rows;
  });
  selection = new Selection(() => this.rows());
  /** Each shown test's latest run, as its cell shows it. */
  latestRuns = computed(() => new Map(this.page.items().map((t) => [t.id, latestRunOf(t)])));

  /** The last 100 batches: the tiles' and the Verdict facet's counts. */
  batches = new Paged<BatchSummary>(
    (o, l) => this.statsApi.batchesPage({}, o, l),
    BATCH_SAMPLE,
    errText,
  );
  /** Each test's latest verdict, among those batches. */
  private verdictOf = computed(
    () =>
      new Map(
        firstOfEach(
          this.batches.items().filter((b) => b.scope.kind === 'test'),
          (b) => b.scope.id,
        ).map(({ item }) => [item.scope.id, item.status]),
      ),
  );
  /** Each test's latest run outside a batch, among the last 500 runs. */
  private runOf = computed(
    () =>
      new Map(
        firstOfEach(
          this.store.recentRuns().filter((r) => r.origin === 'Standalone' && r.test_case_id),
          (r) => r.test_case_id!.id,
        ).map(({ item }) => [item.test_case_id!.id, item.status as string]),
      ),
  );
  tiles = computed(() => verdictTiles(this.verdictOf(), this.page.total()));
  tilesNote = computed(() =>
    this.batches.total() > BATCH_SAMPLE ? `Counted from the last ${BATCH_SAMPLE} batches.` : null,
  );

  // The choice: kept for when the API filters by it (see the class's comment).
  choice = signal<FilterChoice>({});
  sort = signal('Latest activity');
  sortOptions = ['Latest activity', 'Name'];
  tile = computed(() => {
    const v = this.choice()['verdict'] ?? [];
    return v.length === 1 ? v[0] : null;
  });
  pickTile(key: string | null) {
    this.choice.update((c) => ({ ...c, verdict: key ? [key] : [] }));
  }

  facets = computed<FilterFacet[]>(() => {
    const tests = this.store.tests();
    const total = this.page.total();
    const types = new Map<string, number>();
    for (const t of tests) {
      for (const n of new Set((t.test_type_assignments ?? []).map((a) => a.name)))
        types.set(n, (types.get(n) ?? 0) + 1);
    }
    const recorded = tests.filter((t) => t.model_output != null).length;
    return [
      {
        key: 'check',
        label: 'Checks',
        sub: 'tests with each',
        many: true,
        values: [...types.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .map(([name, count]) => ({ key: name, label: name, count })),
      },
      verdictFacet(this.verdictOf(), total),
      latestRunFacet(this.store.runsLoading() ? null : this.runOf(), total),
      {
        key: 'answer',
        label: 'Answer',
        sub: 'what a run scores',
        values: [
          { key: 'recorded', label: 'A recorded answer', count: tests.length ? recorded : null },
          {
            key: 'live',
            label: 'Asks the application',
            count: tests.length ? tests.length - recorded : null,
          },
        ],
      },
      {
        key: 'set',
        label: 'In a test set',
        sub: 'tests in each',
        many: true,
        values: this.store.sets().map((s) => ({
          key: s.id,
          label: s.name,
          count: s.entry_count ?? null,
        })),
      },
      {
        key: 'dataset',
        label: 'From a dataset',
        many: true,
        values: this.store.datasets().map((d) => ({ key: d.id, label: d.name })),
      },
      createdFacet(tests.map((t) => t.created_at)),
    ];
  });
  items = computed(() =>
    this.store.tests().map((t) => ({ label: displayName(t.name, t.id), link: ['/tests', t.id] })),
  );
  shownText = computed(() =>
    this.filter.terms().length
      ? `${this.rows().length} of ${this.page.items().length} on this page`
      : counted(this.page.total(), 'test'),
  );
  emptyText = computed(() => {
    if (this.page.loading()) return null;
    if (this.filter.terms().length)
      return filterMissText('test', this.filter.text(), this.page.total() > this.page.limit());
    return this.page.total() ? null : 'No tests yet. Make one, or make tests from a dataset.';
  });

  columns: CatalogColumn[] = [
    { label: 'Test', width: 3 },
    { label: 'Input', width: 3 },
    { label: 'Checks', width: 2.4 },
    { label: 'Latest verdict', width: 1.5 },
    { label: 'Latest run', width: 1.5 },
    idColumn(),
  ];
  recordedTag: CatalogTag[] = [{ text: 'Recorded answer', look: 'boxed' }];
  displayName = displayName;
  /** A row's checks as tags: three, then "+N". */
  checkTags(t: TestCase) {
    const all = typeCounts(t.test_type_assignments);
    const tags = all.slice(0, 3).map((c) => ({ text: typeTimes(c.name, c.count) }) as CatalogTag);
    return all.length > 3 ? [...tags, { text: `+${all.length - 3}` }] : tags;
  }

  dlg = signal<Dlg>(null);
  act = new ActionRunner({
    inDialog: () => !!this.dlg(),
    done: () => {
      this.dlg.set(null);
      this.store.load();
      this.page.reload();
    },
  });
  bulkActions: BulkAction[] = [
    { key: 'add', label: 'Add to a test set…' },
    { key: 'run', label: 'Run each once' },
    { key: 'delete', label: 'Delete…', red: true },
  ];
  /** The ticked tests by name, in the page's order. */
  private ticked = computed(() => this.page.items().filter((t) => this.selection.has(t.id)));
  /** The sets to add the ticked tests to - one that holds them all already can't be picked. */
  setRows = computed<PickRow[]>(() => {
    const tests = this.selection.ids();
    const held = this.heldBySet();
    return this.store.sets().map((s) => {
      const n = tests.filter((t) => held.get(s.id)?.has(t)).length;
      const all = n === tests.length && n > 0;
      return {
        id: s.id,
        name: s.name,
        sub: counted(s.entry_count ?? 0, 'test'),
        meta: all ? 'Holds them already' : n ? `Holds ${n} already` : '',
        disabled: all,
      };
    });
  });
  /** Which of the ticked tests each set holds a copy of - read when the dialog opens. */
  private heldBySet = signal<Map<string, Set<string>>>(new Map());
  /** The tests the delete dialog was opened for. */
  private deleting = signal<TestCaseRead[]>([]);
  /** Which of them can go, which can't - and why, from each test's flags: its copies (one in a
   *  set, or unlinked from it since) and its runs - what the API refuses. */
  deletable = computed(() => {
    const go: Kept[] = [];
    const kept: Kept[] = [];
    this.deleting().forEach((t) => {
      const unlinked = t.copy_count - t.test_set_count;
      const why = [
        t.test_set_count ? `in ${counted(t.test_set_count, 'test set')}` : '',
        unlinked > 0 ? counted(unlinked, 'unlinked copy', 'unlinked copies') : '',
        t.has_runs ? 'has runs' : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const item = {
        id: t.id,
        name: displayName(t.name, t.id),
        note: why || 'no runs, no copies',
      };
      (why ? kept : go).push(item);
    });
    return { go, kept };
  });

  addLabel = (n: number) => (n ? `Add to ${counted(n, 'test set')}` : 'Add to test sets');
  deleteLabel = computed(() => {
    const n = this.deletable().go.length;
    return n ? `Delete ${counted(n, 'test')}` : 'Delete';
  });
  deleteTitle = computed(() => {
    const d = this.deletable();
    const n = this.deleting().length;
    if (d.go.length === n) return `Delete ${n === 1 ? 'this test' : counted(n, 'test')}?`;
    if (!d.go.length)
      return n === 1 ? "This test can't be deleted" : `None of the ${n} tests can be deleted`;
    return `Delete ${d.go.length} of the ${n} tests?`;
  });
  deleteBody =
    "A test that has run, or has a copy - in a test set, or unlinked from one - can't be deleted: its runs and its copies need it. Deleting can't be undone.";

  constructor() {
    refreshStandings(
      () => this.page.items(),
      () => {
        if (!this.page.loading()) this.page.reload();
      },
    );
    this.page.reload();
    this.batches.reload();
    this.store.loadTests();
    this.store.loadSets();
    this.store.loadDatasets();
    this.store.loadRunStatus();
  }

  go(offset: number) {
    this.selection.clear();
    this.page.go(offset);
  }
  size(limit: number) {
    this.selection.clear();
    this.page.size(limit);
  }
  open(d: Dlg) {
    this.act.err.set(null);
    this.dlg.set(d);
  }
  bulk(key: string) {
    if (key === 'add') this.askAdd();
    else if (key === 'run') this.runEach();
    else if (key === 'delete') this.askDelete();
  }

  create(b: TestCaseBody) {
    this.act.run(this.api.createTest(b), { ok: (t) => `Made the test “${t.name ?? t.id}”.` });
  }
  /** Opens the dialog to add the ticked tests to sets, and reads which sets hold each already. */
  askAdd() {
    this.heldBySet.set(new Map());
    this.open('add');
    holdersOf(this.selection.ids(), (id) =>
      this.api.setsHolding(id).pipe(map((p) => p.items.map((x) => x.test_set.id))),
    ).subscribe((m) => this.heldBySet.set(m));
  }
  /** Adds the ticked tests to each set picked - leaving out the ones it holds already (the API
   *  refuses a test a set holds). */
  addToSets(setIds: string[]) {
    const tests = this.selection.ids();
    const held = this.heldBySet();
    const calls = setIds
      .map((id) => ({ id, missing: tests.filter((t) => !held.get(id)?.has(t)) }))
      .filter((c) => c.missing.length)
      .map((c) => this.setsApi.addTestsToSet(c.id, c.missing));
    this.act.run(calls.length ? forkJoin(calls) : of([]), {
      ok: () =>
        `Added ${counted(tests.length, 'test')} to ${counted(setIds.length, 'test set')} - each as a copy.`,
      then: () => this.selection.clear(),
    });
  }
  /** One run each - a test that can't start (no checks) is said, the others still run. */
  runEach() {
    const tests = this.ticked();
    this.act.run(
      forkJoin(
        tests.map((t) =>
          this.runsApi.runStandalone(t.id).pipe(
            map(() => null),
            catchError(() => of(displayName(t.name, t.id))),
          ),
        ),
      ),
      {
        ok: (failed) => {
          const missed = failed.filter((f): f is string => !!f);
          const started = tests.length - missed.length;
          return missed.length
            ? `Started ${counted(started, 'run')}. Couldn't start: ${missed.join(', ')}.`
            : `Started ${counted(started, 'run')}, one each.`;
        },
        then: () => {
          this.selection.clear();
          this.page.reload();
        },
      },
    );
  }
  /** Opens the delete dialog for the ticked tests - which can go is in their flags. */
  askDelete() {
    this.deleting.set(this.ticked());
    this.open('delete');
  }
  remove() {
    const ids = this.deletable().go.map((t) => t.id);
    if (!ids.length) return;
    this.act.run(this.api.deleteTests(ids), {
      ok: () => `Deleted ${counted(ids.length, 'test')}.`,
      then: () => this.selection.clear(),
    });
  }
}
