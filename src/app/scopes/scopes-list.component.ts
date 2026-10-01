import { FilterMissComponent } from '../shared/filter-miss.component';
import { Component, inject, input, signal, computed, effect, untracked } from '@angular/core';
import { ActionRunner } from '../shared/action-runner';
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
import { TextFilter } from '../shared/text-filter';
import { errText } from '../shared/format';
import { NameDialogComponent } from '../shared/dialog/name-dialog.component';

@Component({
  selector: 'assay-scopes-list',
  standalone: true,
  imports: [
    FilterMissComponent,
    RouterLink,
    FormsModule,
    NameDialogComponent,
    PagerComponent,
    RelTimeComponent,
  ],
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
  dlg = signal(false);
  /** Busy flag, dialog error and page banner for this page's API actions - see shared/action-runner.ts. */
  act = new ActionRunner({
    inDialog: () => this.dlg(),
    done: () => this.dlg.set(false),
  });
  isSet = computed(() => this.kind() === 'test-sets');
  title = computed(() => (this.isSet() ? 'Test sets' : 'Test plans'));
  noun = computed(() => (this.isSet() ? 'test set' : 'test plan'));
  single = computed(() => (this.isSet() ? 'test set' : 'test plan'));
  /** "Entries" (test sets) vs "Linked sets" (test plans) - the two kinds count a different
   *  thing, so the column header has to say which. */
  containedLabel = computed(() => (this.isSet() ? 'Entries' : 'Linked sets'));
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
  /** Name search - see shared/text-filter.ts. */
  filter = new TextFilter<ScopeMetadata>((s) => s.name);
  /** Created-column sort - see shared/date-sort.ts. */
  sort = new DateSort<ScopeMetadata>((s) => s.created_at);
  rows = computed(() => {
    const counts = this.execCounts();
    const isSet = this.isSet();
    const filtered = this.sort.apply(this.filter.apply(this.page.items()));
    return filtered.map((s) => ({
      ...s,
      execs: counts[s.id] ?? '…',
      // Already on the list response - entry_count/linked_set_count ride along with data
      // already fetched, no per-row request needed (unlike execs above).
      contained: (isSet ? s.entry_count : s.linked_set_count) ?? 0,
    }));
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
    this.act.run(
      this.isSet() ? this.testSetsApi.createTestSet(name) : this.testPlansApi.createTestPlan(name),
      {
        then: (x) => {
          this.store.load();
          this.router.navigate(['/', this.kind(), x.id]);
        },
      },
    );
  }
}
