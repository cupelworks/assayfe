import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogStore } from '../api/catalog.store';
import { DatasetsApiService } from '../api/datasets-api.service';
import { DataSetMetadata } from '../api/models';
import { ActionRunner } from '../shared/action-runner';
import { Paged } from '../shared/paged';
import { TextFilter } from '../shared/text-filter';
import { counted, errText } from '../shared/format';
import { filterMissText } from '../shared/filter-miss';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { CATALOG, CatalogColumn, idColumn } from '../shared/catalog';
import { SmartFilterComponent } from '../shared/work/smart-filter.component';
import { FilterChoice, FilterFacet, createdFacet } from '../shared/work/filters';
import { BannerComponent } from '../shared/work/banner.component';
import { ImportDatasetDialogComponent } from './import-dataset-dialog.component';
import { ROW_KEY } from './row-keys';

/**
 * Datasets, on the Guide's layout: the title with Import beside it, what a row holds, the smart
 * filter, then each dataset with how many rows and its first prompt (as the list has them), and
 * how it gets in. As on the other lists, only the page's words narrow it.
 */
@Component({
  selector: 'assay-datasets-list',
  standalone: true,
  imports: [
    GuideHeadComponent,
    CATALOG,
    SmartFilterComponent,
    BannerComponent,
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

  page = new Paged<DataSetMetadata>((o, l) => this.api.datasets(o, l), 10, errText);
  filter = new TextFilter<DataSetMetadata>((d) => `${d.name} ${d.first_prompt ?? ''}`);
  sort = signal('Newest');
  sortOptions = ['Newest', 'Oldest', 'Name'];
  rows = computed(() => {
    const rows = [...this.filter.apply(this.page.items())];
    const sort = this.sort();
    if (sort === 'Name') return rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows.sort(
      (a, b) => (a.created_at < b.created_at ? 1 : -1) * (sort === 'Oldest' ? -1 : 1),
    );
  });
  choice = signal<FilterChoice>({});
  facets = computed<FilterFacet[]>(() => [
    {
      key: 'used',
      label: 'Made into tests',
      values: [
        { key: 'yes', label: 'Made into tests' },
        { key: 'no', label: 'Not yet' },
      ],
    },
    {
      key: 'rows',
      label: 'Rows',
      values: [
        { key: 'few', label: '1 to 10' },
        { key: 'some', label: '11 to 100' },
        { key: 'many', label: 'Over 100' },
      ],
    },
    createdFacet(this.store.datasets().map((d) => d.created_at)),
  ]);
  items = computed(() =>
    this.store.datasets().map((d) => ({ label: d.name, link: ['/datasets', d.id] })),
  );
  shownText = computed(() =>
    this.filter.terms().length
      ? `${this.rows().length} of ${this.page.items().length} on this page`
      : counted(this.page.total(), 'dataset'),
  );
  emptyText = computed(() => {
    if (this.page.loading()) return null;
    if (this.filter.terms().length)
      return filterMissText('dataset', this.filter.text(), this.page.total() > this.page.limit());
    return this.page.total() ? null : 'No datasets yet. Import a .jsonl file to start.';
  });
  columns: CatalogColumn[] = [
    { label: 'Dataset', width: 3 },
    { label: 'Rows', width: 0.8 },
    { label: 'Its first prompt', width: 5 },
    { label: 'Created', width: 1.2 },
    idColumn(),
  ];

  dialog = signal(false);
  act = new ActionRunner({ inDialog: () => this.dialog(), done: () => this.dialog.set(false) });

  constructor() {
    this.page.reload();
    this.store.loadDatasets();
  }

  import(d: { name: string; path: string }) {
    this.act.run(this.api.createDatasetFromPath(d.path, d.name), {
      ok: (r) => `Imported ${counted(r.loaded.n, 'row')} into “${r.dataset.name}”.`,
      then: (r) => {
        this.store.load();
        this.router.navigate(['/datasets', r.dataset.id]);
      },
    });
  }
}
