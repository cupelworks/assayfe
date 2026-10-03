import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { RunsApiService } from '../api/runs-api.service';
import { CatalogStore } from '../api/catalog.store';
import { ExecutionMetadata, Kind, RunDetails, RunMetadata } from '../api/models';
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
import { pollWhile } from '../shared/poll';
import { ActionRunner } from '../shared/action-runner';
import { PagerComponent } from '../shared/pager.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { numbered } from '../shared/guide/guide-sections';
import { CATALOG, CatalogColumn } from '../shared/catalog';
import { StatusTallyComponent, TallyPart, tallyParts } from '../shared/status-tally.component';
import { BannerComponent } from '../shared/work/banner.component';
import { SortComponent } from '../shared/work/sort.component';
import { ChecksMetComponent, checksMet } from '../shared/work/checks-met.component';
import { whatRan } from '../scopes/executions-table.component';
import { answerFrom, runOf, worstFirst } from './run-words';

/**
 * A run of a set or plan - every test once - on the Guide's layout, its top with the breadcrumbs:
 * "Test sets / <the set>" over the run's title - when it
 * ran - with Replay beside it, what ran; then how it went and its checks as the Overview's tallies,
 * whose rows lead nowhere (the tests are listed below): its tests by status - how they ended, what
 * is still under way - and its checks met, not met, or not ran with their test. 01 Tests: a ruled
 * row per test, worst first - how it went, the test (to its run), its checks - 25 a page.
 *
 * An execution carries no roll-up and the API has no call for one: every run is listed (one call),
 * each read once (a call each - again when its status changes) for its name and checks, and the run
 * itself found in its set's runs. Polls every 2 seconds while a test is under way.
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
  ];

  /** Every run of it, as listed; each one read once - null: it couldn't be. */
  runs = signal<RunMetadata[]>([]);
  private details = signal<Record<string, RunDetails | null>>({});
  loading = signal(true);
  err = signal<string | null>(null);
  /** It, and the run it replayed, among its set's runs. */
  private execs = signal<ExecutionMetadata[]>([]);
  exec = computed(() => this.execs().find((e) => e.id === this.execId()) ?? null);
  sort = signal('How it went');
  sortOptions = ['How it went', 'Test'];
  offset = signal(0);
  limit = signal(25);

  loadMsg = computed(() => {
    const e = this.err();
    return e ? { ok: false, text: e } : null;
  });
  private list = computed(() => (this.kind() === 'test-sets' ? 'Test sets' : 'Test plans'));
  crumbs = computed(() => {
    const scope = this.store.parent(this.kind(), this.id());
    return [
      { label: this.list(), link: '/' + this.kind() },
      ...(scope
        ? [{ label: displayName(scope.name, scope.id), link: ['/', this.kind(), this.id()] }]
        : []),
    ];
  });
  /** When it ran - its own start, else its first test's. */
  private startedAt = computed(
    () =>
      this.exec()?.created_at ??
      this.runs()
        .map((r) => r.created_at)
        .sort()[0] ??
      null,
  );
  title = computed(() => {
    const at = this.startedAt();
    return at ? runOf(at) : '';
  });
  /** The run it replayed, among its set's runs. */
  private replayed = computed(() => {
    const ref = this.exec()?.replayed_execution_id;
    return ref
      ? (this.execs().find((e) => e.id === ref.id) ?? { id: ref.id, created_at: null })
      : null;
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
    const e = this.exec(),
      at = this.startedAt();
    return e && at ? `${whatRan(e, this.kind())} · ${rel(at)}` : null;
  });
  replayedLink = computed(() => {
    const r = this.replayed();
    return r ? ['/', this.kind(), this.id(), 'executions', r.id] : null;
  });

  /** Its tests by status: how they ended, then what is still under way. */
  testParts = computed(() =>
    tallyParts(
      this.runs().map((r) => r.status),
      RUNS_ENDED,
    ),
  );
  /** Its checks: met and not met in the tests that finished, and the checks of a test that
   *  couldn't run - not ran with it. */
  checkParts = computed<TallyPart[]>(() => {
    let met = 0,
      unmet = 0,
      notRan = 0;
    for (const r of this.runs()) {
      const d = this.details()[r.id];
      if (!d || isInFlight(d.status)) continue;
      if (d.status === 'NotRan') {
        notRan += d.test_type_assignments?.length ?? 0;
        continue;
      }
      const c = checksMet(d);
      met += c.met;
      unmet += c.total - c.met;
    }
    return [
      {
        label: 'How it ended',
        rows: [
          { key: 'met', count: met },
          { key: 'unmet', count: unmet },
          { key: 'NotRan', count: notRan },
        ],
      },
    ];
  });

  /** A row per test, as the table shows it: its status, its name (to its run), where its answer
   *  came from, its checks. */
  rows = computed(() => {
    const all = this.runs().map((r) => {
      const d = this.details()[r.id];
      return {
        r,
        name: d ? displayName(d.name, r.id) : null,
        failed: d === null,
        source: d ? answerFrom(d) : null,
        checks: d ? checksMet(d) : null,
        link: ['/', this.kind(), this.id(), 'executions', this.execId(), 'runs', r.id],
      };
    });
    return this.sort() === 'Test'
      ? [...all].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
      : worstFirst(all.map((x) => ({ ...x, status: x.r.status })));
  });
  pageRows = computed(() => this.rows().slice(this.offset(), this.offset() + this.limit()));
  emptyText = computed(() =>
    this.loading() || this.runs().length ? null : 'Nothing ran in it: its set had no tests.',
  );
  /** True while a test of it is under way - drives the poll below. */
  hasInFlight = computed(() => this.runs().some((r) => isInFlight(r.status)));

  constructor() {
    effect(() => {
      const kind = this.kind(),
        id = this.id(),
        execId = this.execId();
      untracked(() => {
        // This scope's own name (store.parent) - only sets or plans is needed, by kind.
        kind === 'test-sets' ? this.store.loadSets() : this.store.loadPlans();
        this.runs.set([]);
        this.details.set({});
        this.offset.set(0);
        this.loading.set(true);
        this.api.executions(kind, id).subscribe((list) => this.execs.set(list));
        this.load(kind, id, execId);
      });
    });
    // Polls while a test is under way, stops once nothing's left to wait for - see shared/poll.ts.
    pollWhile(
      () => this.hasInFlight(),
      () => {
        if (!this.loading()) this.load(this.kind(), this.id(), this.execId());
      },
    );
  }
  /** Its runs (one call), then each one not read yet - or read before its status changed. */
  private load(kind: Kind, id: string, execId: string) {
    this.api.executionRunsPage(kind, id, execId, 0, 500).subscribe({
      next: (p) => {
        this.loading.set(false);
        this.err.set(null);
        this.runs.set(p.items);
        const known = this.details();
        const stale = p.items.filter((r) => !(r.id in known) || known[r.id]?.status !== r.status);
        if (!stale.length) return;
        forkJoin(
          stale.map((r) =>
            this.api.runDetails(kind, id, execId, r.id).pipe(
              map((d): [string, RunDetails | null] => [r.id, d]),
              catchError(() => of<[string, RunDetails | null]>([r.id, null])),
            ),
          ),
        ).subscribe((pairs) =>
          this.details.update((d) => ({ ...d, ...Object.fromEntries(pairs) })),
        );
      },
      error: (e) => {
        this.loading.set(false);
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
