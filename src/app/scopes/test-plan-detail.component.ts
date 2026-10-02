import { Component, inject, input, signal, computed, effect, untracked } from '@angular/core';
import { ActionRunner } from '../shared/action-runner';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { TestPlansApiService } from '../api/test-plans-api.service';
import { RunsApiService } from '../api/runs-api.service';
import { CatalogStore } from '../api/catalog.store';
import { Batch, TestPlanEntry } from '../api/models';
import { RunStatsDialogComponent } from '../statistics/run-stats-dialog.component';
import { StatsPanelComponent } from '../statistics/stats-panel.component';
import { short, errText } from '../shared/format';
import { NameDialogComponent } from '../shared/dialog/name-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { PickDialogComponent, PickRow } from '../shared/dialog/pick-dialog.component';
import { ExecutionsPanelComponent } from './executions-panel.component';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { Paged } from '../shared/paged';

type Dlg = null | 'rename' | 'delete' | 'link' | 'unlink' | 'stats';

@Component({
  selector: 'assay-test-plan-detail',
  standalone: true,
  imports: [
    RouterLink,
    NameDialogComponent,
    ConfirmDialogComponent,
    PickDialogComponent,
    ExecutionsPanelComponent,
    PagerComponent,
    RelTimeComponent,
    RunStatsDialogComponent,
    StatsPanelComponent,
  ],
  templateUrl: './test-plan-detail.component.html',
  styleUrls: ['../shared/page.css'],
})
export class TestPlanDetailComponent {
  id = input.required<string>();
  testPlansApi = inject(TestPlansApiService);
  runsApi = inject(RunsApiService);
  store = inject(CatalogStore);
  router = inject(Router);
  short = short;
  page = new Paged<TestPlanEntry>(
    (o, l) => this.testPlansApi.testPlanEntries(this.id(), o, l),
    25,
    errText,
  );
  links = this.page.items;
  version = signal(0);
  /** True execution count per test set, for pickRows below - loaded fresh each time the "Link
   *  test sets" dialog opens (see open()), not eagerly, since it's only ever shown there.
   *  Deliberately not CatalogStore.executions (capped, recency-biased - see
   *  scopes-list.component.ts's identical comment for why that can't give an accurate count).
   *  limit=0: the API returns items: [] plus the real `total`, nothing but the count itself
   *  is ever transferred. */
  pickExecCounts = signal<Record<string, number>>({});
  unlinkTarget = signal<TestPlanEntry | null>(null);
  dlg = signal<Dlg>(null);
  /** Busy flag, dialog error and page banner for this page's API actions - see shared/action-runner.ts. */
  act = new ActionRunner({
    inDialog: () => !!this.dlg(),
    done: () => {
      this.dlg.set(null);
      this.page.reload();
      this.version.update((v) => v + 1);
      this.store.load();
    },
  });
  meta = computed(() => this.store.parent('test-plans', this.id()));
  name = computed(() => this.meta()?.name ?? short(this.id()));
  execs = computed(() => this.store.byParent('test-plans', this.id()));
  /** Every execution of the plan, a statistics batch's included - the store's sample leaves
   *  those out, and one is enough to block deleting the plan. */
  allExecutions = signal(0);
  hasRuns = computed(() => this.execs().length > 0 || this.allExecutions() > 0);
  statsScope = computed(() => ({ test_plan_id: this.id() }));
  linkedTotal = this.page.total;
  pickRows = computed<PickRow[]>(() => {
    const linked = new Set(this.links().map((l) => l.test_set.id));
    const counts = this.pickExecCounts();
    return this.store.sets().map((s) => {
      const n = counts[s.id];
      const execLabel = n === undefined ? '…' : `${n} execution${n === 1 ? '' : 's'}`;
      return {
        id: s.id,
        name: s.name,
        meta: linked.has(s.id) ? 'already linked' : execLabel,
        disabled: linked.has(s.id),
      };
    });
  });
  pickLabel = (n: number) => `Link ${n || ''} test set${n === 1 ? '' : 's'}`;

  constructor() {
    // sets: "Link test sets" picker's set list. plans: this plan's own name (store.parent).
    // executions: hasRuns guard only now - pickRows' own execution counts come from
    // pickExecCounts (loaded per-set on demand, see open()), not this global sample.
    this.store.loadSets();
    this.store.loadPlans();
    this.store.loadExecutions();
    effect(() => {
      this.id();
      // untracked: load() -> page.reset() reads page's own offset()/limit() signals - see
      // scopes-list.component.ts's identical comment.
      untracked(() => this.load());
    });
  }
  load() {
    this.page.reset();
    this.runsApi
      .executionsPage('test-plans', this.id(), 0, 0)
      .subscribe({ next: (p) => this.allExecutions.set(p.total), error: () => {} });
  }
  open(d: Dlg, l?: TestPlanEntry) {
    this.act.err.set(null);
    if (l) this.unlinkTarget.set(l);
    if (d === 'link') this.loadPickExecCounts();
    this.dlg.set(d);
  }
  private loadPickExecCounts() {
    const sets = this.store.sets();
    if (!sets.length) {
      this.pickExecCounts.set({});
      return;
    }
    forkJoin(
      sets.map((s) =>
        this.runsApi
          .executionsPage('test-sets', s.id, 0, 0, 'none')
          .pipe(map((p) => [s.id, p.total] as [string, number])),
      ),
    ).subscribe((pairs) => this.pickExecCounts.set(Object.fromEntries(pairs)));
  }
  rename(n: string) {
    this.act.run(this.testPlansApi.renameTestPlan(this.id(), n), {
      ok: () => `Renamed to “${n}”.`,
    });
  }
  remove() {
    this.act.run(this.testPlansApi.deleteTestPlan(this.id()), {
      ok: () => 'Test plan deleted.',
      then: () => this.router.navigate(['/test-plans']),
    });
  }
  link(ids: string[]) {
    this.act.run(this.testPlansApi.linkSetsToPlan(this.id(), ids), {
      ok: () => `Linked ${ids.length} test set${ids.length === 1 ? '' : 's'}.`,
    });
  }
  unlink() {
    const s = this.unlinkTarget()!.test_set;
    this.act.run(this.testPlansApi.unlinkSetsFromPlan(this.id(), [s.id]), {
      ok: () => `Removed “${s.name}” from this plan.`,
    });
  }
  runLive() {
    this.act.run(this.runsApi.runLive('test-plans', this.id()), {
      ok: (r) => `Enqueued ${r.run_count} pending runs.`,
    });
  }
  replay(execId: string) {
    this.act.run(this.runsApi.replay('test-plans', this.id(), execId), {
      ok: (r) => `Enqueued ${r.run_count} pending runs (replay of ${short(execId)}).`,
    });
  }
  /** A batch was started from the dialog: its page shows it running. */
  openBatch(b: Batch) {
    this.dlg.set(null);
    this.router.navigate(['/statistics/batches', b.id]);
  }
}
