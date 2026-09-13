import { Component, inject, input, signal, computed, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CatalogStore } from '../api/catalog.store';
import { AssayApiService } from '../api/assay-api.service';
import { Kind, ScopeMetadata } from '../api/models';
import { PagerComponent } from '../shared/pager.component';
import { Paged } from '../shared/paged';
import { rel, errText } from '../shared/format';
import { NameDialogComponent } from '../shared/dialog/name-dialog.component';

@Component({
  selector: 'assay-scopes-list',
  standalone: true,
  imports: [RouterLink, FormsModule, NameDialogComponent, PagerComponent],
  templateUrl: './scopes-list.component.html',
  styleUrls: ['../shared/page.css'],
})
export class ScopesListComponent {
  kind = input.required<Kind>();
  store = inject(CatalogStore);
  api = inject(AssayApiService);
  router = inject(Router);
  rel = rel;
  filter = signal('');
  dlg = signal(false);
  busy = signal(false);
  err = signal<string | null>(null);
  isSet = computed(() => this.kind() === 'test-sets');
  title = computed(() => (this.isSet() ? 'Test sets' : 'Test plans'));
  single = computed(() => (this.isSet() ? 'test set' : 'test plan'));
  page = new Paged<ScopeMetadata>(
    (o, l) => (this.isSet() ? this.api.testSets(o, l) : this.api.testPlans(o, l)),
    25,
    errText,
  );
  rows = computed(() => {
    const f = this.filter().toLowerCase();
    return this.page
      .items()
      .filter((s) => !f || s.name.toLowerCase().includes(f))
      .map((s) => ({ ...s, execs: this.store.byParent(this.kind(), s.id).length }));
  });
  constructor() {
    effect(() => {
      this.kind();
      this.page.reset();
    });
  }
  create(name: string) {
    this.busy.set(true);
    this.err.set(null);
    (this.isSet() ? this.api.createTestSet(name) : this.api.createTestPlan(name)).subscribe({
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
