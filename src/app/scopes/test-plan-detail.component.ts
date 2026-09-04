import { Component, inject, input, signal, computed, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { AssayApiService } from '../api/assay-api.service';
import { CatalogStore } from '../api/catalog.store';
import { TestPlanEntry, TestSetEntry } from '../api/models';
import { rel, short, errText } from '../shared/format';
import { NameDialogComponent } from '../shared/dialog/name-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { PickDialogComponent, PickRow } from '../shared/dialog/pick-dialog.component';
import { ExecutionsPanelComponent } from './executions-panel.component';
import { PagerComponent } from '../shared/pager.component';
import { Paged } from '../shared/paged';

type Dlg = null | 'rename' | 'delete' | 'link' | 'unlink';

@Component({ selector: 'assay-test-plan-detail', standalone: true, imports: [RouterLink, NameDialogComponent, ConfirmDialogComponent, PickDialogComponent, ExecutionsPanelComponent, PagerComponent], templateUrl: './test-plan-detail.component.html', styleUrls: ['../shared/page.css'] })
export class TestPlanDetailComponent {
  id = input.required<string>();
  api = inject(AssayApiService); store = inject(CatalogStore); router = inject(Router); rel = rel; short = short;
  page = new Paged<TestPlanEntry>((o, l) => this.api.testPlanEntries(this.id(), o, l), 25, errText);
  links = this.page.items; version = signal(0); entryCounts = signal<Record<string, number>>({}); unlinkTarget = signal<TestPlanEntry | null>(null);
  dlg = signal<Dlg>(null); busy = signal(false); err = signal<string | null>(null); msg = signal<{ ok: boolean; text: string } | null>(null);
  meta = computed(() => this.store.parent('test-plans', this.id()));
  name = computed(() => this.meta()?.name ?? short(this.id()));
  execs = computed(() => this.store.byParent('test-plans', this.id()));
  hasRuns = computed(() => this.execs().length > 0);
  totalEntries = computed(() => Object.values(this.entryCounts()).reduce((a, b) => a + b, 0));
  linkedTotal = this.page.total;
  pickRows = computed<PickRow[]>(() => {
    const linked = new Set(this.links().map(l => l.test_set.id));
    return this.store.sets().map(s => { const n = this.store.byParent('test-sets', s.id).length; return { id: s.id, name: s.name, meta: linked.has(s.id) ? 'already linked' : `${n} execution${n === 1 ? '' : 's'}`, disabled: linked.has(s.id) }; });
  });
  pickLabel = (n: number) => `Link ${n || ''} test set${n === 1 ? '' : 's'}`;

  constructor() {
    effect(() => { this.id(); this.load(); });
    // entry counts for the sets on the current page (1-row fetch per set — only total is used)
    effect(() => { const links = this.links(); if (!links.length) { this.entryCounts.set({}); return; }
      forkJoin(links.map(l => this.api.testSetEntries(l.test_set.id, 0, 1).pipe(map(p => [l.test_set.id, p.total] as [string, number])))).subscribe(pairs => this.entryCounts.set(Object.fromEntries(pairs))); });
  }
  load() { this.page.reset(); }
  open(d: Dlg, l?: TestPlanEntry) { this.err.set(null); if (l) this.unlinkTarget.set(l); this.dlg.set(d); }
  private run(req: { subscribe: Function }, ok: (r: any) => string, after?: () => void) {
    this.busy.set(true); this.err.set(null);
    req.subscribe({
      next: (r: any) => { this.busy.set(false); this.dlg.set(null); this.msg.set({ ok: true, text: ok(r) }); this.page.reload(); this.version.update(v => v + 1); this.store.load(); after?.(); },
      error: (e: unknown) => { this.busy.set(false); const t = errText(e); this.dlg() ? this.err.set(t) : this.msg.set({ ok: false, text: t }); },
    });
  }
  rename(n: string) { this.run(this.api.renameTestPlan(this.id(), n), () => `Renamed to “${n}”.`); }
  remove() { this.run(this.api.deleteTestPlan(this.id()), () => 'Test plan deleted.', () => this.router.navigate(['/test-plans'])); }
  link(ids: string[]) { this.run(this.api.linkSetsToPlan(this.id(), ids), () => `Linked ${ids.length} test set${ids.length === 1 ? '' : 's'}.`); }
  unlink() { const s = this.unlinkTarget()!.test_set; this.run(this.api.unlinkSetsFromPlan(this.id(), [s.id]), () => `Removed “${s.name}” from this plan.`); }
  runLive() { this.run(this.api.runLive('test-plans', this.id()), r => `Enqueued ${r.run_count} pending runs.`); }
  replay(execId: string) { this.run(this.api.replay('test-plans', this.id(), execId), r => `Enqueued ${r.run_count} pending runs (replay of ${short(execId)}).`); }
}
