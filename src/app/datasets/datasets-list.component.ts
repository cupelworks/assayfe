import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CatalogStore } from '../api/catalog.store';
import { DatasetsApiService } from '../api/datasets-api.service';
import { errText } from '../shared/format';
import { DialogComponent } from '../shared/dialog/dialog.component';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { Paged } from '../shared/paged';
import { DateSort } from '../shared/date-sort';
import { TextFilter } from '../shared/text-filter';
import { DataSetMetadata } from '../api/models';

@Component({
  selector: 'assay-datasets-list',
  standalone: true,
  imports: [RouterLink, FormsModule, DialogComponent, PagerComponent, RelTimeComponent],
  templateUrl: './datasets-list.component.html',
  styleUrls: ['../shared/page.css'],
})
export class DatasetsListComponent {
  store = inject(CatalogStore);
  api = inject(DatasetsApiService);
  router = inject(Router);
  dialog = signal(false);
  busy = signal(false);
  err = signal<string | null>(null);
  msg = signal<string | null>(null);
  path = signal('');
  name = signal('');
  page = new Paged<DataSetMetadata>((o, l) => this.api.datasets(o, l), 25, errText);
  /** Name search - see shared/text-filter.ts. */
  filter = new TextFilter<DataSetMetadata>((d) => d.name);
  /** Created-column sort - see shared/date-sort.ts. */
  sort = new DateSort<DataSetMetadata>((d) => d.created_at);
  rows = computed(() => this.sort.apply(this.filter.apply(this.page.items())));
  ngOnInit() {
    this.page.reload();
  }
  import() {
    this.busy.set(true);
    this.err.set(null);
    this.api.createDatasetFromPath(this.path().trim(), this.name().trim()).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.dialog.set(false);
        this.msg.set(`Imported ${r.loaded.n} rows into “${r.dataset.name}”.`);
        this.store.load();
        this.page.reload();
        this.router.navigate(['/datasets', r.dataset.id]);
      },
      error: (e) => {
        this.busy.set(false);
        this.err.set(errText(e));
      },
    });
  }
}
