// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RunsApiService } from '../api/runs-api.service';
import { CatalogStore } from '../api/catalog.store';
import { ExecutionDetails, ExecutionMetadata, ExecutionRun, Kind } from '../api/models';
import {
  RUNS_ENDED,
  counted,
  displayName,
  errText,
  isInFlight,
  rel,
  shortDate,
  statusLabel,
} from '../shared/format';
import { Paged } from '../shared/paged';
import { pollWhile } from '../shared/poll';
import { ActionRunner } from '../shared/action-runner';
import { PagerComponent } from '../shared/pager.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { numbered } from '../shared/guide/guide-sections';
import { CATALOG, CatalogColumn, idColumn } from '../shared/catalog';
import { StatusTallyComponent, TallyPart, tallyParts } from '../shared/status-tally.component';
import { BannerComponent } from '../shared/work/banner.component';
import { SortComponent } from '../shared/work/sort.component';
import { ChecksMetComponent, checksListed } from '../shared/work/checks-met.component';
import { whatRan } from '../scopes/executions-table.component';
import { answerFrom, runOf } from './run-words';

/**
 * A run of a set or plan - every test once - on the Guide's layout, its top with the breadcrumbs:
 * "Test sets / <the set>" over the run's title - when it
 * ran - with Replay beside it, what ran; then how it went and its checks as the Overview's tallies,
 * whose rows lead nowhere (the tests are listed below): its tests by status - how they ended, what
 * is still under way - and its checks met, not met, or not ran with their test. 01 Tests: a ruled
 * row per test, worst first - how it went, the test (to its run), its checks - 25 a page.
 *
 * Read as the API has it (API 2.0): the run on its own - when it started, what it replayed, its
 * tests counted by status and their checks counted - and its tests a page at a time, each with
 * its name, its checks and where its answer came from, in the order chosen (worst first, or by
 * the test's name). Polls every 2 seconds while a test is under way.
 */
@Component({
  selector: 'assay-execution',
  standalone: true,
  imports: [
    RouterLink,
    GuideHeadComponent,
    GuideSectionComponent,
    CATALOG,
    StatusTallyComponent,
    ChecksMetComponent,
    SortComponent,
    PagerComponent,
    BannerComponent,
  ],
  templateUrl: './execution.component.html',
  styleUrls: [
    '../shared/guide/guide.css',
    '../shared/guide/head-aside.css',
    '../shared/work/work.css',
    './execution.component.css',
  ],
})
export class ExecutionComponent {
  kind = input.required<Kind>();
  id = input.required<string>();
  execId = input.required<string>();
  private api = inject(RunsApiService);
  private store = inject(CatalogStore);
  private router = inject(Router);
  statusLabel = statusLabel;
  counted = counted;
  act = new ActionRunner();
  sections = numbered('set-run-', ['Tests']);
  columns: CatalogColumn[] = [
    { label: 'How it went', width: 1.3 },
    { label: 'Test', width: 3.3 },
    { label: 'Its checks', width: 4.4 },
    idColumn('Run ID'),
  ];

  /** It, read on its own: when it started, what it replayed, its tests and their checks counted. */
  exec = signal<ExecutionDetails | null>(null);
  /** The run it replayed, read for when that was. */
  private replayedRun = signal<ExecutionMetadata | null>(null);
  private reading = false;
  err = signal<string | null>(null);
  sort = signal('How it went');
  sortOptions = ['How it went', 'Test'];
  /** Its tests, a page at a time, in the order chosen - the API's. */
  page = new Paged<ExecutionRun>(
    (o, l) =>
      this.api.executionRunsPage(
        this.kind(),
        this.id(),
        this.execId(),
        o,
        l,
        this.sort() === 'Test' ? 'name' : 'worst_first',
      ),
    25,
    errText,
  );

  loadMsg = computed(() => {
    const e = this.err() ?? this.page.error();
    return e ? { ok: false, text: e } : null;
  });
  private list = computed(() => (this.kind() === 'test-sets' ? 'Test sets' : 'Test plans'));
  /** The pages above it: the list, and the set or plan by its name (the run's own `name`). */
  crumbs = computed(() => {
    const name = this.exec()?.name;
    return [
      { label: this.list(), link: '/' + this.kind() },
      ...(name
        ? [{ label: displayName(name, this.id()), link: ['/', this.kind(), this.id()] }]
        : []),
    ];
  });
  title = computed(() => {
    const at = this.exec()?.created_at;
    return at ? runOf(at) : '';
  });
  /** The run it replayed: its id, and when it was once read. */
  private replayed = computed(() => {
    const ref = this.exec()?.replayed_execution_id;
    if (!ref) return null;
    const r = this.replayedRun();
    return { id: ref.id, created_at: r?.id === ref.id ? r.created_at : null };
  });
  lede = computed(() => {
    const set = this.kind() === 'test-sets';
    const every = set
      ? 'Every test of the set, run once each'
      : "Every test of the plan's sets, run once each";
    const r = this.replayed();
    if (r)
      return `${every} - a replay of ${r.created_at ? `the run of ${shortDate(r.created_at)}` : 'an earlier run'}, with the same copies.`;
    return `${every} - ${set ? 'the tests in the set at the time' : 'the sets as they were'}.`;
  });
  /** Under how it went: what ran, and when - "Replayed an earlier run, with the same copies · 7
   *  d ago". */
  facts = computed(() => {
    const e = this.exec();
    return e ? `${whatRan(e, this.kind())} · ${rel(e.created_at)}` : null;
  });
  replayedLink = computed(() => {
    const r = this.replayed();
    return r ? ['/', this.kind(), this.id(), 'executions', r.id] : null;
  });

  /** How many tests ran in it. */
  tests = computed(() => this.exec()?.run_count ?? this.page.total());
  /** Its tests by status: how they ended, then what is still under way. */
  testParts = computed(() => tallyParts(this.exec()?.runs ?? {}, RUNS_ENDED));
  /** Its checks: met and not met in the tests that finished, and the checks of a test that
   *  couldn't run - not ran with it. */
  checkParts = computed<TallyPart[]>(() => {
    const c = this.exec()?.checks;
    return [
      {
        label: 'How it ended',
        rows: [
          { key: 'met', count: c?.met ?? 0 },
          { key: 'unmet', count: c?.not_met.length ?? 0 },
          { key: 'NotRan', count: (c?.not_ran ?? []).reduce((n, x) => n + x.checks, 0) },
        ],
      },
    ];
  });

  /** A row per test, as the table shows it: its status, its name (to its run), where its answer
   *  came from, its checks. */
  rows = computed(() =>
    this.page.items().map((r) => ({
      r,
      name: displayName(r.test_name, r.id),
      source: r.output_source ? answerFrom(r) : null,
      checks: checksListed(r),
      link: ['/', this.kind(), this.id(), 'executions', this.execId(), 'runs', r.id],
    })),
  );
  emptyText = computed(() =>
    this.page.loading() || this.page.total() ? null : 'Nothing ran in it: its set had no tests.',
  );
  /** True while a test of it is under way - drives the poll below. */
  hasInFlight = computed(() => {
    const runs = this.exec()?.runs ?? {};
    return Object.entries(runs).some(([status, n]) => isInFlight(status) && !!n);
  });

  constructor() {
    effect(() => {
      const kind = this.kind(),
        id = this.id(),
        execId = this.execId();
      untracked(() => {
        this.exec.set(null);
        this.read(kind, id, execId);
      });
    });
    // Its tests, from the first page, for this run and in the order chosen.
    effect(() => {
      this.kind();
      this.id();
      this.execId();
      this.sort();
      untracked(() => this.page.reset());
    });
    // The run it replayed, read once for when that was.
    effect(() => {
      const ref = this.exec()?.replayed_execution_id;
      if (!ref || untracked(() => this.replayedRun()?.id === ref.id)) return;
      untracked(() =>
        this.api
          .execution(this.kind(), this.id(), ref.id)
          .subscribe({ next: (e) => this.replayedRun.set(e), error: () => {} }),
      );
    });
    // Polls while a test is under way, stops once nothing's left to wait for - see shared/poll.ts.
    pollWhile(
      () => this.hasInFlight(),
      () => {
        if (!this.reading) this.read(this.kind(), this.id(), this.execId());
        if (!this.page.loading()) this.page.reload();
      },
    );
  }
  /** It, on its own: its start, what it replayed, its tests and checks counted. */
  private read(kind: Kind, id: string, execId: string) {
    this.reading = true;
    this.api.execution(kind, id, execId).subscribe({
      next: (e) => {
        this.reading = false;
        this.err.set(null);
        this.exec.set(e);
      },
      error: (e) => {
        this.reading = false;
        this.err.set(errText(e));
      },
    });
  }
  /** Runs the same copies again, and opens that run. */
  replay() {
    this.act.run(this.api.replay(this.kind(), this.id(), this.execId()), {
      then: (r) => {
        this.store.load();
        this.router.navigate(['/', this.kind(), this.id(), 'executions', r.id]);
      },
    });
  }
}
