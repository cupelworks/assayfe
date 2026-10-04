import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogStore } from '../api/catalog.store';
import { ComparisonFacets, ComparisonOutcome, ComparisonSummary } from '../api/models';
import {
  ComparisonQuery,
  StatisticalTestsStore,
  StatisticsApiService,
} from '../api/statistics-api.service';
import { counted, displayName } from '../shared/format';
import { StatusMarkComponent, markLabel } from '../shared/status-mark.component';
import { whenTabShown } from '../shared/poll';
import { ApiList } from '../shared/work/api-list';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { CATALOG, CatalogColumn, idColumn } from '../shared/catalog';
import { SmartFilterComponent } from '../shared/work/smart-filter.component';
import { KindNameComponent } from '../shared/work/kind-name.component';
import { FilterChoice, FilterFacet } from '../shared/work/filters';
import { Several, addressChoice, several } from '../shared/work/address-choice';
import { scopeLink, scopePlace } from './stats-format';
import {
  OUTCOME_TILE_GROUPS,
  outcomeFacet,
  outcomeLabel,
  outcomeTiles,
  scopeFacets,
  scopeNames,
  scopeParams,
} from './stats-lists';

/**
 * Comparisons, on the Guide's layout as the work's lists are:
 * every comparison of two batches of the same test, set or plan, newest first. A tile per outcome,
 * each with how many comparisons showed it; the smart filter, by outcome, test, set or plan
 * (typing finds what to filter by); a ruled row per comparison - what it showed (to its page),
 * what it compared, the answer (the API's sentence, the note), the question it asked, the two
 * batches (A, before; B, after - each to its page), when, its ID; the pager.
 *
 * The API does the work (API 2.1): the filters go to `GET /statistics/comparisons`, the tiles'
 * and the facets' counts come from `GET /statistics/comparisons/facets`, each within the other
 * filters. The outcomes chosen are in the address. A comparison never changes once made, so
 * nothing polls; the page reads again when its tab comes back into view.
 */
@Component({
  selector: 'assay-comparisons-list',
  standalone: true,
  imports: [
    RouterLink,
    GuideHeadComponent,
    CATALOG,
    SmartFilterComponent,
    KindNameComponent,
    StatusMarkComponent,
    PagerComponent,
    RelTimeComponent,
  ],
  templateUrl: './comparisons-list.component.html',
  styleUrls: [
    '../shared/guide/guide.css',
    '../shared/work/work.css',
    './verdict.css',
    './comparisons-list.component.css',
  ],
})
export class ComparisonsListComponent {
  /** ?outcome= - once per outcome - bound by withComponentInputBinding(); none: every one. */
  outcome = input<Several<ComparisonOutcome>>();
  private outcomes = computed(() => several(this.outcome()));
  /** The choice, its outcomes as the address says, the other facets kept as chosen. */
  private addressed = addressChoice(
    computed(() => ({ outcome: this.outcomes() })),
    { outcome: 'outcome' },
  );
  private api = inject(StatisticsApiService);
  private tests = inject(StatisticalTestsStore);
  private store = inject(CatalogStore);

  /** The comparisons as the API filters and counts them, newest first. */
  list = new ApiList<ComparisonSummary, ComparisonFacets, ComparisonQuery>({
    noun: 'comparison',
    sort: 'Newest first',
    choice: this.addressed.choice,
    params: (c) => ({ outcome: c['outcome'], ...scopeParams(c) }),
    fetch: (p, o, l) => this.api.comparisonsPage(p, o, l),
    counts: (p) => this.api.comparisonFacets(p),
  });

  tiles = computed(() => outcomeTiles(this.list.counts()?.outcome ?? null));
  tileGroups = OUTCOME_TILE_GROUPS;
  /** The tile chosen: the one outcome, when only one is. */
  oneOutcome = computed(() => (this.outcomes().length === 1 ? this.outcomes()[0] : null));
  facets = computed<FilterFacet[]>(() => [
    outcomeFacet(this.list.counts()?.outcome ?? null),
    ...scopeFacets(
      this.list.counts(),
      this.list.choice(),
      scopeNames(
        this.store,
        this.list.page.items().map((c) => c.scope),
      ),
      'comparisons of each',
    ),
  ]);
  emptyText = computed(() =>
    this.list.empty(
      'No comparisons yet. On a batch’s page, compare it with another batch of the same test, set or plan.',
    ),
  );

  columns: CatalogColumn[] = [
    { label: 'What it showed', width: 1.5 },
    { label: 'Compared', width: 2.3 },
    { label: 'The answer', width: 3.3 },
    { label: 'Question', width: 1.6 },
    { label: 'The two batches', width: 2.5 },
    { label: 'When', width: 1 },
    idColumn(),
  ];
  /** A row as the table shows it - all of it from the list. */
  view = computed(() =>
    this.list.page.items().map((c) => {
      const label = outcomeLabel(c.outcome),
        name = displayName(c.scope.name, c.scope.id);
      const side = (ab: 'A' | 'B', b: ComparisonSummary['batch_a'], when: string) => ({
        ab,
        b,
        word: markLabel(b.status),
        times: counted(b.times_requested, 'time'),
        aria: `Batch ${ab}, ${when}: ${markLabel(b.status)}, ${counted(b.times_requested, 'time')}`,
      });
      return {
        c,
        label,
        kind: scopePlace(c.scope.kind).one,
        name,
        scopeLink: scopeLink(c.scope),
        question: this.tests.byId().get(c.statistical_test)?.name ?? c.statistical_test,
        sides: [side('A', c.batch_a, 'before'), side('B', c.batch_b, 'after')],
        linkLabel: `Open the comparison: ${label}, ${name}`,
      };
    }),
  );

  constructor() {
    this.tests.load();
    this.store.loadTests();
    this.store.loadSets();
    this.store.loadPlans();
    // A comparison is made on a batch's page, maybe in another tab: back here, it shows.
    whenTabShown(() => {
      if (!this.list.page.loading()) this.list.refresh();
    });
  }

  /** A tile: its outcome alone, or every one again. */
  pickTile(key: string | null) {
    this.choose({ ...this.list.choice(), outcome: key ? [key] : [] });
  }
  /** The smart filter's choice: its outcomes go to the address, and with the rest to the API. */
  choose(c: FilterChoice) {
    this.addressed.choose(c);
  }
}
