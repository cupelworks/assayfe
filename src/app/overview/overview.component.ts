import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { ActionRunner } from '../shared/action-runner';
import { RouterLink } from '@angular/router';
import {
  CatalogStore,
  RECENT_EXECUTIONS_LIMIT,
  RUN_STATUS_SAMPLE_LIMIT,
} from '../api/catalog.store';
import { TestsApiService } from '../api/tests-api.service';
import { TestCaseBody } from '../api/models';
import { countByStatus } from '../shared/format';
import { TestFormDialogComponent } from '../shared/dialog/test-form-dialog.component';
import { RelTimeComponent } from '../shared/rel-time.component';

@Component({
  selector: 'assay-overview',
  standalone: true,
  imports: [RouterLink, TestFormDialogComponent, RelTimeComponent],
  templateUrl: './overview.component.html',
  styleUrls: ['../shared/page.css', './overview.component.css'],
})
export class OverviewComponent implements OnInit {
  store = inject(CatalogStore);
  api = inject(TestsApiService);
  newTest = signal(false);
  /** Busy flag, dialog error and page banner for this page's API actions - see shared/action-runner.ts. */
  act = new ActionRunner({
    inDialog: () => this.newTest(),
    done: () => this.newTest.set(false),
  });
  statuses = computed(() => countByStatus(this.store.recentRuns()));
  bars = computed(() => {
    const t = this.store.recentRuns().length || 1;
    return this.statuses()
      .filter((s) => s.value)
      .map((s) => ({ color: s.color, pct: (s.value / t) * 100 + '%' }));
  });
  recentLimit = RECENT_EXECUTIONS_LIMIT;
  runStatusLimit = RUN_STATUS_SAMPLE_LIMIT;
  recent = computed(() => this.store.executions().slice(0, RECENT_EXECUTIONS_LIMIT));
  ngOnInit() {
    // Overview reads every CatalogStore field (stat tiles, executions, run status), and
    // nothing loads it automatically anymore - the shell doesn't touch CatalogStore at
    // all. Re-fires each time this page is (re)visited.
    this.store.load();
  }
  create(b: TestCaseBody) {
    this.act.run(this.api.createTest(b), {
      ok: (t) => `Created test “${t.name ?? t.id}”.`,
      then: () => this.store.load(),
    });
  }
}
