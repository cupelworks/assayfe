import { Component, inject, input, signal, computed, effect, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable, forkJoin, map, catchError, of } from 'rxjs';
import { RunsApiService } from '../api/runs-api.service';
import { CatalogStore } from '../api/catalog.store';
import { Kind, RunMetadata, TestTypeResult } from '../api/models';
import {
  rel,
  absTime,
  copyText,
  short,
  countByStatus,
  statusColor,
  statusLabel,
  errText,
} from '../shared/format';
import { Paged } from '../shared/paged';
import { PagerComponent } from '../shared/pager.component';

@Component({
  selector: 'assay-execution',
  standalone: true,
  imports: [RouterLink, PagerComponent],
  templateUrl: './execution.component.html',
  styleUrls: ['../shared/page.css', './execution.component.css'],
})
export class ExecutionComponent {
  kind = input.required<Kind>();
  id = input.required<string>();
  execId = input.required<string>();
  api = inject(RunsApiService);
  store = inject(CatalogStore);
  router = inject(Router);
  rel = rel;
  absTime = absTime;
  short = short;
  statusColor = statusColor;
  statusLabel = statusLabel;
  page = new Paged<RunMetadata>(
    (o, l) => this.api.executionRunsPage(this.kind(), this.id(), this.execId(), o, l),
    25,
    errText,
  );
  runs = this.page.items;
  busy = signal(false);
  msg = signal<{ ok: boolean; text: string } | null>(null);
  kindLabel = computed(() => (this.kind() === 'test-sets' ? 'Test set' : 'Test plan'));
  name = computed(() => this.store.parent(this.kind(), this.id())?.name ?? short(this.id()));
  exec = computed(() =>
    this.store.byParent(this.kind(), this.id()).find((e) => e.id === this.execId()),
  );
  /** Status breakdown of the current page (the API has no aggregate endpoint). */
  statuses = computed(() => countByStatus(this.runs()));
  /** Resolved frozen-entry name per run id, keyed by row - one GET .../test-runs/{runId} call
   *  per visible row (25/page), same pattern as RunsListComponent. Every row here is TestSet/
   *  TestPlan (this page only exists for an execution, which Standalone runs never have), so
   *  unlike the global runs list there's only ever the one lookup shape to make. */
  runNames = signal<Record<string, string>>({});
  /** Per-type pass/fail, from that same per-row RunDetails fetch (already made for the name) -
   *  null while the run has nothing to show yet (Pending/Running/NotRan). */
  runResults = signal<Record<string, Record<string, TestTypeResult> | null>>({});
  /** The id whose "Copied" feedback is currently showing (Entry or Run cell) - cleared 1.2s
   *  after a successful copy. */
  copiedId = signal<string | null>(null);
  constructor() {
    effect(() => {
      // This scope's own name (store.parent) - only sets or plans is needed, by kind.
      this.kind() === 'test-sets' ? this.store.loadSets() : this.store.loadPlans();
      this.id();
      this.execId();
      // untracked: see scopes-list.component.ts's identical comment.
      untracked(() => this.page.reset());
    });
    this.store.loadExecutions(); // exec() lookup via store.byParent
    effect(() => {
      const items = this.page.items();
      if (!items.length) {
        this.runNames.set({});
        this.runResults.set({});
        return;
      }
      forkJoin(items.map((r) => this.resolveRow(r))).subscribe((rows) => {
        this.runNames.set(Object.fromEntries(rows.map(([id, name]) => [id, name])));
        this.runResults.set(Object.fromEntries(rows.map(([id, , results]) => [id, results])));
      });
    });
  }
  private resolveRow(
    r: RunMetadata,
  ): Observable<[string, string, Record<string, TestTypeResult> | null]> {
    const fallback = `Untitled · ${short(r.id)}`;
    return this.api.runDetails(this.kind(), this.id(), this.execId(), r.id).pipe(
      map(
        (d) =>
          [r.id, d.name?.trim() || fallback, d.results ?? null] as [
            string,
            string,
            Record<string, TestTypeResult> | null,
          ],
      ),
      catchError(() =>
        of([r.id, fallback, null] as [string, string, Record<string, TestTypeResult> | null]),
      ),
    );
  }
  /** Results-column summary: a fixed-width pass/fail bar plus "x/y" - scales to any number of
   *  test types, unlike a dot per type. Null (rendered as a dash) while the run's had nothing to
   *  evaluate yet. */
  resultSummary(
    id: string,
  ): { passed: number; total: number; passPct: string; failPct: string; title: string } | null {
    const results = this.runResults()[id];
    if (!results) return null;
    const entries = Object.entries(results);
    if (!entries.length) return null;
    const total = entries.length;
    const failing = entries.filter(([, r]) => !r.passed).map(([name]) => name);
    const passed = total - failing.length;
    return {
      passed,
      total,
      passPct: (passed / total) * 100 + '%',
      failPct: (failing.length / total) * 100 + '%',
      title: failing.length ? `Failed: ${failing.join(', ')}` : 'All test types passed',
    };
  }
  async copyId(id: string) {
    if (await copyText(id)) {
      this.copiedId.set(id);
      setTimeout(() => {
        if (this.copiedId() === id) this.copiedId.set(null);
      }, 1200);
    }
  }
  replay() {
    this.busy.set(true);
    this.msg.set(null);
    this.api.replay(this.kind(), this.id(), this.execId()).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.store.load();
        this.router.navigate(['/', this.kind(), this.id(), 'executions', r.id]);
      },
      error: (e) => {
        this.busy.set(false);
        this.msg.set({ ok: false, text: errText(e) });
      },
    });
  }
}
