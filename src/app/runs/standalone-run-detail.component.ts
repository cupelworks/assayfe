import { Component, inject, input, signal, computed, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RunsApiService } from '../api/runs-api.service';
import { StandaloneRunDetails } from '../api/models';
import { short, errText, isInFlight } from '../shared/format';
import { pollWhile } from '../shared/poll';
import { RunBodyComponent } from './run-body.component';

@Component({
  selector: 'assay-standalone-run-detail',
  standalone: true,
  imports: [RouterLink, RunBodyComponent],
  styleUrls: ['../shared/page.css'],
  template: ` <div class="crumbs">
      <a routerLink="/tests">Tests</a><span>/</span
      ><a [routerLink]="['/tests', id()]">{{ name() }}</a
      ><span>/</span><span class="cur">{{ short(runId()) }}</span>
    </div>
    <div class="hero">
      <div>
        <div class="kicker">Standalone run</div>
        <h1>{{ name() }}</h1>
      </div>
    </div>
    @if (err(); as e) {
      <div class="msg msg-err">{{ e }}</div>
    }
    <assay-run-body
      [run]="run()"
      [content]="run()"
      heading="Recorded test"
      [snapshotAt]="run()?.test_case_snapshot_at?.snapshot_at ?? null"
      [sourceLink]="run() ? ['/tests', run()!.test_case_id.id] : null"
    />`,
})
export class StandaloneRunDetailComponent {
  id = input.required<string>();
  runId = input.required<string>();
  runsApi = inject(RunsApiService);
  short = short;
  run = signal<StandaloneRunDetails | null>(null);
  err = signal<string | null>(null);
  refreshing = signal(false);
  name = computed(() => this.run()?.name || 'Untitled · ' + short(this.id()));
  /** True while this run hasn't settled yet - drives the poll below. */
  hasInFlight = computed(() => isInFlight(this.run()?.status));
  constructor() {
    effect(() => this.fetchRun());
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
    this.runsApi.standaloneRun(this.id(), this.runId()).subscribe({
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
