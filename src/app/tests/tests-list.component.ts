import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CatalogStore } from '../api/catalog.store';
import { AssayApiService } from '../api/assay-api.service';
import { TestCase, TestCaseBody } from '../api/models';
import { PagerComponent } from '../shared/pager.component';
import { Paged } from '../shared/paged';
import { errText } from '../shared/format';
import { TestFormDialogComponent } from '../shared/dialog/test-form-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';

@Component({ selector: 'assay-tests-list', standalone: true, imports: [RouterLink, FormsModule, TestFormDialogComponent, ConfirmDialogComponent, PagerComponent], templateUrl: './tests-list.component.html', styleUrls: ['../shared/page.css'] })
export class TestsListComponent {
  store = inject(CatalogStore); api = inject(AssayApiService);
  filter = signal(''); selected = signal<string[]>([]); dlg = signal<null | 'new' | 'delete'>(null); busy = signal(false); err = signal<string | null>(null); msg = signal<{ ok: boolean; text: string } | null>(null);
  page = new Paged<TestCase>((o, l) => this.api.testsPage(o, l), 25, errText);
  rows = computed(() => { const f = this.filter().toLowerCase(); return this.page.items().filter(t => !f || ((t.name ?? '') + ' ' + t.input).toLowerCase().includes(f)); });
  ngOnInit() { this.page.reload(); }
  allChecked = computed(() => this.rows().length > 0 && this.rows().every(r => this.selected().includes(r.id)));
  toggle(id: string) { this.selected.update(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); }
  toggleAll() { this.selected.set(this.allChecked() ? [] : this.rows().map(r => r.id)); }
  create(b: TestCaseBody) {
    this.busy.set(true); this.err.set(null);
    this.api.createTest(b).subscribe({ next: t => { this.busy.set(false); this.dlg.set(null); this.msg.set({ ok: true, text: `Created test “${t.name ?? t.id}”.` }); this.store.load(); this.page.reload(); }, error: e => { this.busy.set(false); this.err.set(errText(e)); } });
  }
  remove() {
    const ids = this.selected(); this.busy.set(true); this.err.set(null);
    this.api.deleteTests(ids).subscribe({ next: () => { this.busy.set(false); this.dlg.set(null); this.selected.set([]); this.msg.set({ ok: true, text: `Deleted ${ids.length} test${ids.length === 1 ? '' : 's'}.` }); this.store.load(); this.page.reload(); }, error: e => { this.busy.set(false); this.err.set(errText(e)); } });
  }
}
