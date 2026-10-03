import { ChecksViewComponent } from '../shared/checks-view.component';
import { Component, inject, input, signal, computed, effect, untracked } from '@angular/core';
import { ActionRunner } from '../shared/action-runner';
import { Router, RouterLink } from '@angular/router';
import { TestsApiService } from '../api/tests-api.service';
import { RunsApiService } from '../api/runs-api.service';
import { CatalogStore } from '../api/catalog.store';
import { StandaloneRun, TestCase, TestCaseBody } from '../api/models';
import { StatsPanelComponent } from '../statistics/stats-panel.component';
import {
  short,
  isInFlight,
  errText,
  statusColor,
  statusLabel,
  displayName,
} from '../shared/format';
import { TestFormDialogComponent } from '../shared/dialog/test-form-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { Paged } from '../shared/paged';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { CopyButtonComponent } from '../shared/copy-button.component';
import { pollWhile } from '../shared/poll';
import { ArrowOutComponent } from '../shared/arrow-out.component';

@Component({
  selector: 'assay-test-detail',
  standalone: true,
  imports: [
    ArrowOutComponent,
    ChecksViewComponent,
    RouterLink,
    TestFormDialogComponent,
    ConfirmDialogComponent,
    PagerComponent,
    RelTimeComponent,
    CopyButtonComponent,
    StatsPanelComponent,
  ],
  templateUrl: './test-detail.component.html',
  styleUrls: ['../shared/page.css'],
  // Input opens the column now (the checks moved below the fields), so it needs no rule above it.
  styles: ['.cell > .field-ro:first-child { border-top: 0; padding-top: 0; }'],
})
export class TestDetailComponent {
  id = input.required<string>();
  testsApi = inject(TestsApiService);
  runsApi = inject(RunsApiService);
  store = inject(CatalogStore);
  router = inject(Router);
  short = short;
  statusColor = statusColor;
  statusLabel = statusLabel;
  test = signal<TestCase | null>(null);
  /** The runs started from this page - a statistics batch's are on the batch's page. */
  runsPage = new Paged<StandaloneRun>(
    (o, l) => this.runsApi.standaloneRunsPage(this.id(), o, l, 'none'),
    10,
    errText,
  );
  runs = this.runsPage.items;
  dlg = signal<null | 'edit' | 'delete' | 'clear-output'>(null);
  statsScope = computed(() => ({ test_id: this.id() }));
  /** Busy flag, dialog error and page banner for this page's API actions - see shared/action-runner.ts. */
  act = new ActionRunner({
    inDialog: () => !!this.dlg(),
    done: () => this.dlg.set(null),
  });
  name = computed(() => displayName(this.test()?.name, this.id()));
  /** The test's text fields, empty ones left out. The recorded model output is `clearable`: once
   *  cleared, runs ask the application under test for an answer instead. */
  fields = computed(() => {
    const t = this.test();
    if (!t) return [];
    const all: { label: string; value: string | null | undefined; clearable?: boolean }[] = [
      { label: 'Input', value: t.input },
      { label: 'Expected output', value: t.expected_output },
      { label: 'Model output', value: t.model_output, clearable: true },
    ];
    return all.filter((f): f is typeof f & { value: string } => !!f.value);
  });
  canRun = computed(() => !!this.test()?.test_type_assignments?.length);
  /** True while the loaded page still has a Pending/Running standalone run - drives the poll
   *  below. */
  hasInFlight = computed(() => this.runs().some((r) => isInFlight(r.status)));
  constructor() {
    effect(() => {
      this.id();
      // untracked: load() -> runsPage.reload() reads runsPage's own offset()/limit() signals -
      // see scopes-list.component.ts's identical comment.
      untracked(() => this.load());
    });
    // Polls while a run is in flight, stops once nothing's left to wait for - see shared/poll.ts.
    // Skips a tick while the previous reload is still in flight.
    pollWhile(
      () => this.hasInFlight(),
      () => {
        if (!this.runsPage.loading()) this.runsPage.reload();
      },
    );
  }
  load() {
    this.testsApi.test(this.id()).subscribe({
      next: (t) => this.test.set(t),
      error: (e) => this.act.msg.set({ ok: false, text: errText(e) }),
    });
    this.runsPage.reload();
  }
  save(b: TestCaseBody) {
    this.act.run(this.testsApi.updateTest(this.id(), b), {
      ok: () => 'Test updated. Existing frozen entries are unaffected.',
      then: () => {
        this.load();
        this.store.load();
      },
    });
  }
  remove() {
    this.act.run(this.testsApi.deleteTests([this.id()]), {
      then: () => {
        this.store.load();
        this.router.navigate(['/tests']);
      },
    });
  }
  /** Removes the recorded answer - only `model_output: null` is sent, so nothing else changes. */
  clearModelOutput() {
    this.act.run(this.testsApi.updateTest(this.id(), { model_output: null }), {
      ok: () => 'Recorded answer cleared. Runs now ask the application under test.',
      then: () => this.load(),
    });
  }
  run() {
    this.act.run(this.runsApi.runStandalone(this.id()), {
      ok: (r) => `Enqueued standalone run ${short(r.id)} - pending.`,
      then: () => this.load(),
    });
  }
}
