import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { TestSetsApiService } from '../api/test-sets-api.service';
import { TestPlansApiService } from '../api/test-plans-api.service';
import { StatisticsApiService } from '../api/statistics-api.service';
import { LatestByRow } from '../api/latest';
import { typeCounts, typeTimes } from '../api/checks';
import { TestCaseBody, TestSetEntry } from '../api/models';
import { Paged } from '../shared/paged';
import { Selection } from '../shared/selection';
import { counted, displayName, errText } from '../shared/format';
import { PagerComponent } from '../shared/pager.component';
import { ArrowOutComponent } from '../shared/arrow-out.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { CATALOG, CatalogColumn, CatalogTag } from '../shared/catalog';
import { QuietAction, QuietActionsComponent } from '../shared/work/quiet-actions.component';
import { BulkAction, BulkBarComponent } from '../shared/work/bulk-bar.component';
import { BannerComponent } from '../shared/work/banner.component';
import { LatestStatusComponent } from '../shared/work/latest-status.component';
import { NamedListComponent } from '../shared/work/named-list.component';
import { inWords } from '../shared/work/sentences';
import { NameDialogComponent } from '../shared/dialog/name-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { PickDialogComponent, PickRow } from '../shared/dialog/pick-dialog.component';
import { TestFormDialogComponent } from '../shared/dialog/test-form-dialog.component';
import { FilterFacet } from '../shared/work/filters';
import { VerdictsTableComponent } from '../statistics/verdicts-table.component';
import { LatestVerdictComponent } from '../statistics/latest-verdict.component';
import { ExecutionsTableComponent } from './executions-table.component';
import { LatestRunComponent } from './latest-run.component';
import { ScopePage, scopeSections } from './scope-page';

type Dlg = 'rename' | 'delete' | 'add' | 'unlink' | 'deleteEntries' | 'editEntry' | 'link';

/**
 * A test set's page, on the Guide's layout. Its top: the way back, its name, Run live, Run with
 * statistics ↗ and the quiet rest (Add tests · Rename · Delete - Delete pale once one of its tests
 * has run); a lede; its latest verdict and latest run. Then 01 its tests - each a copy, made when
 * it was added, "Frozen" once it has run - 02 its batches, 03 its runs, 04 the plans that run it.
 * Ticked tests can be unlinked (their runs stay) or, if never run, deleted.
 */
@Component({
  selector: 'assay-test-set-detail',
  standalone: true,
  imports: [
    RouterLink,
    ArrowOutComponent,
    GuideHeadComponent,
    GuideSectionComponent,
    CATALOG,
    QuietActionsComponent,
    BulkBarComponent,
    BannerComponent,
    LatestStatusComponent,
    NamedListComponent,
    PagerComponent,
    NameDialogComponent,
    ConfirmDialogComponent,
    PickDialogComponent,
    TestFormDialogComponent,
    VerdictsTableComponent,
    LatestVerdictComponent,
    ExecutionsTableComponent,
    LatestRunComponent,
  ],
  templateUrl: './test-set-detail.component.html',
  styleUrls: [
    '../shared/guide/guide.css',
    '../shared/guide/head-aside.css',
    '../shared/work/work.css',
  ],
})
export class TestSetDetailComponent extends ScopePage<Dlg> {
  readonly kind = 'test-sets' as const;
  readonly one = 'test set';
  private setsApi = inject(TestSetsApiService);
  private plansApi = inject(TestPlansApiService);
  private statsApi = inject(StatisticsApiService);
  sections = scopeSections('Tests', 'In test plans');

  page = new Paged<TestSetEntry>(
    (o, l) => this.setsApi.testSetEntries(this.id(), o, l),
    25,
    errText,
  );
  selection = new Selection(() => this.page.items());
  editing = signal<TestSetEntry | null>(null);
  /** Entry ids with a run against them - frozen for good: they can't be edited or deleted. The
   *  API has no flag for it, so it's read from every run of every execution of the set (its own
   *  and one of each statistics batch's: every time of a batch runs the same entries). */
  frozen = signal<Set<string>>(new Set());
  /** A test of it has run: it can't be deleted (a statistics batch's runs count). */
  hasRuns = computed(() => this.frozen().size > 0);

  // ---- the top ----
  plans = computed(() => {
    const all = this.membership.plansOf();
    return all ? (all.get(this.id()) ?? []) : null;
  });
  lede = computed(() => {
    const n = this.meta()?.entry_count ?? this.page.total();
    if (!n) return 'No tests yet: add some, then run it.';
    const all = this.page.items();
    const known = all.length === n;
    const recorded = all.filter((e) => e.model_output != null).length;
    const tests =
      n === 1 ? 'One test' : `${inWords(n).replace(/^./, (c) => c.toUpperCase())} tests`;
    const answers = !known
      ? '.'
      : recorded === n
        ? `, ${n === 1 ? 'with' : 'each with'} a recorded answer: a run scores ${n === 1 ? 'it' : 'those answers'} instead of asking your application.`
        : !recorded
          ? ': a run asks your application for each answer.'
          : `, ${recorded} with a recorded answer.`;
    const plans = this.plans();
    const runs = !plans
      ? ''
      : !plans.length
        ? ' No test plan runs it.'
        : plans.length === 1
          ? ' One test plan runs it too.'
          : ` ${inWords(plans.length).replace(/^./, (c) => c.toUpperCase())} test plans run it too.`;
    return tests + answers + runs;
  });
  canRun = computed(() => (this.meta()?.entry_count ?? this.page.total()) > 0);
  quiet = computed<QuietAction[]>(() => [
    { key: 'add', label: 'Add tests' },
    { key: 'rename', label: 'Rename' },
    { key: 'delete', label: 'Delete', disabled: this.hasRuns() },
  ]);
  why = computed(
    () =>
      [
        this.meta() && !this.canRun() ? 'It needs a test before it can run.' : '',
        this.hasRuns() ? "It can't be deleted once one of its tests has run." : '',
      ]
        .filter(Boolean)
        .join(' ') || null,
  );

  // ---- 01 ----
  columns: CatalogColumn[] = [
    { label: 'Test', width: 2.6 },
    { label: 'Input', width: 3.6 },
    { label: 'Checks', width: 1.6 },
    { label: '', width: 0.7 },
  ];
  tagsOf(e: TestSetEntry): CatalogTag[] {
    return [
      ...(e.model_output != null ? [{ text: 'Recorded answer', look: 'boxed' as const }] : []),
      ...(this.frozen().has(e.id) ? [{ text: 'Frozen', look: 'boxed' as const }] : []),
    ];
  }
  checkTags(e: TestSetEntry): CatalogTag[] {
    return typeCounts(e.test_type_assignments).map((c) => ({
      text: typeTimes(c.name, c.count),
    }));
  }
  anyFrozen = computed(() => this.page.items().some((e) => this.frozen().has(e.id)));
  entriesEmpty = computed(() =>
    this.page.loading() || this.page.items().length
      ? null
      : 'No tests yet - Add tests copies them in. Run live needs at least one.',
  );
  displayName = displayName;
  counted = counted;

  // ---- ticked ----
  ticked = computed(() => this.page.items().filter((e) => this.selection.has(e.id)));
  tickedNames = computed(() =>
    this.ticked().map((e) => ({
      name: displayName(e.name, e.id),
      note: this.frozen().has(e.id) ? 'frozen · has runs' : 'never run',
    })),
  );
  unlinkBody = computed(() =>
    this.selection.ids().length === 1
      ? "Its copy leaves the set; its runs stay, and so does the test itself. The set's past runs still show it."
      : "Their copies leave the set; their runs stay, and so do the tests themselves. The set's past runs still show them.",
  );
  bulkActions = computed<BulkAction[]>(() => {
    const frozen = this.ticked().some((e) => this.frozen().has(e.id));
    return [
      { key: 'unlink', label: 'Unlink…' },
      {
        key: 'delete',
        label: 'Delete…',
        red: true,
        disabled: frozen,
        why: "Frozen copies can't be deleted: unlink them",
      },
    ];
  });

  // ---- 04 ----
  planColumns: CatalogColumn[] = [
    { label: 'Test plan', width: 3.4 },
    { label: 'Holds', width: 1.6 },
    { label: 'Its latest run', width: 3.5 },
  ];
  planRuns = new LatestByRow(
    () => 'test-plans',
    () => (this.plans() ?? []).map((p) => p.id),
    { runs: true },
  );
  plansEmpty = computed(() =>
    this.plans() === null ? 'Reading the test plans…' : 'No test plan runs it.',
  );

  // ---- pick dialogs ----
  /** Tests to add: one in the set already can't be added again (the API's rule). */
  testRows = computed<PickRow[]>(() => {
    const inSet = new Set(this.page.items().map((e) => e.test_case_id.id));
    return this.store.tests().map((t) => ({
      id: t.id,
      name: displayName(t.name, t.id),
      sub: t.input,
      meta: inSet.has(t.id)
        ? 'In this set'
        : typeCounts(t.test_type_assignments)
            .map((c) => c.name)
            .join(' · ') || 'No checks',
      disabled: inSet.has(t.id),
      dim: !t.test_type_assignments?.length,
      facets: { check: [...new Set((t.test_type_assignments ?? []).map((a) => a.name))] },
    }));
  });
  checkFacet = computed<FilterFacet[]>(() => {
    const counts = new Map<string, number>();
    for (const r of this.testRows())
      for (const c of r.facets?.['check'] ?? []) counts.set(c, (counts.get(c) ?? 0) + 1);
    return [
      {
        key: 'check',
        label: 'Check',
        values: [...counts.entries()].map(([k, n]) => ({ key: k, label: k, count: n })),
      },
    ];
  });
  addLabel = (n: number) => (n ? `Add ${counted(n, 'test')}` : 'Add tests');
  planRows = computed<PickRow[]>(() => {
    const linked = new Set((this.plans() ?? []).map((p) => p.id));
    return this.store.plans().map((p) => ({
      id: p.id,
      name: p.name,
      sub: counted(p.linked_set_count ?? 0, 'test set'),
      meta: linked.has(p.id) ? 'Runs it already' : '',
      disabled: linked.has(p.id),
    }));
  });
  linkLabel = (n: number) => (n ? `Add to ${counted(n, 'test plan')}` : 'Add to test plans');

  constructor() {
    super();
    this.store.loadTests();
    this.store.loadPlans();
    this.membership.loadPlans();
  }

  reload() {
    this.selection.clear();
    this.page.reload();
    this.loadFrozen();
    this.membership.loadPlans();
  }
  protected fetchMeta() {
    return this.setsApi.testSet(this.id());
  }
  protected renamed(name: string) {
    return this.setsApi.renameTestSet(this.id(), name);
  }
  protected deleted() {
    return this.setsApi.deleteTestSet(this.id());
  }

  private loadFrozen() {
    const id = this.id();
    // The ordinary runs, and one run of each statistics batch: every time of a batch runs the
    // same entries, so its first execution names them all.
    const batchExecs = this.statsApi.batchesPage({ test_set_id: id }, 0, 100).pipe(
      switchMap((p) =>
        p.items.length
          ? forkJoin(
              p.items.map((b) =>
                this.runsApi.executionsPage('test-sets', id, 0, 1, b.id).pipe(
                  map((x) => x.items),
                  catchError(() => of([])),
                ),
              ),
            )
          : of([]),
      ),
      map((lists) => lists.flat()),
      catchError(() => of([])),
    );
    forkJoin([this.runsApi.executions('test-sets', id, 'none'), batchExecs])
      .pipe(
        map(([own, batches]) => [...own, ...batches]),
        switchMap((execs) =>
          execs.length
            ? forkJoin(execs.map((e) => this.runsApi.executionRuns('test-sets', id, e.id)))
            : of([]),
        ),
      )
      .subscribe((runsPerExec) => {
        const ids = new Set<string>();
        for (const runs of runsPerExec)
          for (const r of runs) if (r.test_set_entry_id) ids.add(r.test_set_entry_id.id);
        this.frozen.set(ids);
      });
  }

  quietAct(key: string) {
    if (key === 'add' || key === 'rename' || key === 'delete') this.open(key);
  }
  bulk(key: string) {
    if (key === 'unlink') this.open('unlink');
    else if (key === 'delete') this.open('deleteEntries');
  }
  go(offset: number) {
    this.selection.clear();
    this.page.go(offset);
  }
  size(limit: number) {
    this.selection.clear();
    this.page.size(limit);
  }
  edit(e: TestSetEntry) {
    this.editing.set(e);
    this.open('editEntry');
  }

  add(ids: string[]) {
    this.act.run(this.setsApi.addTestsToSet(this.id(), ids), {
      ok: () => `Added ${counted(ids.length, 'test')}, each as a copy.`,
      then: () => this.loadMeta(),
    });
  }
  unlink() {
    const ids = this.selection.ids();
    this.act.run(this.setsApi.unlinkEntries(this.id(), ids), {
      ok: () => `Unlinked ${counted(ids.length, 'test')} - their runs stay.`,
      then: () => this.loadMeta(),
    });
  }
  deleteEntries() {
    const ids = this.selection.ids();
    this.act.run(this.setsApi.deleteEntries(this.id(), ids), {
      ok: () => `Deleted ${counted(ids.length, 'copy', 'copies')}.`,
      then: () => this.loadMeta(),
    });
  }
  saveEntry(b: TestCaseBody) {
    this.act.run(this.setsApi.updateTestSetEntry(this.id(), this.editing()!.id, b), {
      ok: () => 'Saved the copy.',
    });
  }
  link(planIds: string[]) {
    this.act.run(forkJoin(planIds.map((p) => this.plansApi.linkSetsToPlan(p, [this.id()]))), {
      ok: () => `Added it to ${counted(planIds.length, 'test plan')}.`,
    });
  }
}
