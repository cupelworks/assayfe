import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CatalogStore } from '../api/catalog.store';
import { DatasetsApiService } from '../api/datasets-api.service';
import { rel, errText } from '../shared/format';
import { DialogComponent } from '../shared/dialog/dialog.component';
import { PagerComponent } from '../shared/pager.component';
import { Paged } from '../shared/paged';
import { DataSetMetadata } from '../api/models';

@Component({
  selector: 'assay-datasets-list',
  standalone: true,
  imports: [RouterLink, FormsModule, DialogComponent, PagerComponent],
  templateUrl: './datasets-list.component.html',
  styleUrls: ['../shared/page.css'],
})
export class DatasetsListComponent {
  store = inject(CatalogStore);
  api = inject(DatasetsApiService);
  router = inject(Router);
  rel = rel;
  filter = signal('');
  dialog = signal(false);
  busy = signal(false);
  err = signal<string | null>(null);
  msg = signal<string | null>(null);
  path = signal('');
  name = signal('');
  page = new Paged<DataSetMetadata>((o, l) => this.api.datasets(o, l), 25, errText);
  rows = computed(() => {
    const f = this.filter().toLowerCase();
    return this.page.items().filter((d) => !f || d.name.toLowerCase().includes(f));
  });
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
