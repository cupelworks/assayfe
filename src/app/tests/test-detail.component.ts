import { Component, inject, input, signal, computed, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TestsApiService } from '../api/tests-api.service';
import { RunsApiService } from '../api/runs-api.service';
import { CatalogStore } from '../api/catalog.store';
import { StandaloneRun, TestCase, TestCaseBody } from '../api/models';
import { rel, short, errText, statusColor } from '../shared/format';
import { TestFormDialogComponent } from '../shared/dialog/test-form-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { Paged } from '../shared/paged';
import { PagerComponent } from '../shared/pager.component';

@Component({
  selector: 'assay-test-detail',
  standalone: true,
  imports: [RouterLink, TestFormDialogComponent, ConfirmDialogComponent, PagerComponent],
  templateUrl: './test-detail.component.html',
  styleUrls: ['../shared/page.css'],
})
export class TestDetailComponent {
  id = input.required<string>();
  testsApi = inject(TestsApiService);
  runsApi = inject(RunsApiService);
  store = inject(CatalogStore);
  router = inject(Router);
  rel = rel;
  short = short;
  statusColor = statusColor;
  test = signal<TestCase | null>(null);
  runsPage = new Paged<StandaloneRun>(
    (o, l) => this.runsApi.standaloneRunsPage(this.id(), o, l),
    10,
    errText,
  );
  runs = this.runsPage.items;
  dlg = signal<null | 'edit' | 'delete'>(null);
  busy = signal(false);
  err = signal<string | null>(null);
  msg = signal<{ ok: boolean; text: string } | null>(null);
  name = computed(() => this.test()?.name || 'Untitled · ' + short(this.id()));
  fields = computed(() => {
    const t = this.test();
    return t
      ? ([
          ['Input', t.input],
          ['Expected output', t.expected_output],
          ['Model output', t.model_output],
        ].filter((f) => f[1]) as [string, string][])
      : [];
  });
  canRun = computed(() => !!this.test()?.test_type_names?.length);
  constructor() {
    effect(() => {
      this.id();
      this.load();
    });
  }
  load() {
    this.testsApi.test(this.id()).subscribe({
      next: (t) => this.test.set(t),
      error: (e) => this.msg.set({ ok: false, text: errText(e) }),
    });
    this.runsPage.reload();
  }
  save(b: TestCaseBody) {
    this.busy.set(true);
    this.err.set(null);
    this.testsApi.updateTest(this.id(), b).subscribe({
      next: () => {
        this.busy.set(false);
        this.dlg.set(null);
        this.msg.set({ ok: true, text: 'Test updated. Existing frozen entries are unaffected.' });
        this.load();
        this.store.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.err.set(errText(e));
      },
    });
  }
  remove() {
    this.busy.set(true);
    this.err.set(null);
    this.testsApi.deleteTests([this.id()]).subscribe({
      next: () => {
        this.busy.set(false);
        this.store.load();
        this.router.navigate(['/tests']);
      },
      error: (e) => {
        this.busy.set(false);
        this.err.set(errText(e));
      },
    });
  }
  run() {
    this.busy.set(true);
    this.msg.set(null);
    this.runsApi.runStandalone(this.id()).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.msg.set({ ok: true, text: `Enqueued standalone run ${short(r.id)} - pending.` });
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.msg.set({ ok: false, text: errText(e) });
      },
    });
  }
}
