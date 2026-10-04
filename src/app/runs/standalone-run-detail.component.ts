import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RunsApiService } from '../api/runs-api.service';
import { TestTypesStore } from '../api/test-types.store';
import { StandaloneRunDetails } from '../api/models';
import { displayName, errText, isInFlight } from '../shared/format';
import { pollWhile } from '../shared/poll';
import { ActionRunner } from '../shared/action-runner';
import { ArrowOutComponent } from '../shared/arrow-out.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { BannerComponent } from '../shared/work/banner.component';
import { RunBodyComponent } from './run-body.component';
import { RunNowComponent } from './run-now.component';
import { allJudges, runLede, runOf } from './run-words';

/**
 * A test's run, on the Guide's layout as a page of one thing, its top with the breadcrumbs:
 * "Tests / <the test>" over the run's title - when it ran -
 * with Run once and Run with statistics ↗ beside it, what was asked and what read it, then how it
 * went and its checks; then its checks, its answer and the test as it ran. Polls while it runs.
 */
@Component({
  selector: 'assay-standalone-run-detail',
  standalone: true,
  imports: [
    RouterLink,
    GuideHeadComponent,
    ArrowOutComponent,
    BannerComponent,
    RunNowComponent,
    RunBodyComponent,
  ],
  styleUrls: ['../shared/guide/guide.css', '../shared/guide/head-aside.css'],
  template: `<div class="g-wrap">
    <assay-guide-head
      size="one"
      kicker="Run"
      [crumbs]="crumbs()"
      [copyId]="runId()"
      [title]="title()"
      [lede]="lede()"
    >
      <div class="page-aside" guideHeadAside>
        <button type="button" class="btn btn-primary" (click)="runOnce()" [disabled]="act.busy()">
          {{ act.busy() ? 'Starting…' : 'Run once' }}
        </button>
        <a
          class="go new-tab"
          [routerLink]="['/tests', id(), 'run-with-statistics']"
          target="_blank"
          rel="noopener"
          aria-label="Run with statistics, opens in a new tab"
          >Run with statistics<assay-arrow-out
        /></a>
      </div>
      <assay-run-now [run]="run()" [hint]="true" />
    </assay-guide-head>
    <assay-banner [msg]="act.msg() ?? loadMsg()" />
    <assay-run-body
      [run]="run()"
      testSub="Kept with the run: editing the test since changes nothing here"
      [testLink]="['/tests', id()]"
    />
  </div>`,
})
export class StandaloneRunDetailComponent {
  id = input.required<string>();
  runId = input.required<string>();
  private runsApi = inject(RunsApiService);
  private types = inject(TestTypesStore);
  private router = inject(Router);
  run = signal<StandaloneRunDetails | null>(null);
  err = signal<string | null>(null);
  refreshing = signal(false);
  act = new ActionRunner();
  loadMsg = computed(() => {
    const e = this.err();
    return e ? { ok: false, text: e } : null;
  });
  /** The pages above it: Tests, then the test, by its name. */
  crumbs = computed(() => {
    const r = this.run();
    return [
      { label: 'Tests', link: '/tests' },
      ...(r ? [{ label: displayName(r.name, this.id()), link: ['/tests', this.id()] }] : []),
    ];
  });
  title = computed(() => {
    const r = this.run();
    return r ? runOf(r.created_at) : '';
  });
  lede = computed(() => {
    const r = this.run();
    return r ? runLede(r, false, allJudges(r.test_type_assignments, this.types.byName())) : '';
  });
  /** True while this run hasn't settled yet - drives the poll below. */
  hasInFlight = computed(() => isInFlight(this.run()?.status));
  constructor() {
    this.types.load();
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
  /** Runs the test once more, and opens that run. */
  runOnce() {
    this.act.run(this.runsApi.runStandalone(this.id()), {
      then: (r) => this.router.navigate(['/tests', this.id(), 'runs', r.id]),
    });
  }
  private fetchRun() {
    this.refreshing.set(true);
    this.runsApi.standaloneRun(this.id(), this.runId()).subscribe({
      next: (r) => {
        this.refreshing.set(false);
        this.err.set(null);
        this.run.set(r);
      },
      error: (e) => {
        this.refreshing.set(false);
        this.err.set(errText(e));
      },
    });
  }
}
