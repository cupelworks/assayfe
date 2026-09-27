import { Component, inject, input, signal, computed, effect, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TestSetsApiService } from '../api/test-sets-api.service';
import { RunsApiService } from '../api/runs-api.service';
import { CatalogStore } from '../api/catalog.store';
import { TestCaseBody, TestSetEntry } from '../api/models';
import { rel, short, errText, displayName } from '../shared/format';
import { NameDialogComponent } from '../shared/dialog/name-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { PickDialogComponent, PickRow } from '../shared/dialog/pick-dialog.component';
import { TestFormDialogComponent } from '../shared/dialog/test-form-dialog.component';
import { ExecutionsPanelComponent } from './executions-panel.component';
import { PagerComponent } from '../shared/pager.component';
import { Paged } from '../shared/paged';

type Dlg = null | 'rename' | 'delete' | 'add' | 'unlink' | 'deleteEntries' | 'editEntry';

import { Selection } from '../shared/selection';

@Component({
  selector: 'assay-test-set-detail',
  standalone: true,
  imports: [
    RouterLink,
    NameDialogComponent,
    ConfirmDialogComponent,
    PickDialogComponent,
    TestFormDialogComponent,
    ExecutionsPanelComponent,
    PagerComponent,
  ],
  templateUrl: './test-set-detail.component.html',
  styleUrls: ['../shared/page.css'],
})
export class TestSetDetailComponent {
  id = input.required<string>();
  testSetsApi = inject(TestSetsApiService);
  runsApi = inject(RunsApiService);
  store = inject(CatalogStore);
  router = inject(Router);
  rel = rel;
  short = short;
  displayName = displayName;
  page = new Paged<TestSetEntry>(
    (o, l) => this.testSetsApi.testSetEntries(this.id(), o, l),
    25,
    errText,
  );
  entries = this.page.items;
  version = signal(0);
  /** Checkbox bulk selection over the visible rows - see shared/selection.ts. */
  selection = new Selection(() => this.entries());
  editing = signal<TestSetEntry | null>(null);
  dlg = signal<Dlg>(null);
  busy = signal(false);
  err = signal<string | null>(null);
  msg = signal<{ ok: boolean; text: string } | null>(null);
  meta = computed(() => this.store.parent('test-sets', this.id()));
  name = computed(() => this.meta()?.name ?? short(this.id()));
  execs = computed(() => this.store.byParent('test-sets', this.id()));
  hasRuns = computed(() => this.execs().length > 0);
  /** Entry ids with at least one run against them, i.e. frozen for good - there's no field on
   *  the entry itself for this (the API has no `frozen`/`has_runs` flag), so it's derived by
   *  fetching every run of every execution *of this set* (scoped via RunsApiService.executions(),
   *  not CatalogStore's global cross-system sample - accuracy here matters more than for the
   *  "Delete" button's hasRuns() guard above, since this drives a per-row claim, not a
   *  pre-disable ahead of a guard the server enforces anyway) and collecting their
   *  test_set_entry_id. Recomputed on load and after every mutation that could create a new run
   *  (Run live, Replay), same trigger points as `loadEntries()`. */
  frozenEntryIds = signal<Set<string>>(new Set());
  pickRows = computed<PickRow[]>(() => {
    const inSet = new Set(this.entries().map((e) => e.test_case_id.id));
    return this.store.tests().map((t) => {
      const dup = inSet.has(t.id),
        noTypes = !t.test_type_assignments?.length;
      return {
        id: t.id,
        name: displayName(t.name, t.id),
        sub: t.input,
        meta: dup
          ? 'already in set'
          : noTypes
            ? 'no test types'
            : t.test_type_assignments!.map((a) => a.name).join(', '),
        disabled: dup,
        dim: noTypes,
      };
    });
  });
  pickLabel = (n: number) => `Add ${n || ''} as frozen entries`;

  constructor() {
    // tests: "Add tests" picker. sets: this set's own name (store.parent). executions: hasRuns guard.
    this.store.loadTests();
    this.store.loadSets();
    this.store.loadExecutions();
    effect(() => {
      this.id();
      // untracked: see scopes-list.component.ts's identical comment.
      untracked(() => {
        this.page.reset();
        this.loadFrozenEntries();
      });
    });
  }
  loadEntries() {
    this.selection.clear();
    this.page.reload();
  }
  loadFrozenEntries() {
    this.runsApi.executions('test-sets', this.id()).subscribe((execs) => {
      if (!execs.length) {
        this.frozenEntryIds.set(new Set());
        return;
      }
      forkJoin(
        execs.map((e) => this.runsApi.executionRuns('test-sets', this.id(), e.id)),
      ).subscribe((runsPerExec) => {
        const ids = new Set<string>();
        for (const runs of runsPerExec) {
          for (const r of runs) {
            if (r.test_set_entry_id) ids.add(r.test_set_entry_id.id);
          }
        }
        this.frozenEntryIds.set(ids);
      });
    });
  }
  open(d: Dlg, entry?: TestSetEntry) {
    this.err.set(null);
    if (entry) this.editing.set(entry);
    this.dlg.set(d);
  }

  private run(req: { subscribe: Function }, ok: (r: any) => string, after?: () => void) {
    this.busy.set(true);
    this.err.set(null);
    req.subscribe({
      next: (r: any) => {
        this.busy.set(false);
        this.dlg.set(null);
        this.msg.set({ ok: true, text: ok(r) });
        this.loadEntries();
        this.loadFrozenEntries();
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
    this.run(this.testSetsApi.renameTestSet(this.id(), n), () => `Renamed to “${n}”.`);
  }
  remove() {
    this.run(
      this.testSetsApi.deleteTestSet(this.id()),
      () => 'Test set deleted.',
      () => this.router.navigate(['/test-sets']),
    );
  }
  add(ids: string[]) {
    this.run(
      this.testSetsApi.addTestsToSet(this.id(), ids),
      () => `Added ${ids.length} test${ids.length === 1 ? '' : 's'} as frozen entries.`,
    );
  }
  unlink() {
    const ids = this.selection.ids();
    this.run(
      this.testSetsApi.unlinkEntries(this.id(), ids),
      () =>
        `Unlinked ${ids.length} entr${ids.length === 1 ? 'y' : 'ies'} - content and runs preserved.`,
    );
  }
  deleteEntries() {
    const ids = this.selection.ids();
    this.run(
      this.testSetsApi.deleteEntries(this.id(), ids),
      () => `Deleted ${ids.length} entr${ids.length === 1 ? 'y' : 'ies'}.`,
    );
  }
  saveEntry(b: TestCaseBody) {
    this.run(
      this.testSetsApi.updateTestSetEntry(this.id(), this.editing()!.id, b),
      () => 'Entry updated.',
    );
  }
  runLive() {
    this.run(
      this.runsApi.runLive('test-sets', this.id()),
      (r) => `Enqueued ${r.run_count} pending runs.`,
    );
  }
  replay(execId: string) {
    this.run(
      this.runsApi.replay('test-sets', this.id(), execId),
      (r) => `Enqueued ${r.run_count} pending runs (replay of ${short(execId)}).`,
    );
  }
}
