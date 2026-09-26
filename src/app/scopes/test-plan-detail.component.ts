import { Component, inject, input, signal, computed, effect, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { TestPlansApiService } from '../api/test-plans-api.service';
import { RunsApiService } from '../api/runs-api.service';
import { CatalogStore } from '../api/catalog.store';
import { TestPlanEntry } from '../api/models';
import { short, errText } from '../shared/format';
import { NameDialogComponent } from '../shared/dialog/name-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { PickDialogComponent, PickRow } from '../shared/dialog/pick-dialog.component';
import { ExecutionsPanelComponent } from './executions-panel.component';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { Paged } from '../shared/paged';

type Dlg = null | 'rename' | 'delete' | 'link' | 'unlink';

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
  busy = signal(false);
  err = signal<string | null>(null);
  msg = signal<{ ok: boolean; text: string } | null>(null);
  meta = computed(() => this.store.parent('test-plans', this.id()));
  name = computed(() => this.meta()?.name ?? short(this.id()));
  execs = computed(() => this.store.byParent('test-plans', this.id()));
  hasRuns = computed(() => this.execs().length > 0);
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
  }
  open(d: Dlg, l?: TestPlanEntry) {
    this.err.set(null);
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
          .executionsPage('test-sets', s.id, 0, 0)
          .pipe(map((p) => [s.id, p.total] as [string, number])),
      ),
    ).subscribe((pairs) => this.pickExecCounts.set(Object.fromEntries(pairs)));
  }
  private run(req: { subscribe: Function }, ok: (r: any) => string, after?: () => void) {
    this.busy.set(true);
    this.err.set(null);
    req.subscribe({
      next: (r: any) => {
        this.busy.set(false);
        this.dlg.set(null);
        this.msg.set({ ok: true, text: ok(r) });
        this.page.reload();
        this.version.update((v) => v + 1);
        this.store.load();
        after?.();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        const t = errText(e);
        this.dlg() ? this.err.set(t) : this.msg.set({ ok: false, text: t });
      },
    });
  }
  rename(n: string) {
    this.run(this.testPlansApi.renameTestPlan(this.id(), n), () => `Renamed to “${n}”.`);
  }
  remove() {
    this.run(
      this.testPlansApi.deleteTestPlan(this.id()),
      () => 'Test plan deleted.',
      () => this.router.navigate(['/test-plans']),
    );
  }
  link(ids: string[]) {
    this.run(
      this.testPlansApi.linkSetsToPlan(this.id(), ids),
      () => `Linked ${ids.length} test set${ids.length === 1 ? '' : 's'}.`,
    );
  }
  unlink() {
    const s = this.unlinkTarget()!.test_set;
    this.run(
      this.testPlansApi.unlinkSetsFromPlan(this.id(), [s.id]),
      () => `Removed “${s.name}” from this plan.`,
    );
  }
  runLive() {
    this.run(
      this.runsApi.runLive('test-plans', this.id()),
      (r) => `Enqueued ${r.run_count} pending runs.`,
    );
  }
  replay(execId: string) {
    this.run(
      this.runsApi.replay('test-plans', this.id(), execId),
      (r) => `Enqueued ${r.run_count} pending runs (replay of ${short(execId)}).`,
    );
  }
}
