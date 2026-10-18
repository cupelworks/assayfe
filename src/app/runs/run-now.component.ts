// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RunDetails, StandaloneRunDetails } from '../api/models';
import { isInFlight, rel } from '../shared/format';
import { StateBlockComponent } from '../shared/work/state-block.component';
import { runSays } from '../shared/work/sentences';
import { checksMet } from '../shared/work/checks-met.component';
import { answerFrom, metSays, notMetSays } from './run-words';

/**
 * How a run went, under its title, side by side as a page of one thing says how it stands: this
 * run - its status as a big word, what it means, where its answer came from and when - and its
 * checks ("2 of 3 met", which weren't, which were). A run that couldn't run says what went wrong
 * instead, as an alert, with Settings, which can test whether the application answers. While it
 * runs, only the first.
 */
@Component({
  selector: 'assay-run-now',
  standalone: true,
  imports: [RouterLink, StateBlockComponent],
  styleUrls: ['../shared/guide/head-aside.css', '../shared/work/work.css'],
  template: `
    @if (run(); as r) {
      <div class="now">
        <assay-state-block
          caption="This run"
          [of]="r.status"
          [say]="runSays(r.status)"
          [facts]="facts()"
        />
        @if (r.status === 'NotRan') {
          <assay-state-block
            caption="What went wrong"
            [alert]="r.error || runSays('NotRan')"
            facts="Settings can test whether your application answers."
          >
            <a class="go" routerLink="/settings">Open Settings →</a>
          </assay-state-block>
        } @else if (checks(); as c) {
          <assay-state-block
            caption="Its checks"
            [figure]="c.total ? c.met + ' of ' + c.total + ' met' : 'No checks'"
            [say]="notMetSays(c)"
            [facts]="checksFacts()"
          />
        }
      </div>
    }
  `,
})
export class RunNowComponent {
  run = input.required<RunDetails | StandaloneRunDetails | null>();
  /** A test's own run: say a run is only a signal - Run with statistics stands beside the title. */
  hint = input(false);
  runSays = runSays;
  notMetSays = notMetSays;
  /** "Asked live · 2 d ago". */
  facts = computed(() => {
    const r = this.run();
    return r ? `${answerFrom(r)} · ${rel(r.executed_at ?? r.created_at)}` : null;
  });
  /** Counted once it has finished. */
  checks = computed(() => {
    const r = this.run();
    return r && !isInFlight(r.status) ? checksMet(r) : null;
  });
  checksFacts = computed(() => {
    const c = this.checks();
    if (!c) return null;
    const hint = this.hint() ? 'One run is a signal; whether the test passes takes many.' : '';
    return [metSays(c), hint].filter(Boolean).join(' ') || null;
  });
}
