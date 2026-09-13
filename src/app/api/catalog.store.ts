import { Injectable, inject, signal, computed } from '@angular/core';
import { forkJoin, of, switchMap, map } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AssayApiService } from './assay-api.service';
import {
  DataSetMetadata,
  ExecutionMetadata,
  Kind,
  RunMetadata,
  ScopeMetadata,
  TestCase,
} from './models';

export interface ExecRow extends ExecutionMetadata {
  kind: Kind;
  parentId: string;
  scope: 'Test set' | 'Test plan';
  target: string;
}

/** Root store: catalogs + every execution (per set/plan) + runs of the newest 12 executions. Pages read signals; mutations call load(). */
@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private api = inject(AssayApiService);
  loading = signal(true);
  error = signal<string | null>(null);
  datasets = signal<DataSetMetadata[]>([]);
  tests = signal<TestCase[]>([]);
  sets = signal<ScopeMetadata[]>([]);
  plans = signal<ScopeMetadata[]>([]);
  executions = signal<ExecRow[]>([]);
  recentRuns = signal<RunMetadata[]>([]);
  statusLabel = computed(() =>
    this.loading() ? 'Connecting…' : this.error() ? 'API unreachable' : 'Connected',
  );

  byParent(kind: Kind, id: string) {
    return this.executions().filter((e) => e.kind === kind && e.parentId === id);
  }
  parent(kind: Kind, id: string) {
    return (kind === 'test-sets' ? this.sets() : this.plans()).find((x) => x.id === id);
  }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .overview()
      .pipe(
        switchMap((o) => {
          const reqs = [
            ...o.sets.map((s) =>
              this.api.executions('test-sets', s.id).pipe(
                map((x) =>
                  x.map((e) => ({
                    ...e,
                    kind: 'test-sets' as Kind,
                    parentId: s.id,
                    scope: 'Test set' as const,
                    target: s.name,
                  })),
                ),
              ),
            ),
            ...o.plans.map((p) =>
              this.api.executions('test-plans', p.id).pipe(
                map((x) =>
                  x.map((e) => ({
                    ...e,
                    kind: 'test-plans' as Kind,
                    parentId: p.id,
                    scope: 'Test plan' as const,
                    target: p.name,
                  })),
                ),
              ),
            ),
          ];
          return (reqs.length ? forkJoin(reqs) : of([] as ExecRow[][])).pipe(
            map((ex) => ({
              ...o,
              executions: ex
                .flat()
                .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
            })),
          );
        }),
        switchMap((o) => {
          const reqs = o.executions
            .slice(0, 12)
            .map((e) => this.api.executionRuns(e.kind, e.parentId, e.id));
          return (reqs.length ? forkJoin(reqs) : of([] as RunMetadata[][])).pipe(
            map((r) => ({ ...o, runs: r.flat() })),
          );
        }),
      )
      .subscribe({
        next: (o) => {
          this.datasets.set(o.datasets);
          this.tests.set(o.tests);
          this.sets.set(o.sets);
          this.plans.set(o.plans);
          this.executions.set(o.executions);
          this.recentRuns.set(o.runs);
          this.loading.set(false);
        },
        error: (e: HttpErrorResponse) => {
          this.error.set(e.message);
          this.loading.set(false);
        },
      });
  }
}
