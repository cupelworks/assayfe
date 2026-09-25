import { Component, inject, input, signal, computed, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { RunsApiService } from '../api/runs-api.service';
import { TestsApiService } from '../api/tests-api.service';
import { StandaloneRunDetails, TestCase } from '../api/models';
import { short, errText } from '../shared/format';
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
        <p class="hero-note" style="margin-top:12px">
          Ran the live test as it was at execution time - no frozen snapshot.
        </p>
      </div>
    </div>
    @if (err(); as e) {
      <div class="msg msg-err">{{ e }}</div>
    }
    <assay-run-body [run]="run()" [content]="test()" heading="Test (current)" />`,
})
export class StandaloneRunDetailComponent {
  id = input.required<string>();
  runId = input.required<string>();
  runsApi = inject(RunsApiService);
  testsApi = inject(TestsApiService);
  short = short;
  run = signal<StandaloneRunDetails | null>(null);
  test = signal<TestCase | null>(null);
  err = signal<string | null>(null);
  refreshing = signal(false);
  name = computed(() => this.test()?.name || 'Test ' + short(this.id()));
  /** True while this run hasn't settled yet - drives the poll below. */
  hasInFlight = computed(() => {
    const s = this.run()?.status;
    return s === 'Pending' || s === 'Running';
  });
  /** Re-checks hasInFlight() before every tick, stops itself once the run has settled - see
   *  shared/poll.ts. Only re-fetches the run itself, not the live test alongside it (the initial
   *  load's forkJoin) - the test's own content isn't what a poll is watching for. Skips a tick
   *  while the previous fetch is still in flight. */
  private startPolling = pollWhile(
    () => this.hasInFlight(),
    () => {
      if (!this.refreshing()) this.fetchRun();
    },
  );
  constructor() {
    effect(() => {
      forkJoin({
        run: this.runsApi.standaloneRun(this.id(), this.runId()),
        test: this.testsApi.test(this.id()),
      }).subscribe({
        next: (r) => {
          this.run.set(r.run);
          this.test.set(r.test);
        },
        error: (e) => this.err.set(errText(e)),
      });
    });
    effect(() => {
      if (this.hasInFlight()) this.startPolling();
    });
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
