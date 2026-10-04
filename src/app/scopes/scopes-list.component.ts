import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { CatalogStore } from '../api/catalog.store';
import { TestSetsApiService } from '../api/test-sets-api.service';
import { TestPlansApiService } from '../api/test-plans-api.service';
import { RunsApiService } from '../api/runs-api.service';
import { StatisticsApiService } from '../api/statistics-api.service';
import { holdersOf } from '../api/holders';
import { firstOfEach, latestRunOf, refreshStandings } from '../api/latest';
import { BatchSummary, Kind, ScopeMetadata, ScopeRead } from '../api/models';
import { ActionRunner } from '../shared/action-runner';
import { Paged } from '../shared/paged';
import { Selection } from '../shared/selection';
import { counted, displayName, errText } from '../shared/format';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { CATALOG, CatalogColumn, CatalogTag, idColumn } from '../shared/catalog';
import { SmartFilterComponent } from '../shared/work/smart-filter.component';
import { FilterFacet, createdFacet, createdParams } from '../shared/work/filters';
import { ApiList } from '../shared/work/api-list';
import { latestRunFacet, verdictFacet, verdictTiles } from '../shared/work/verdicts';
import { LatestStatusComponent } from '../shared/work/latest-status.component';
import { BulkAction, BulkBarComponent } from '../shared/work/bulk-bar.component';
import { BannerComponent } from '../shared/work/banner.component';
import { NamedItem, NamedListComponent } from '../shared/work/named-list.component';
import { NameDialogComponent } from '../shared/dialog/name-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { PickDialogComponent, PickRow } from '../shared/dialog/pick-dialog.component';
import { BATCH_SAMPLE } from '../overview/overview';

type Dlg = null | 'new' | 'delete' | 'link';

interface Named extends NamedItem {
  id: string;
}

/** What a set's or a plan's list says - the one component lists both. */
/** The sorts offered, and the API's names for them. */
const SORT: Record<string, string> = {
  'Latest run': 'latest_run',
  Created: 'created',
  Name: 'name',
};

const COPY = {
  'test-sets': {
    title: 'Test sets',
    one: 'test set',
    lede: 'Copies of tests, kept as they were added, so every run asks the same thing.',
    placeholder: 'Names - or type verdict, run, plan, test…',
    help: 'You add its tests next, on its page.',
    holds: 'Tests',
    statsKind: 'test_set',
  },
  'test-plans': {
    title: 'Test plans',
    one: 'test plan',
    lede: 'Test sets run together, as one check of a release.',
    placeholder: 'Names - or type verdict, run, set…',
    help: 'You link its test sets next, on its page.',
    holds: 'Sets',
    statsKind: 'test_plan',
  },
} as const;

/**
 * Test sets and Test plans, on the Guide's layout - one component for both: the title with New
 * beside it, a tile per latest verdict, the smart filter, then each set or plan with what it holds
 * (a set: in how many plans), its latest verdict, its latest run counted by status, how many runs
 * and when it was made - as the list has them, read again while one is under way. Ticked, a bar at
 * the foot adds sets to a test plan, runs each live, or deletes them - saying first which can't
 * go, from each one's own flags.
 *
 * The API searches, filters and sorts it (API 2.0): the words, the tiles and every facet, the
 * sort - `ApiList`.
 */
@Component({
  selector: 'assay-scopes-list',
  standalone: true,
  imports: [
    GuideHeadComponent,
    CATALOG,
    SmartFilterComponent,
    LatestStatusComponent,
    BulkBarComponent,
    BannerComponent,
    NamedListComponent,
    PagerComponent,
    RelTimeComponent,
    NameDialogComponent,
    ConfirmDialogComponent,
    PickDialogComponent,
  ],
  templateUrl: './scopes-list.component.html',
  styleUrls: [
    '../shared/guide/guide.css',
    '../shared/guide/head-aside.css',
    '../shared/work/work.css',
  ],
})
export class ScopesListComponent {
  kind = input.required<Kind>();
  store = inject(CatalogStore);
  private setsApi = inject(TestSetsApiService);
  private plansApi = inject(TestPlansApiService);
  private runsApi = inject(RunsApiService);
  private statsApi = inject(StatisticsApiService);
  private router = inject(Router);

  isSet = computed(() => this.kind() === 'test-sets');
  copy = computed(() => COPY[this.kind()]);

  /** The sets or plans as the API searches (names), filters and sorts them. */
  list = new ApiList<ScopeRead>({
    noun: () => this.copy().one,
    sort: 'Latest run',
    limit: 10,
    params: (c, q, sort) => ({
      q,
      latest_verdict: c['verdict'],
      latest_run: c['run'],
      ...(this.isSet()
        ? { in_test_plan: c['plan'], holds_test: c['test'] }
        : { holds_test_set: c['set'] }),
      ...createdParams(c['created']),
      sort: SORT[sort] ?? 'latest_run',
    }),
    fetch: (p, o, l) =>
      this.isSet() ? this.setsApi.testSets(o, l, p) : this.plansApi.testPlans(o, l, p),
  });
  page = this.list.page;
  rows = this.page.items;
  sortOptions = Object.keys(SORT);
  selection = new Selection(() => this.rows());
  /** Each shown set's or plan's latest run, counted, as its cell shows it. */
  latestRuns = computed(() => new Map(this.page.items().map((s) => [s.id, latestRunOf(s)])));

  /** The last 100 batches: the tiles' and the Verdict facet's counts. */
  batches = new Paged<BatchSummary>(
    (o, l) => this.statsApi.batchesPage({}, o, l),
    BATCH_SAMPLE,
    errText,
  );
  private verdictOf = computed(() => {
    const kind = this.copy().statsKind;
    return new Map(
      firstOfEach(
        this.batches.items().filter((b) => b.scope.kind === kind),
        (b) => b.scope.id,
      ).map(({ item }) => [item.scope.id, item.status as string]),
    );
  });
  tiles = computed(() => verdictTiles(this.verdictOf(), this.page.total()));
  tilesNote = computed(() =>
    this.batches.total() > BATCH_SAMPLE ? `Counted from the last ${BATCH_SAMPLE} batches.` : null,
  );

  tile = computed(() => {
    const v = this.list.choice()['verdict'] ?? [];
    return v.length === 1 ? v[0] : null;
  });
  pickTile(key: string | null) {
    this.list.choice.update((c) => ({ ...c, verdict: key ? [key] : [] }));
  }
  facets = computed<FilterFacet[]>(() => {
    const total = this.page.total();
    const shared = [verdictFacet(this.verdictOf(), total), latestRunFacet(null, total)];
    if (this.isSet()) {
      return [
        ...shared,
        {
          key: 'plan',
          label: 'In a test plan',
          sub: 'sets in each',
          many: true,
          values: this.store.plans().map((p) => ({
            key: p.id,
            label: p.name,
            count: p.linked_set_count ?? null,
          })),
        },
        {
          key: 'test',
          label: 'Holds a test',
          sub: 'sets holding each',
          many: true,
          values: this.store.tests().map((t) => ({
            key: t.id,
            label: displayName(t.name, t.id),
            count: t.test_set_count,
          })),
        },
        createdFacet(this.store.sets().map((s) => s.created_at)),
      ];
    }
    return [
      ...shared,
      {
        key: 'set',
        label: 'Holds a test set',
        sub: 'plans linking each',
        many: true,
        values: this.store.sets().map((s) => ({
          key: s.id,
          label: s.name,
          count: s.test_plan_count ?? null,
        })),
      },
      createdFacet(this.store.plans().map((p) => p.created_at)),
    ];
  });
  items = computed(() =>
    (this.isSet() ? this.store.sets() : this.store.plans()).map((s) => ({
      label: s.name,
      link: ['/', this.kind(), s.id],
    })),
  );
  emptyText = computed(() => this.list.empty(`No ${this.copy().title.toLowerCase()} yet.`));

  columns = computed<CatalogColumn[]>(() => [
    { label: this.isSet() ? 'Test set' : 'Test plan', width: 3 },
    { label: this.copy().holds, width: 0.9 },
    { label: 'Latest verdict', width: 1.4 },
    { label: 'Latest run', width: 2.6 },
    { label: 'Runs', width: 0.7 },
    { label: 'Created', width: 1 },
    idColumn(),
  ]);
  /** A set's tag: the plans that run it. */
  tagsOf(s: ScopeRead): CatalogTag[] {
    const n = s.test_plan_count ?? 0;
    return this.isSet() && n ? [{ text: `In ${counted(n, 'test plan')}` }] : [];
  }
  holds(s: ScopeMetadata) {
    return (this.isSet() ? s.entry_count : s.linked_set_count) ?? 0;
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
  bulkActions = computed<BulkAction[]>(() => [
    ...(this.isSet() ? [{ key: 'link', label: 'Add to a test plan…' }] : []),
    { key: 'run', label: 'Run each live' },
    { key: 'delete', label: 'Delete…', red: true },
  ]);
  private ticked = computed(() => this.page.items().filter((s) => this.selection.has(s.id)));
  /** Which plans link which of the ticked sets - read when the dialog opens (null while read). */
  private linkedBy = signal<Map<string, Set<string>> | null>(null);
  /** The plans to add the ticked sets to - one that links them all already can't be picked. */
  planRows = computed<PickRow[]>(() => {
    const linkedBy = this.linkedBy();
    const sets = this.selection.ids();
    return this.store.plans().map((p) => {
      const linked = sets.filter((s) => linkedBy?.get(p.id)?.has(s)).length;
      const all = linked === sets.length && sets.length > 0;
      return {
        id: p.id,
        name: p.name,
        sub: counted(p.linked_set_count ?? 0, 'test set'),
        meta: all ? 'Links them already' : linked ? `Links ${linked} already` : '',
        disabled: all,
      };
    });
  });
  linkLabel = (n: number) => (n ? `Add to ${counted(n, 'test plan')}` : 'Add to test plans');

  private deleting = signal<ScopeRead[]>([]);
  /** Which of them can go - one that has run can't (a statistics batch's runs count; a set's
   *  tests run by a plan too) - from each one's flags. */
  deletable = computed(() => {
    const go: Named[] = [];
    const kept: Named[] = [];
    for (const s of this.deleting()) {
      const runs = s.execution_count;
      const item = {
        id: s.id,
        name: s.name,
        note: !s.has_runs ? 'never run' : runs ? `has ${counted(runs, 'run')}` : 'has runs',
      };
      (s.has_runs ? kept : go).push(item);
    }
    return { go, kept };
  });
  deleteTitle = computed(() => {
    const d = this.deletable();
    const n = this.deleting().length;
    const noun = (k: number) => counted(k, this.copy().one);
    if (d.go.length === n) return `Delete ${n === 1 ? `this ${this.copy().one}` : noun(n)}?`;
    if (!d.go.length)
      return n === 1
        ? `This ${this.copy().one} can't be deleted`
        : `None of the ${noun(n)} can be deleted`;
    return `Delete ${d.go.length} of the ${noun(n)}?`;
  });
  deleteLabel = computed(() => {
    const n = this.deletable().go.length;
    return n ? `Delete ${counted(n, this.copy().one)}` : 'Delete';
  });
  deleteBody = computed(
    () =>
      `A ${this.copy().one} that has run can't be deleted: its runs need it. Deleting can't be undone${this.isSet() ? ' - the tests it copied stay' : ' - the test sets it links stay'}.`,
  );

  constructor() {
    refreshStandings(
      () => this.page.items(),
      () => {
        if (!this.page.loading()) this.page.reload();
      },
    );
    this.store.loadSets();
    this.store.loadPlans();
    this.store.loadTests();
    this.batches.reload();
    effect(() => {
      this.kind();
      untracked(() => {
        this.selection.clear();
        this.list.choice.set({});
      });
    });
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
    if (key === 'link') this.askLink();
    else if (key === 'run') this.runEach();
    else if (key === 'delete') this.askDelete();
  }

  create(name: string) {
    const made: Observable<{ id: string }> = this.isSet()
      ? this.setsApi.createTestSet(name)
      : this.plansApi.createTestPlan(name);
    this.act.run(made, { then: (x) => this.router.navigate(['/', this.kind(), x.id]) });
  }
  /** Opens the dialog to add the ticked sets to plans, and reads which plans link each already. */
  askLink() {
    this.linkedBy.set(null);
    this.open('link');
    holdersOf(this.selection.ids(), (id) =>
      this.setsApi.plansLinking(id).pipe(map((p) => p.items.map((x) => x.test_plan.id))),
    ).subscribe((m) => this.linkedBy.set(m));
  }
  /** Links the ticked sets to each plan picked - leaving out the ones it links already. */
  linkToPlans(planIds: string[]) {
    const linkedBy = this.linkedBy();
    const sets = this.selection.ids();
    const calls = planIds
      .map((p) => ({ p, ids: sets.filter((s) => !linkedBy?.get(p)?.has(s)) }))
      .filter((c) => c.ids.length)
      .map((c) => this.plansApi.linkSetsToPlan(c.p, c.ids));
    this.act.run(calls.length ? forkJoin(calls) : of([]), {
      ok: () =>
        `Added ${counted(sets.length, 'test set')} to ${counted(planIds.length, 'test plan')}.`,
      then: () => this.selection.clear(),
    });
  }
  runEach() {
    const kind = this.kind();
    const scopes = this.ticked();
    this.act.run(
      forkJoin(
        scopes.map((s) =>
          this.runsApi.runLive(kind, s.id).pipe(
            map(() => null),
            catchError(() => of(s.name)),
          ),
        ),
      ),
      {
        ok: (failed) => {
          const missed = failed.filter((f): f is string => !!f);
          const started = scopes.length - missed.length;
          const what = counted(started, this.copy().one);
          return missed.length
            ? `Started a live run of ${what}. Couldn't start: ${missed.join(', ')}.`
            : `Started a live run of ${what}.`;
        },
        then: () => {
          this.selection.clear();
          this.page.reload();
        },
      },
    );
  }
  /** Opens the delete dialog for the ticked - which can go is in their flags. */
  askDelete() {
    this.deleting.set(this.ticked());
    this.open('delete');
  }
  remove() {
    const go = this.deletable().go;
    if (!go.length) return;
    const del = (id: string) =>
      this.isSet() ? this.setsApi.deleteTestSet(id) : this.plansApi.deleteTestPlan(id);
    this.act.run(forkJoin(go.map((s) => del(s.id))), {
      ok: () => `Deleted ${counted(go.length, this.copy().one)}.`,
      then: () => this.selection.clear(),
    });
  }
}
