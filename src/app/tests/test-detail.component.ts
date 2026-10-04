import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TestsApiService } from '../api/tests-api.service';
import { RunsApiService } from '../api/runs-api.service';
import { TestSetsApiService } from '../api/test-sets-api.service';
import { CatalogStore } from '../api/catalog.store';
import { SetsHoldingTest, StandaloneRun, TestCaseBody, TestCaseRead } from '../api/models';
import { ActionRunner } from '../shared/action-runner';
import { Paged } from '../shared/paged';
import { counted, displayName, errText, isInFlight, rel, statusLabel } from '../shared/format';
import { pollWhile, whenTabShown } from '../shared/poll';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { ArrowOutComponent } from '../shared/arrow-out.component';
import { ChecksViewComponent } from '../shared/checks-view.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { numbered } from '../shared/guide/guide-sections';
import { CATALOG, CatalogColumn, idColumn } from '../shared/catalog';
import { StateBlockComponent } from '../shared/work/state-block.component';
import { QuietAction, QuietActionsComponent } from '../shared/work/quiet-actions.component';
import { BannerComponent } from '../shared/work/banner.component';
import { inWords, runSays } from '../shared/work/sentences';
import { TestFormDialogComponent } from '../shared/dialog/test-form-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { PickDialogComponent, PickRow } from '../shared/dialog/pick-dialog.component';
import { VerdictsTableComponent } from '../statistics/verdicts-table.component';
import { LatestVerdictComponent } from '../statistics/latest-verdict.component';

type Dlg = null | 'edit' | 'delete' | 'clear-output' | 'add';

/**
 * A test's page, on the Guide's layout. Its top: the way back to Tests, its name, and beside it Run
 * once, Run with statistics ↗ and the quiet rest (Edit · Duplicate · Delete - Delete pale, with
 * why, once it can't go); a lede that says what it does; then how it stands - its latest verdict
 * and its latest run, each a big word. Then four sections: 01 the test (its words, its recorded
 * answer, its checks), 02 its batches, 03 its runs outside a batch, 04 the test sets that hold a
 * copy of it.
 *
 * Polls as before: its runs every 2 seconds while one is in flight, its batches every 3, and both
 * when its tab comes back into view (Run with statistics opens its own).
 */
@Component({
  selector: 'assay-test-detail',
  standalone: true,
  imports: [
    RouterLink,
    GuideHeadComponent,
    GuideSectionComponent,
    CATALOG,
    StateBlockComponent,
    QuietActionsComponent,
    BannerComponent,
    PagerComponent,
    RelTimeComponent,
    ArrowOutComponent,
    ChecksViewComponent,
    VerdictsTableComponent,
    LatestVerdictComponent,
    TestFormDialogComponent,
    ConfirmDialogComponent,
    PickDialogComponent,
  ],
  templateUrl: './test-detail.component.html',
  styleUrls: [
    '../shared/guide/guide.css',
    '../shared/guide/head-aside.css',
    '../shared/work/work.css',
    './test-detail.component.css',
  ],
})
export class TestDetailComponent {
  id = input.required<string>();
  private testsApi = inject(TestsApiService);
  private runsApi = inject(RunsApiService);
  private setsApi = inject(TestSetsApiService);
  private router = inject(Router);
  store = inject(CatalogStore);
  statusLabel = statusLabel;
  sections = numbered('test-', ['The test', 'Verdicts', 'Runs', 'In test sets']);

  /** The test, as the API reads it - how it stands, its runs, its copies. */
  test = signal<TestCaseRead | null>(null);
  name = computed(() => displayName(this.test()?.name, this.id()));
  /** Its runs started from here - a statistics batch's are on the batch's page. */
  runs = new Paged<StandaloneRun>(
    (o, l) => this.runsApi.standaloneRunsPage(this.id(), o, l, 'none'),
    5,
    errText,
  );
  statsScope = computed(() => ({ test_id: this.id() }));
  /** Bumped after a run is started here: the tables read again. */
  version = signal(0);
  /** The sets holding a copy of it, as the API has them; null while read. */
  private holding = signal<SetsHoldingTest | null>(null);
  /** Each set with its copy: its ID, and whether it still says what the test says. */
  sets = computed(
    () =>
      this.holding()?.items.map((h) => ({
        set: h.test_set,
        entry: h.entry.id,
        same: h.entry.matches_test,
      })) ?? null,
  );
  /** Its copies unlinked from their set since - kept, and keeping the test. */
  unlinked = computed(() => this.holding()?.unlinked_copies ?? 0);

  // ---- the top ----
  checks = computed(() => this.test()?.test_type_assignments?.length ?? 0);
  canRun = computed(() => this.checks() > 0);
  lede = computed(() => {
    const t = this.test();
    if (!t) return '';
    const answer =
      t.model_output != null
        ? 'Scores the answer recorded with it'
        : 'Asks your application live, as it has no recorded answer';
    const n = this.checks();
    const checks = !n
      ? "it has no checks yet, so it can't run"
      : n === 1
        ? 'one check decides each answer'
        : `${inWords(n)} checks decide each answer`;
    const sets = this.sets();
    const held = !sets
      ? ''
      : !sets.length
        ? ' No test set holds a copy of it.'
        : sets.length === 1
          ? ' One test set holds a copy of it.'
          : ` ${inWords(sets.length).replace(/^./, (c) => c.toUpperCase())} test sets hold a copy of it.`;
    return `${answer}, and ${checks}.${held}`;
  });
  /** Why it can't be deleted - the API's rule, from its flags: a copy of it (in a test set, or
   *  unlinked from one since), or runs (a batch's included). */
  private kept = computed(() => {
    const t = this.test();
    if (!t) return null;
    const copy = t.test_set_count
      ? "it's in a test set"
      : t.copy_count
        ? 'a copy unlinked from its set needs it'
        : '';
    if (copy && t.has_runs)
      return t.test_set_count ? `${copy} and has runs` : `${copy}, and it has runs`;
    return copy || (t.has_runs ? 'it has runs' : null);
  });
  quiet = computed<QuietAction[]>(() => [
    { key: 'edit', label: 'Edit' },
    { key: 'duplicate', label: 'Duplicate' },
    { key: 'delete', label: 'Delete', disabled: !!this.kept() },
  ]);
  why = computed(
    () =>
      [
        this.test() && !this.canRun() ? 'It needs a check before it can run.' : '',
        this.kept() ? `It can't be deleted: ${this.kept()}.` : '',
      ]
        .filter(Boolean)
        .join(' ') || null,
  );

  // ---- how it stands ----
  latestRun = computed(() => (this.runs.offset() === 0 ? this.runs.items()[0] : null));
  runFacts = computed(() => {
    const r = this.latestRun();
    if (!r) return null;
    const total = this.runs.total();
    return total > 1 ? `${rel(r.created_at)} · ${total} runs in all` : rel(r.created_at);
  });
  runSays = runSays;
  counted = counted;

  // ---- 03, 04 ----
  runColumns: CatalogColumn[] = [
    { label: 'Run', width: 1.6 },
    { label: 'How it went', width: 5.4 },
    { label: 'When', width: 2 },
    idColumn(),
  ];
  setColumns: CatalogColumn[] = [
    { label: 'Test set', width: 4 },
    { label: 'Holds', width: 2 },
    { label: 'Its copy', width: 3 },
    idColumn('Entry ID'),
  ];
  runsEmpty = computed(() =>
    this.runs.loading() || this.runs.items().length
      ? null
      : 'Never run on its own - Run once runs it.',
  );
  setsEmpty = computed(() =>
    this.sets() === null ? 'Reading the test sets…' : 'No test set holds a copy of it.',
  );

  // ---- dialogs ----
  dlg = signal<Dlg>(null);
  act = new ActionRunner({ inDialog: () => !!this.dlg(), done: () => this.dlg.set(null) });
  setRows = computed<PickRow[]>(() => {
    const holding = new Set((this.sets() ?? []).map((s) => s.set.id));
    return this.store.sets().map((s) => ({
      id: s.id,
      name: s.name,
      sub: counted(s.entry_count ?? 0, 'test'),
      meta: holding.has(s.id) ? 'Holds a copy' : '',
      disabled: holding.has(s.id),
    }));
  });
  addLabel = (n: number) => (n ? `Add to ${counted(n, 'test set')}` : 'Add to test sets');

  constructor() {
    this.store.loadSets();
    effect(() => {
      this.id();
      untracked(() => this.load());
    });
    // A run in flight: every 2 seconds; a batch: every 3 (as the statistics panel did).
    pollWhile(
      () => this.runs.items().some((r) => isInFlight(r.status)),
      () => {
        if (!this.runs.loading()) this.runs.reload();
      },
    );
    // Run with statistics opens in its own tab: back here, what started there shows.
    whenTabShown(() => {
      if (!this.runs.loading()) this.runs.reload();
    });
  }

  load() {
    this.loadTest();
    this.loadSets();
    this.runs.reset();
  }
  /** The sets holding a copy of it - again after it's added to some. */
  private loadSets() {
    this.testsApi.setsHolding(this.id()).subscribe({
      next: (h) => this.holding.set(h),
      error: () =>
        this.holding.set({ total: 0, offset: 0, limit: 0, items: [], unlinked_copies: 0 }),
    });
  }
  /** The test, how it stands - again once a run of it starts (it has runs then). */
  private loadTest() {
    this.testsApi.test(this.id()).subscribe({
      next: (t) => this.test.set(t),
      error: (e) => this.act.msg.set({ ok: false, text: errText(e) }),
    });
  }

  open(d: Dlg) {
    this.act.err.set(null);
    this.dlg.set(d);
  }
  quietAct(key: string) {
    if (key === 'edit') this.open('edit');
    else if (key === 'duplicate') this.duplicate();
    else if (key === 'delete') this.open('delete');
  }

  run() {
    this.act.run(this.runsApi.runStandalone(this.id()), {
      ok: () => 'Started a run: it shows under Runs, and here as its latest run.',
      then: () => {
        this.runs.reset();
        this.loadTest();
      },
    });
  }
  save(b: TestCaseBody) {
    this.act.run(this.testsApi.updateTest(this.id(), b), {
      ok: () => 'Saved. The copies in test sets are as they were.',
      then: () => {
        this.load();
        this.store.loadTests();
      },
    });
  }
  /** A new test with the same words and checks - "(copy)" after its name - then its page. */
  duplicate() {
    const t = this.test();
    if (!t) return;
    const { id: _id, ...body } = t;
    this.act.run(this.testsApi.createTest({ ...body, name: `${this.name()} (copy)` }), {
      then: (copy) => {
        this.store.loadTests();
        this.router.navigate(['/tests', copy.id]);
      },
    });
  }
  remove() {
    this.act.run(this.testsApi.deleteTests([this.id()]), {
      then: () => {
        this.store.loadTests();
        this.router.navigate(['/tests']);
      },
    });
  }
  /** Removes the recorded answer - only `model_output: null` is sent, so nothing else changes. */
  clearAnswer() {
    this.act.run(this.testsApi.updateTest(this.id(), { model_output: null }), {
      ok: () => 'The recorded answer is cleared: its runs now ask your application.',
      then: () => this.load(),
    });
  }
  addToSets(ids: string[]) {
    this.act.run(forkJoin(ids.map((id) => this.setsApi.addTestsToSet(id, [this.id()]))), {
      ok: () => `Added a copy of it to ${counted(ids.length, 'test set')}.`,
      then: () => {
        this.loadSets();
        this.loadTest();
        this.store.loadSets();
      },
    });
  }
}
