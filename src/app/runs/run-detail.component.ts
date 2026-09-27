import { Component, inject, input, signal, computed, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RunsApiService } from '../api/runs-api.service';
import { CatalogStore } from '../api/catalog.store';
import { Kind, RunDetails } from '../api/models';
import { short, errText, isInFlight } from '../shared/format';
import { pollWhile } from '../shared/poll';
import { RunBodyComponent } from './run-body.component';

@Component({
  selector: 'assay-run-detail',
  standalone: true,
  imports: [RouterLink, RunBodyComponent],
  styleUrls: ['../shared/page.css'],
  template: ` <div class="crumbs">
      <a [routerLink]="['/', kind()]">{{ kindLabel() }}s</a><span>/</span
      ><a [routerLink]="['/', kind(), id()]">{{ name() }}</a
      ><span>/</span
      ><a [routerLink]="['/', kind(), id(), 'executions', execId()]">{{ short(execId()) }}</a
      ><span>/</span><span class="cur">{{ short(runId()) }}</span>
    </div>
    <div class="hero">
      <div>
        <div class="kicker">Test run</div>
        <h1>{{ run()?.name || 'Run ' + short(runId()) }}</h1>
      </div>
    </div>
    @if (err(); as e) {
      <div class="msg msg-err">{{ e }}</div>
    }
    <assay-run-body
      [run]="run()"
      [content]="run()"
      heading="Frozen entry"
      [snapshotAt]="run()?.test_case_snapshot_at?.snapshot_at ?? null"
      [sourceLink]="run() ? ['/tests', run()!.test_case_id.id] : null"
    />`,
})
export class RunDetailComponent {
  kind = input.required<Kind>();
  id = input.required<string>();
  execId = input.required<string>();
  runId = input.required<string>();
  api = inject(RunsApiService);
  store = inject(CatalogStore);
  short = short;
  run = signal<RunDetails | null>(null);
  err = signal<string | null>(null);
  refreshing = signal(false);
  kindLabel = computed(() => (this.kind() === 'test-sets' ? 'Test set' : 'Test plan'));
  name = computed(() => this.store.parent(this.kind(), this.id())?.name ?? short(this.id()));
  /** True while this run hasn't settled yet - drives the poll below. */
  hasInFlight = computed(() => isInFlight(this.run()?.status));
  constructor() {
    effect(() => {
      // This scope's own name (store.parent) - only sets or plans is needed, by kind.
      this.kind() === 'test-sets' ? this.store.loadSets() : this.store.loadPlans();
      this.fetchRun();
    });
    // Polls while the run is in flight, stops once it settles - see shared/poll.ts. Skips a tick
    // while the previous fetch is still in flight.
    pollWhile(
      () => this.hasInFlight(),
      () => {
        if (!this.refreshing()) this.fetchRun();
      },
    );
  }
  private fetchRun() {
    this.refreshing.set(true);
    this.api.runDetails(this.kind(), this.id(), this.execId(), this.runId()).subscribe({
      next: (r) => {
        this.refreshing.set(false);
        this.run.set(r);
      },
      error: (e) => {
        this.refreshing.set(false);
        this.err.set(errText(e));
      },
    });
  }
}
