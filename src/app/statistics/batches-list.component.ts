import { Component, computed, inject, input } from '@angular/core';
import { CatalogStore } from '../api/catalog.store';
import { BatchFacets, BatchStatus, BatchSummary } from '../api/models';
import {
  BatchQuery,
  StatisticalTestsStore,
  StatisticsApiService,
} from '../api/statistics-api.service';
import { displayName, isInFlight } from '../shared/format';
import { markLabel } from '../shared/status-mark.component';
import { pollWhile, whenTabShown } from '../shared/poll';
import { ApiList } from '../shared/work/api-list';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { CATALOG, CatalogColumn, idColumn } from '../shared/catalog';
import { SmartFilterComponent } from '../shared/work/smart-filter.component';
import { KindNameComponent } from '../shared/work/kind-name.component';
import { FilterChoice, FilterFacet } from '../shared/work/filters';
import { Several, addressChoice, several } from '../shared/work/address-choice';
import { BatchVerdictComponent } from './batch-verdict.component';
import { BATCH_POLL_MS, scopeLink, scopePlace, timesFigure } from './stats-format';
import {
  BATCH_TILE_GROUPS,
  batchTiles,
  scopeFacets,
  scopeNames,
  scopeParams,
  verdictFacet,
} from './stats-lists';

/**
 * Batches, on the Guide's layout as the work's lists are: every
 * run with statistics, newest first. A tile per verdict - how it ended, then while it runs - each
 * with how many batches have it; the smart filter, by verdict, test, set or plan (typing finds
 * what to filter by: a batch has no words of its own); a ruled row per batch - its verdict (to its
 * page), what it tested, what it showed (the API's sentence, the note, "Run again ↗"), the question
 * it asked, how many times, when, its ID; the pager.
 *
 * The API does the work (API 2.1): the filters go to `GET /statistics/batches`, the tiles' and the
 * facets' counts come from `GET /statistics/batches/facets`, each within the other filters. The
 * verdicts chosen are in the address, so the Overview's tally rows open one. Polls every 3 seconds
 * while a batch shown is under way, and reads again when the tab comes back into view ("Run again
 * ↗" opens its own).
 */
@Component({
  selector: 'assay-batches-list',
  standalone: true,
  imports: [
    GuideHeadComponent,
    CATALOG,
    SmartFilterComponent,
    KindNameComponent,
    BatchVerdictComponent,
    PagerComponent,
    RelTimeComponent,
  ],
  templateUrl: './batches-list.component.html',
  styleUrls: ['../shared/guide/guide.css', '../shared/work/work.css'],
})
export class BatchesListComponent {
  /** ?status= - once per verdict - bound by withComponentInputBinding(); none: every batch. */
  status = input<Several<BatchStatus>>();
  private statuses = computed(() => several(this.status()));
  /** The choice, its verdicts as the address says, the other facets kept as chosen. */
  private addressed = addressChoice(
    computed(() => ({ status: this.statuses() })),
    { status: 'status' },
  );
  private api = inject(StatisticsApiService);
  private tests = inject(StatisticalTestsStore);
  private store = inject(CatalogStore);

  /** The batches as the API filters and counts them, newest first. */
  list = new ApiList<BatchSummary, BatchFacets, BatchQuery>({
    noun: 'batch',
    plural: 'batches',
    sort: 'Newest first',
    choice: this.addressed.choice,
    params: (c) => ({ status: c['status'], ...scopeParams(c) }),
    fetch: (p, o, l) => this.api.batchesPage(p, o, l),
    counts: (p) => this.api.batchFacets(p),
  });

  tiles = computed(() => batchTiles(this.list.counts()?.status ?? null));
  tileGroups = BATCH_TILE_GROUPS;
  /** The tile chosen: the one verdict, when only one is. */
  oneStatus = computed(() => (this.statuses().length === 1 ? this.statuses()[0] : null));
  facets = computed<FilterFacet[]>(() => [
    verdictFacet(this.list.counts()?.status ?? null),
    ...scopeFacets(
      this.list.counts(),
      this.list.choice(),
      scopeNames(
        this.store,
        this.list.page.items().map((b) => b.scope),
      ),
      'batches of each',
    ),
  ]);
  emptyText = computed(() =>
    this.list.empty(
      'No batches yet. Run a test, a test set or a test plan with statistics, and its batches show here.',
    ),
  );

  columns: CatalogColumn[] = [
    { label: 'Verdict', width: 1.3 },
    { label: 'Tested', width: 2.5 },
    { label: 'What it showed', width: 4 },
    { label: 'Question', width: 1.7 },
    { label: 'Times', width: 0.8 },
    { label: 'When', width: 1 },
    idColumn(),
  ];
  /** A row as the table shows it - all of it from the list. */
  view = computed(() =>
    this.list.page.items().map((b) => {
      const label = markLabel(b.status),
        name = displayName(b.scope.name, b.scope.id);
      return {
        b,
        label,
        kind: scopePlace(b.scope.kind).one,
        name,
        scopeLink: scopeLink(b.scope),
        question: this.tests.byId().get(b.statistical_test)?.name ?? b.statistical_test,
        times: timesFigure(b),
        linkLabel: `Open the batch: ${label}, ${name}`,
      };
    }),
  );

  constructor() {
    this.tests.load();
    this.store.loadTests();
    this.store.loadSets();
    this.store.loadPlans();
    pollWhile(
      () => this.list.page.items().some((b) => isInFlight(b.status)),
      () => {
        if (!this.list.page.loading()) this.list.refresh();
      },
      BATCH_POLL_MS,
    );
    // Run with statistics opens in its own tab: back here, the batch started there shows.
    whenTabShown(() => {
      if (!this.list.page.loading()) this.list.refresh();
    });
  }

  /** A tile: its verdict alone, or every one again. */
  pickTile(key: string | null) {
    this.choose({ ...this.list.choice(), status: key ? [key] : [] });
  }
  /** The smart filter's choice: its verdicts go to the address, and with the rest to the API. */
  choose(c: FilterChoice) {
    this.addressed.choose(c);
  }
}
