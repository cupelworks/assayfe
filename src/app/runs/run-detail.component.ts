// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RunsApiService } from '../api/runs-api.service';
import { ExecutionRun, Kind, RunDetails } from '../api/models';
import { displayName, errText, isInFlight } from '../shared/format';
import { pollWhile } from '../shared/poll';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { BannerComponent } from '../shared/work/banner.component';
import { RunBodyComponent } from './run-body.component';
import { RunNowComponent } from './run-now.component';
import { runLede, runOf } from './run-words';

/** A neighbour in the run: its page, and its name for a screen reader. */
interface Step {
  link: unknown[];
  name: string;
}

/**
 * A test in a set's or plan's run, on the Guide's layout, its top with the breadcrumbs:
 * "Test sets / <the set> / <its run> / Test" over the test's
 * name; beside it its place in the run - "Test 3 of 5 in this run", worst first as the run's page
 * lists them - with the previous and next; what was asked, how it went, its checks; then its
 * checks, its answer and the set's copy as it ran. Polls while it runs.
 */
@Component({
  selector: 'assay-run-detail',
  standalone: true,
  imports: [RouterLink, GuideHeadComponent, BannerComponent, RunNowComponent, RunBodyComponent],
  styleUrls: ['../shared/guide/guide.css', '../shared/guide/head-aside.css'],
  styles: `
    .pos {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    .steps {
      display: flex;
      gap: 24px;
    }
  `,
  template: `<div class="g-wrap">
    <assay-guide-head
      size="one"
      kicker="Test"
      [crumbs]="crumbs()"
      [copyId]="runId()"
      copyIdLabel="Run ID"
      [title]="title()"
      [lede]="lede()"
    >
      <nav class="page-aside" guideHeadAside aria-label="The other tests of this run">
        @if (place(); as p) {
          <span class="pos">Test {{ p.at }} of {{ p.of }} in this run</span>
          <span class="steps">
            @if (p.prev; as s) {
              <a class="go" [routerLink]="s.link" [attr.aria-label]="'Previous test: ' + s.name"
                >← Previous</a
              >
            } @else {
              <button type="button" class="go" disabled>← Previous</button>
            }
            @if (p.next; as s) {
              <a class="go" [routerLink]="s.link" [attr.aria-label]="'Next test: ' + s.name"
                >Next →</a
              >
            } @else {
              <button type="button" class="go" disabled>Next →</button>
            }
          </span>
        }
      </nav>
      <assay-run-now [run]="run()" />
    </assay-guide-head>
    <assay-banner [msg]="loadMsg()" />
    <assay-run-body
      [run]="run()"
      testSub="The set's copy, kept with the run"
      [testLink]="run()?.test_case_id ? ['/tests', run()!.test_case_id.id] : null"
    />
  </div>`,
})
export class RunDetailComponent {
  kind = input.required<Kind>();
  id = input.required<string>();
  execId = input.required<string>();
  runId = input.required<string>();
  private api = inject(RunsApiService);
  run = signal<RunDetails | null>(null);
  err = signal<string | null>(null);
  refreshing = signal(false);
  /** The run's runs, worst first as its page lists them (the API's order), each with its name -
   *  where this one stands among them. */
  private siblings = signal<ExecutionRun[]>([]);
  /** When the set's run started - its title, here in the breadcrumb. */
  private startedAt = signal<string | null>(null);
  /** Its set's or plan's name, as the run read on its own gives it - in the breadcrumb. */
  private scopeName = signal<string | null>(null);
  loadMsg = computed(() => {
    const e = this.err();
    return e ? { ok: false, text: e } : null;
  });
  private list = computed(() => (this.kind() === 'test-sets' ? 'Test sets' : 'Test plans'));
  /** The pages above it: the list, the set or plan by its name, its run by when it ran. */
  crumbs = computed(() => {
    const name = this.scopeName();
    const at = this.startedAt() ?? this.run()?.created_at;
    return [
      { label: this.list(), link: '/' + this.kind() },
      ...(name
        ? [{ label: displayName(name, this.id()), link: ['/', this.kind(), this.id()] }]
        : []),
      ...(at
        ? [{ label: runOf(at), link: ['/', this.kind(), this.id(), 'executions', this.execId()] }]
        : []),
    ];
  });
  title = computed(() => {
    const r = this.run();
    return r ? displayName(r.name, this.runId()) : '';
  });
  lede = computed(() => {
    const r = this.run();
    return r ? runLede(r, true, false) : '';
  });
  /** "Test 3 of 5 in this run", and the ones either side. */
  place = computed(() => {
    const all = this.siblings();
    const at = all.findIndex((r) => r.id === this.runId());
    if (at < 0) return null;
    const step = (r: ExecutionRun | undefined): Step | null =>
      r
        ? {
            link: ['/', this.kind(), this.id(), 'executions', this.execId(), 'runs', r.id],
            name: displayName(r.test_name, r.id),
          }
        : null;
    return { at: at + 1, of: all.length, prev: step(all[at - 1]), next: step(all[at + 1]) };
  });
  /** True while this run hasn't settled yet - drives the poll below. */
  hasInFlight = computed(() => isInFlight(this.run()?.status));
  constructor() {
    effect(() => {
      this.fetchRun();
    });
    effect(() => {
      const kind = this.kind(),
        id = this.id(),
        execId = this.execId();
      untracked(() => this.readRun(kind, id, execId));
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
        this.err.set(null);
        this.run.set(r);
      },
      error: (e) => {
        this.refreshing.set(false);
        this.err.set(errText(e));
      },
    });
  }
  /** The set's run: when it started (read on its own), and its runs worst first, named - one
   *  call each. */
  private readRun(kind: Kind, id: string, execId: string) {
    this.api.execution(kind, id, execId).subscribe({
      next: (e) => {
        this.startedAt.set(e.created_at);
        this.scopeName.set(e.name);
      },
      error: () => this.startedAt.set(null),
    });
    this.api.executionRunsPage(kind, id, execId, 0, 500, 'worst_first').subscribe({
      next: (p) => this.siblings.set(p.items),
      error: () => this.siblings.set([]),
    });
  }
}
