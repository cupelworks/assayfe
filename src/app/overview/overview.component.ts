import { Component, computed, inject } from '@angular/core';
import { CatalogStore, ExecRow } from '../api/catalog.store';
import { StatisticalTestsStore, StatisticsApiService } from '../api/statistics-api.service';
import { AnyRunMetadata, BatchSummary, ComparisonSummary } from '../api/models';
import { Paged } from '../shared/paged';
import {
  StatusCount,
  countByStatus,
  counted,
  displayName,
  errText,
  isInFlight,
  statusCountsOf,
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
import { RelTimeComponent } from '../shared/rel-time.component';
import { BatchVerdictComponent } from '../statistics/batch-verdict.component';
import { BATCH_POLL_MS, scopePlace, timesFigure } from '../statistics/stats-format';
import { BATCH_SAMPLE, LATEST, RUNS_ENDED, VERDICTS_ENDED, tallyParts } from './overview';
import { firstOfEach } from '../api/latest';

/** A row of 02: the latest run of a test, or execution of a set or plan. */
interface LatestRun {
  id: string;
  name: string;
  link: unknown[];
  tags: CatalogTag[];
  /** Set for a set's or plan's execution. */
  exec: ExecRow | null;
  /** Its runs by status: a test's run its one status, a set's or plan's run as it comes. */
  counts: StatusCount[];
  runs: number;
  at: string;
}

/**
 * The home page, on the Guide's layout. Its top: the title and, beside it, whether runs can start
 * (`<assay-workers-status>`); then the two summaries everyone should see without scrolling - the
 * last 100 batches by verdict and the last 500 runs by status (`<assay-status-tally>`), a
 * verdict's row leading to Batches at that verdict, a run's to Runs at that status. Then three
 * sections of the latest 5, one row per test, set or plan: 01 its latest verdict ("Run again ↗"
 * on a Failed or Inconclusive one), 02 its latest run, 03 its latest comparison - each ending with
 * "All … →": Batches, Runs, Comparisons.
 *
 * Polls as the pages it summarises do: the runs every 2 seconds while one is pending or running
 * (as an execution's page), the batches every 3 while one is (as a test's statistics), and
 * everything again when its tab comes back into view ("Run again ↗" opens its own tab).
 */
@Component({
  selector: 'assay-overview',
  standalone: true,
  imports: [
    GuideHeadComponent,
    GuideSectionComponent,
    GuideGoComponent,
    CATALOG,
    WorkersStatusComponent,
    StatusTallyComponent,
    StatusCountsComponent,
    MarkedComponent,
    RelTimeComponent,
    BatchVerdictComponent,
  ],
  templateUrl: './overview.component.html',
  styleUrls: [
    '../shared/guide/guide.css',
    '../shared/guide/head-aside.css',
    '../shared/work/work.css',
    './overview.component.css',
  ],
})
export class OverviewComponent {
  private statsApi = inject(StatisticsApiService);
  private statTests = inject(StatisticalTestsStore);
  store = inject(CatalogStore);
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
  // The summaries - each shown once its list is in (and read), never a count of nothing.
  batchesReady = computed(
    () => !this.batches.error() && (!this.batches.loading() || this.batches.items().length > 0),
  );
  runsReady = computed(() => !this.store.runsLoading() || this.store.recentRuns().length > 0);
  verdictTally = computed(() =>
    tallyParts(
      this.batches.items().map((b) => b.status),
      VERDICTS_ENDED,
      (status) => ({ link: ['/statistics/batches'], query: { status } }),
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
      .map(({ item: b, count }) => ({
        b,
        link: ['/statistics/batches', b.id],
        tags: [
          { text: scopePlace(b.scope.kind).one },
          { text: counted(count, 'batch', 'batches') },
        ] as CatalogTag[],
        times: timesFigure(b),
      })),
  );

  /** 02: the latest run of each test, and execution of each set or plan, newest first - each named
   *  and counted as the API lists it. */
  runRows = computed((): LatestRun[] => {
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
            counts: statusCountsOf(e.runs),
            runs: e.run_count,
            at: e.created_at,
          };
        }
        const r = item.run!;
        const testId = r.test_case_id!.id;
        return {
          id: r.id,
          name: displayName(r.test_name, testId),
          link: ['/tests', testId, 'runs', r.id],
          tags: [{ text: 'Test' }],
          exec: null,
          counts: countByStatus([r]).filter((s) => s.value > 0),
          runs: 1,
          at: r.created_at,
        };
      });
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
