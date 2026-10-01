import { TypeTagsComponent } from '../shared/type-tags.component';
import { Component, inject, signal, computed } from '@angular/core';
import { ActionRunner } from '../shared/action-runner';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CatalogStore } from '../api/catalog.store';
import { TestsApiService } from '../api/tests-api.service';
import { TestCase, TestCaseBody } from '../api/models';
import { PagerComponent } from '../shared/pager.component';
import { Paged } from '../shared/paged';
import { TextFilter } from '../shared/text-filter';
import { errText, displayName } from '../shared/format';
import { TestFormDialogComponent } from '../shared/dialog/test-form-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';

import { Selection } from '../shared/selection';

@Component({
  selector: 'assay-tests-list',
  standalone: true,
  imports: [
    TypeTagsComponent,
    RouterLink,
    FormsModule,
    TestFormDialogComponent,
    ConfirmDialogComponent,
    PagerComponent,
  ],
  templateUrl: './tests-list.component.html',
  styleUrls: ['../shared/page.css'],
})
export class TestsListComponent {
  store = inject(CatalogStore);
  api = inject(TestsApiService);
  displayName = displayName;
  /** Checkbox bulk selection over the visible rows - see shared/selection.ts. */
  selection = new Selection(() => this.rows());
  dlg = signal<null | 'new' | 'delete'>(null);
  /** Busy flag, dialog error and page banner for this page's API actions - see shared/action-runner.ts. */
  act = new ActionRunner({
    inDialog: () => !!this.dlg(),
    done: () => {
      this.dlg.set(null);
      this.store.load();
      this.page.reload();
    },
  });
  page = new Paged<TestCase>((o, l) => this.api.testsPage(o, l), 25, errText);
  /** Name + input search - see shared/text-filter.ts. */
  filter = new TextFilter<TestCase>((t) => (t.name ?? '') + ' ' + t.input);
  rows = computed(() => this.filter.apply(this.page.items()));
  ngOnInit() {
    this.page.reload();
  }
  create(b: TestCaseBody) {
    this.act.run(this.api.createTest(b), { ok: (t) => `Created test “${t.name ?? t.id}”.` });
  }
  remove() {
    const ids = this.selection.ids();
    this.act.run(this.api.deleteTests(ids), {
      ok: () => `Deleted ${ids.length} test${ids.length === 1 ? '' : 's'}.`,
      then: () => this.selection.clear(),
    });
  }
}
