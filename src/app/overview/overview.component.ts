import { Component, inject, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogStore, RECENT_EXECUTIONS_LIMIT } from '../api/catalog.store';
import { TestsApiService } from '../api/tests-api.service';
import { TestCaseBody } from '../api/models';
import { rel, countByStatus, errText } from '../shared/format';
import { TestFormDialogComponent } from '../shared/dialog/test-form-dialog.component';

@Component({
  selector: 'assay-overview',
  standalone: true,
  imports: [RouterLink, TestFormDialogComponent],
  templateUrl: './overview.component.html',
  styleUrls: ['../shared/page.css', './overview.component.css'],
})
export class OverviewComponent {
  store = inject(CatalogStore);
  api = inject(TestsApiService);
  rel = rel;
  newTest = signal(false);
  busy = signal(false);
  err = signal<string | null>(null);
  msg = signal<string | null>(null);
  statuses = computed(() => countByStatus(this.store.recentRuns()));
  bars = computed(() => {
    const t = this.store.recentRuns().length || 1;
    return this.statuses()
      .filter((s) => s.value)
      .map((s) => ({ color: s.color, pct: (s.value / t) * 100 + '%' }));
  });
  recentLimit = RECENT_EXECUTIONS_LIMIT;
  recent = computed(() => this.store.executions().slice(0, RECENT_EXECUTIONS_LIMIT));
  create(b: TestCaseBody) {
    this.busy.set(true);
    this.err.set(null);
    this.api.createTest(b).subscribe({
      next: (t) => {
        this.busy.set(false);
        this.newTest.set(false);
        this.msg.set(`Created test “${t.name ?? t.id}”.`);
        this.store.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.err.set(errText(e));
      },
    });
  }
}
