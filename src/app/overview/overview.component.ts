import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CatalogStore, ExecRow } from '../api/catalog.store';
import { RunsApiService } from '../api/runs-api.service';
import { StatisticalTestsStore, StatisticsApiService } from '../api/statistics-api.service';
import { AnyRunMetadata, BatchSummary, ComparisonSummary } from '../api/models';
import { Paged } from '../shared/paged';
import {
  StatusCount,
  countByStatus,
  counted,
  errText,
  isInFlight,
  untitled,
} from '../shared/format';
import { pollWhile, whenTabShown } from '../shared/poll';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { GuideGoComponent } from '../shared/guide/guide-go.component';
import { numbered } from '../shared/guide/guide-sections';
import { CATALOG, CatalogColumn, CatalogTag } from '../shared/catalog';
import { WorkersStatusComponent } from '../shared/workers-status.component';
import { StatusTallyComponent } from '../shared/status-tally.component';
import { StatusCountsComponent } from '../shared/status-counts.component';
import { MarkedComponent } from '../shared/marked.component';
import { ProgressBarComponent } from '../shared/progress-bar.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { ArrowOutComponent } from '../shared/arrow-out.component';
import {
  BATCH_POLL_MS,
  batchProgress,
  runAgainLink,
  scopePlace,
  timesRun,
  verdictLine,
} from '../statistics/stats-format';
import { BATCH_SAMPLE, LATEST, RUNS_ENDED, VERDICTS_ENDED, tallyParts } from './overview';
import { firstOfEach } from '../api/latest';

/** A row of 02: the latest run of a test, or execution of a set or plan. */
interface LatestRun {
  id: string;
  name: string;
  link: unknown[];
  tags: CatalogTag[];
  /** Set for a set's or plan's execution, whose runs are counted with one more call. */
  exec: ExecRow | null;
  /** A test's run: its one status. */
  counts: StatusCount[];
  runs: number;
  at: string;
}

/**
 * The home page, on the Guide's layout. Its top: the title and, beside it, whether runs can start
 * (`<assay-workers-status>`); then the two summaries everyone should see without scrolling - the
 * last 100 batches by verdict and the last 500 runs by status (`<assay-status-tally>`), a run's
 * row leading to Runs at that status, a verdict's leading nowhere yet. Then three sections of the
 * latest 5, one row per test, set or plan: 01 its latest verdict ("Run again ↗" on a Failed or
 * Inconclusive one), 02 its latest run, 03 its latest comparison - each ending with "All … →".
 *
 * Polls as the pages it summarises do: the runs every 2 seconds while one is pending or running
 * (as an execution's page), the batches every 3 while one is (as a test's statistics), and
 * everything again when its tab comes back into view ("Run again ↗" opens its own tab).
 */
@Component({
  selector: 'assay-overview',
  standalone: true,
  imports: [
    RouterLink,
    GuideHeadComponent,
    GuideSectionComponent,
    GuideGoComponent,
    CATALOG,
    WorkersStatusComponent,
    StatusTallyComponent,
    StatusCountsComponent,
    MarkedComponent,
    ProgressBarComponent,
    RelTimeComponent,
    ArrowOutComponent,
  ],
  templateUrl: './overview.component.html',
  styleUrls: ['../shared/guide/guide.css', '../shared/work/work.css', './overview.component.css'],
})
export class OverviewComponent {
  private statsApi = inject(StatisticsApiService);
  private runsApi = inject(RunsApiService);
  private statTests = inject(StatisticalTestsStore);
  store = inject(CatalogStore);
  runAgainLink = runAgainLink;
  sections = numbered('overview-', ['Verdicts', 'Runs', 'Comparisons']);
  verdictsSub = `The latest ${LATEST} verdicts`;
  runsSub = `The latest ${LATEST} runs`;
  comparisonsSub = `The latest ${LATEST} comparisons`;

  verdictColumns: CatalogColumn[] = [
    { label: 'Tested', width: 3 },
    { label: 'Verdict', width: 4 },
    { label: 'Times', width: 1 },
    { label: 'When', width: 1.2 },
  ];
  runColumns: CatalogColumn[] = [
    { label: 'Ran', width: 3 },
    { label: 'Its latest run', width: 4 },
    { label: 'Runs', width: 1 },
    { label: 'When', width: 1.2 },
  ];
  /** On the other tables' four columns, so each lines up with the ones above it - what it showed
   *  takes two. */
  comparisonColumns: CatalogColumn[] = [
    { label: 'Compared', width: 3 },
    { label: 'What it showed', width: 4 },
    { label: '', width: 1 },
    { label: 'When', width: 1.2 },
  ];

  /** The last 100 batches, newest first: counted for the summary; 01 shows the first of each. */
  batches = new Paged<BatchSummary>(
    (o, l) => this.statsApi.batchesPage({}, o, l),
    BATCH_SAMPLE,
    errText,
  );
  /** The newest comparisons, as many: 03 shows the first of each. */
  comparisons = new Paged<ComparisonSummary>(
    (o, l) => this.statsApi.comparisonsPage({}, o, l),
    BATCH_SAMPLE,
    errText,
  );
  /** Each shown execution's runs, counted by status. */
  private statusByExec = signal<Record<string, StatusCount[]>>({});

  // The summaries - each shown once its list is in (and read), never a count of nothing.
  batchesReady = computed(
    () => !this.batches.error() && (!this.batches.loading() || this.batches.items().length > 0),
  );
  runsReady = computed(() => !this.store.runsLoading() || this.store.recentRuns().length > 0);
  verdictTally = computed(() =>
    tallyParts(
      this.batches.items().map((b) => b.status),
      VERDICTS_ENDED,
    ),
  );
  runTally = computed(() =>
    tallyParts(
      this.store.recentRuns().map((r) => r.status),
      RUNS_ENDED,
      (status) => ({ link: ['/runs'], query: { status } }),
    ),
  );

  /** 01: the latest batch of each test, set or plan. */
  verdictRows = computed(() =>
    firstOfEach(this.batches.items(), (b) => b.scope.kind + b.scope.id)
      .slice(0, LATEST)
      .map(({ item: b, count }) => {
        const running = isInFlight(b.status);
        const progress = running ? batchProgress(b.progress) : null;
        return {
          b,
          ...verdictLine(b),
          progress,
          link: ['/statistics/batches', b.id],
          tags: [
            { text: scopePlace(b.scope.kind).one },
            { text: counted(count, 'batch', 'batches') },
          ] as CatalogTag[],
          times: running ? b.progress.times_requested : timesRun(b.progress),
          again: b.status === 'Failed' || b.status === 'Inconclusive',
        };
      }),
  );

  /** 02: the latest run of each test, and execution of each set or plan, newest first. */
  private latestRuns = computed((): LatestRun[] => {
    const testNames = new Map(this.store.tests().map((t) => [t.id, t.name]));
    const executions = this.store.executions().map((e) => ({
      key: e.kind + e.parentId,
      at: e.created_at,
      exec: e as ExecRow | null,
      run: null as AnyRunMetadata | null,
    }));
    const tests = this.store
      .recentRuns()
      .filter((r) => r.origin === 'Standalone' && r.test_case_id)
      .map((r) => ({ key: 'tests' + r.test_case_id!.id, at: r.created_at, exec: null, run: r }));
    const newest = [...executions, ...tests].sort((a, b) =>
      a.at < b.at ? 1 : a.at > b.at ? -1 : 0,
    );
    return firstOfEach(newest, (x) => x.key)
      .slice(0, LATEST)
      .map(({ item }) => {
        if (item.exec) {
          const e = item.exec;
          return {
            id: e.id,
            name: e.target,
            link: ['/', e.kind, e.parentId, 'executions', e.id],
            tags: e.replayed_execution_id
              ? [{ text: e.scope }, { text: 'Replay', look: 'boxed' }]
              : [{ text: e.scope }],
            exec: e,
            counts: [],
            runs: e.run_count,
            at: e.created_at,
          };
        }
        const r = item.run!;
        const testId = r.test_case_id!.id;
        return {
          id: r.id,
          name: testNames.get(testId) ?? untitled(testId),
          link: ['/tests', testId, 'runs', r.id],
          tags: [{ text: 'Test' }],
          exec: null,
          counts: countByStatus([r]).filter((s) => s.value > 0),
          runs: 1,
          at: r.created_at,
        };
      });
  });
  runRows = computed(() =>
    this.latestRuns().map((r) => ({
      ...r,
      counts: r.exec ? (this.statusByExec()[r.exec.id] ?? []) : r.counts,
    })),
  );
  /** The shown executions - the same ones (by id and size) don't count their runs again, unless the
   *  runs reload. */
  private shownExecs = computed(() => this.latestRuns().flatMap((r) => (r.exec ? [r.exec] : [])), {
    equal: (a, b) =>
      a.length === b.length &&
      a.every((e, i) => e.id === b[i].id && e.run_count === b[i].run_count),
  });

  /** 03: the latest comparison of each test, set or plan. */
  comparisonRows = computed(() =>
    firstOfEach(this.comparisons.items(), (c) => c.scope.kind + c.scope.id)
      .slice(0, LATEST)
      .map(({ item: c, count }) => ({
        c,
        link: ['/statistics/comparisons', c.id],
        tags: [
          { text: scopePlace(c.scope.kind).one },
          { text: counted(count, 'comparison') },
        ] as CatalogTag[],
        question: this.statTests.byId().get(c.statistical_test)?.name ?? '',
      })),
  );

  verdictsEmpty = computed(() =>
    this.emptyText(this.batches, 'No verdicts yet.', "Couldn't load the verdicts"),
  );
  comparisonsEmpty = computed(() =>
    this.emptyText(this.comparisons, 'No comparisons yet.', "Couldn't load the comparisons"),
  );
  runsEmpty = computed(() => {
    if (this.runRows().length) return null;
    return this.store.runsLoading() || this.store.executionsLoading() ? 'Loading…' : 'No runs yet.';
  });

  private runsInFlight = computed(() => this.store.recentRuns().some((r) => isInFlight(r.status)));
  private batchesInFlight = computed(() => this.batches.items().some((b) => isInFlight(b.status)));

  constructor() {
    this.statTests.load();
    // The names of what ran.
    this.store.loadTests();
    this.store.loadSets();
    this.store.loadPlans();
    this.loadRuns();
    this.batches.reload();
    this.comparisons.reload();
    pollWhile(
      () => this.runsInFlight(),
      () => {
        if (!this.store.runsLoading()) this.loadRuns();
      },
    );
    pollWhile(
      () => this.batchesInFlight(),
      () => {
        if (!this.batches.loading()) this.batches.reload();
      },
      BATCH_POLL_MS,
    );
    // "Run again ↗" opens its own tab: back here, what was started there is counted.
    whenTabShown(() => {
      if (!this.store.runsLoading()) this.loadRuns();
      if (!this.batches.loading()) this.batches.reload();
      if (!this.comparisons.loading()) this.comparisons.reload();
    });
    // Each shown execution's runs, counted - again whenever the runs reload (each poll); a newer
    // count drops the one before it.
    effect((onCleanup) => {
      const execs = this.shownExecs();
      this.store.recentRuns();
      if (!execs.length) return;
      const sub = forkJoin(
        execs.map((e) => this.runsApi.executionStatusCounts(e.kind, e.parentId, e)),
      ).subscribe((counts) =>
        this.statusByExec.set(Object.fromEntries(execs.map((e, i) => [e.id, counts[i]]))),
      );
      onCleanup(() => sub.unsubscribe());
    });
  }

  private loadRuns() {
    this.store.loadRunStatus();
    this.store.loadExecutions();
  }

  /** What a section's table says with no rows: loading, why it failed, or that there are none. */
  private emptyText(page: Paged<unknown>, none: string, failed: string): string | null {
    if (page.items().length) return null;
    const error = page.error();
    if (error) return `${failed}: ${error}`;
    return page.loading() ? 'Loading…' : none;
  }
}
