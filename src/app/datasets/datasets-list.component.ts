// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogStore } from '../api/catalog.store';
import { DatasetsApiService } from '../api/datasets-api.service';
import { DataSetImportResult, DataSetMetadata, FacetCounts } from '../api/models';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { CATALOG, CatalogColumn, idColumn } from '../shared/catalog';
import { SmartFilterComponent } from '../shared/work/smart-filter.component';
import { FilterFacet, createdFacet, createdParams, yesNo } from '../shared/work/filters';
import { ApiList, countsWithCreated } from '../shared/work/api-list';
import { ImportDatasetDialogComponent } from './import-dataset-dialog.component';
import { ROW_KEY } from './row-keys';

/**
 * Datasets, on the Guide's layout: the title with Import beside it, what a row holds, the smart
 * filter, then each dataset with how many rows and its first prompt (as the list has them), and
 * how it gets in. The API searches (names and first prompts), filters and sorts it (API 2.0) -
 * `ApiList`.
 */
@Component({
  selector: 'assay-datasets-list',
  standalone: true,
  imports: [
    GuideHeadComponent,
    CATALOG,
    SmartFilterComponent,
    PagerComponent,
    RelTimeComponent,
    ImportDatasetDialogComponent,
  ],
  templateUrl: './datasets-list.component.html',
  styleUrls: [
    '../shared/guide/guide.css',
    '../shared/guide/head-aside.css',
    '../shared/work/work.css',
  ],
})
export class DatasetsListComponent {
  store = inject(CatalogStore);
  private api = inject(DatasetsApiService);
  private router = inject(Router);
  rowKey = ROW_KEY;

  /** The datasets as the API searches (names and first prompts), filters and sorts them. */
  list = new ApiList<DataSetMetadata, FacetCounts>({
    noun: 'dataset',
    sort: 'Newest',
    limit: 10,
    params: (c, q, sort) => ({
      q,
      made_into_tests: yesNo(c['used'], 'yes', 'no'),
      rows: c['rows'],
      ...createdParams(c['created']),
      sort: sort.toLowerCase(),
    }),
    fetch: (p, o, l) => this.api.datasets(o, l, p),
    counts: (p) => countsWithCreated((edges) => this.api.datasetFacets(p, edges)),
  });
  page = this.list.page;
  rows = this.page.items;
  sortOptions = ['Newest', 'Oldest', 'Name'];
  /** The facets, each value counted within the other filters chosen (the API's counts). */
  facets = computed<FilterFacet[]>(() => {
    const c = this.list.counts();
    const of = (facet: string, key: string) => (c ? (c[facet]?.[key] ?? 0) : null);
    return [
      {
        key: 'used',
        label: 'Made into tests',
        values: [
          { key: 'yes', label: 'Made into tests', count: of('made_into_tests', 'true') },
          { key: 'no', label: 'Not yet', count: of('made_into_tests', 'false') },
        ],
      },
      {
        key: 'rows',
        label: 'Rows',
        values: [
          { key: '1-10', label: '1 to 10', count: of('rows', '1-10') },
          { key: '11-100', label: '11 to 100', count: of('rows', '11-100') },
          { key: '101+', label: 'Over 100', count: of('rows', '101+') },
        ],
      },
      createdFacet(c?.['created']),
    ];
  });
  items = computed(() =>
    this.store.datasets().map((d) => ({ label: d.name, link: ['/datasets', d.id] })),
  );
  emptyText = computed(() => this.list.empty('No datasets yet. Import a .jsonl file to start.'));
  columns: CatalogColumn[] = [
    { label: 'Dataset', width: 3 },
    { label: 'Rows', width: 0.8 },
    { label: 'Its first prompt', width: 5 },
    { label: 'Created', width: 1.2 },
    idColumn(),
  ];

  dialog = signal(false);

  constructor() {
    this.store.loadDatasets();
  }

  /** A dataset came in (the import dialog uploads it): its page, with its rows. */
  imported(r: DataSetImportResult) {
    this.dialog.set(false);
    this.store.load();
    this.router.navigate(['/datasets', r.dataset.id]);
  }
}
