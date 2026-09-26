import { Component, inject, input, signal, computed, effect, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, map } from 'rxjs';
import { CatalogStore } from '../api/catalog.store';
import { TestSetsApiService } from '../api/test-sets-api.service';
import { TestPlansApiService } from '../api/test-plans-api.service';
import { RunsApiService } from '../api/runs-api.service';
import { Kind, ScopeMetadata } from '../api/models';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { Paged } from '../shared/paged';
import { DateSort } from '../shared/date-sort';
import { errText } from '../shared/format';
import { NameDialogComponent } from '../shared/dialog/name-dialog.component';

@Component({
  selector: 'assay-scopes-list',
  standalone: true,
  imports: [RouterLink, FormsModule, NameDialogComponent, PagerComponent, RelTimeComponent],
  templateUrl: './scopes-list.component.html',
  styleUrls: ['../shared/page.css'],
})
export class ScopesListComponent {
  kind = input.required<Kind>();
  store = inject(CatalogStore);
  testSetsApi = inject(TestSetsApiService);
  testPlansApi = inject(TestPlansApiService);
  runsApi = inject(RunsApiService);
  router = inject(Router);
  filter = signal('');
  dlg = signal(false);
  busy = signal(false);
  err = signal<string | null>(null);
  isSet = computed(() => this.kind() === 'test-sets');
  title = computed(() => (this.isSet() ? 'Test sets' : 'Test plans'));
  single = computed(() => (this.isSet() ? 'test set' : 'test plan'));
  page = new Paged<ScopeMetadata>(
    (o, l) => (this.isSet() ? this.testSetsApi.testSets(o, l) : this.testPlansApi.testPlans(o, l)),
    25,
    errText,
  );
  /** Each row's true execution count, one zero-row fetch per row (limit=0 - the API returns
   *  items: [] plus the real `total`, so nothing but the count itself is ever transferred)
   *  against the scoped endpoint - the same "fetch just for the total" pattern
   *  TestPlanDetailComponent's entryCounts uses. Deliberately not the global executions sample
   *  (CatalogStore.executions): that's capped and recency-biased, so it can't give an accurate
   *  count for an arbitrary row on an arbitrary page - this always reads the true total. */
  execCounts = signal<Record<string, number>>({});
  /** Created-column sort - see shared/date-sort.ts. */
  sort = new DateSort<ScopeMetadata>((s) => s.created_at);
  rows = computed(() => {
    const f = this.filter().toLowerCase();
    const counts = this.execCounts();
    const filtered = this.page.items().filter((s) => !f || s.name.toLowerCase().includes(f));
    return this.sort.apply(filtered).map((s) => ({ ...s, execs: counts[s.id] ?? '…' }));
  });
  constructor() {
    effect(() => {
      this.kind();
      // untracked: page.reset() -> reload() reads page's own offset()/limit() signals - left
      // untracked so this effect doesn't also fire every time the pager changes them (it did;
      // that's what caused the duplicate-fetch / Next-gets-silently-reset bug).
      untracked(() => this.page.reset());
    });
    effect(() => {
      const items = this.page.items();
      const k = this.kind();
      if (!items.length) {
        this.execCounts.set({});
        return;
      }
      forkJoin(
        items.map((s) =>
          this.runsApi
            .executionsPage(k, s.id, 0, 0)
            .pipe(map((p) => [s.id, p.total] as [string, number])),
        ),
      ).subscribe((pairs) => this.execCounts.set(Object.fromEntries(pairs)));
    });
  }
  create(name: string) {
    this.busy.set(true);
    this.err.set(null);
    (this.isSet()
      ? this.testSetsApi.createTestSet(name)
      : this.testPlansApi.createTestPlan(name)
    ).subscribe({
      next: (x) => {
        this.busy.set(false);
        this.dlg.set(false);
        this.store.load();
        this.router.navigate(['/', this.kind(), x.id]);
      },
      error: (e) => {
        this.busy.set(false);
        this.err.set(errText(e));
      },
    });
  }
}
