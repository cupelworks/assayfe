import { Component, inject, input, signal, computed, effect, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatasetsApiService } from '../api/datasets-api.service';
import { TestsApiService } from '../api/tests-api.service';
import { CatalogStore } from '../api/catalog.store';
import { DataSetMetadata, DataSetRow, DataSetRowSchema } from '../api/models';
import { rel, short, errText } from '../shared/format';
import { TestTypePickerComponent } from '../shared/test-type-picker.component';
import { DialogComponent } from '../shared/dialog/dialog.component';
import { NameDialogComponent } from '../shared/dialog/name-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { PagerComponent } from '../shared/pager.component';

type Dlg =
  null | 'rename' | 'delete' | 'addRows' | 'replace' | 'deleteRows' | 'toTests' | 'editRow';
const EMPTY: DataSetRowSchema = { prompt: '', expected_output: '', model_output: '' };

@Component({
  selector: 'assay-dataset-detail',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    DialogComponent,
    NameDialogComponent,
    ConfirmDialogComponent,
    PagerComponent,
    TestTypePickerComponent,
  ],
  templateUrl: './dataset-detail.component.html',
  styleUrls: ['../shared/page.css', './dataset-detail.component.css'],
})
export class DatasetDetailComponent {
  id = input.required<string>();
  datasetsApi = inject(DatasetsApiService);
  testsApi = inject(TestsApiService);
  store = inject(CatalogStore);
  router = inject(Router);
  rel = rel;
  short = short;
  meta = signal<DataSetMetadata | null>(null);
  rows = signal<DataSetRow[]>([]);
  total = signal(0);
  offset = signal(0);
  limit = signal(25);
  selected = signal<string[]>([]);
  dlg = signal<Dlg>(null);
  busy = signal(false);
  err = signal<string | null>(null);
  msg = signal<{ ok: boolean; text: string } | null>(null);
  jsonl = signal('');
  typeNames = signal<string[]>([]);
  editing = signal<DataSetRow | null>(null);
  draft = signal<DataSetRowSchema>({ ...EMPTY });
  name = computed(() => this.meta()?.name ?? short(this.id()));
  pageLabel = computed(() => (this.total() ? `${this.total()} rows` : '0 rows'));
  allChecked = computed(
    () => this.rows().length > 0 && this.rows().every((r) => this.selected().includes(r.id)),
  );
  parsedRows = computed<DataSetRowSchema[] | string>(() => {
    const lines = this.jsonl()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const out: DataSetRowSchema[] = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        const o = JSON.parse(lines[i]);
        if (
          typeof o.prompt !== 'string' ||
          typeof o.expected_output !== 'string' ||
          typeof o.model_output !== 'string'
        )
          return `Line ${i + 1}: needs string prompt, expected_output, model_output`;
        out.push({
          prompt: o.prompt,
          expected_output: o.expected_output,
          model_output: o.model_output,
        });
      } catch {
        return `Line ${i + 1}: invalid JSON`;
      }
    }
    return out;
  });
  parseError = computed(() =>
    typeof this.parsedRows() === 'string' ? (this.parsedRows() as string) : null,
  );
  parsedCount = computed(() =>
    Array.isArray(this.parsedRows()) ? (this.parsedRows() as DataSetRowSchema[]).length : 0,
  );

  constructor() {
    effect(() => {
      this.id();
      // untracked: load() reads this.offset()/this.limit() (this component's own pagination
      // signals, not a Paged instance, but the same hazard) - see scopes-list.component.ts's
      // identical comment. Without this, go()/size() writing those signals retriggered this
      // effect, which reset offset back to 0 - Next silently did nothing on this page.
      untracked(() => {
        this.offset.set(0);
        this.load();
      });
    });
  }
  load() {
    this.datasetsApi.dataset(this.id()).subscribe({
      next: (m) => this.meta.set(m),
      error: (e) => this.msg.set({ ok: false, text: errText(e) }),
    });
    this.datasetsApi.datasetRows(this.id(), this.offset(), this.limit()).subscribe({
      next: (p) => {
        this.rows.set(p.items);
        this.total.set(p.total);
        this.selected.set([]);
      },
      error: (e) => this.msg.set({ ok: false, text: errText(e) }),
    });
  }
  go(offset: number) {
    this.offset.set(offset);
    this.load();
  }
  size(limit: number) {
    this.limit.set(limit);
    this.offset.set(0);
    this.load();
  }
  toggle(id: string) {
    this.selected.update((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  toggleAll() {
    this.selected.set(this.allChecked() ? [] : this.rows().map((r) => r.id));
  }
  open(d: Dlg, row?: DataSetRow) {
    this.err.set(null);
    this.jsonl.set('');
    this.typeNames.set([]);
    if (row) {
      this.editing.set(row);
      this.draft.set({ ...row.row_info });
    }
    this.dlg.set(d);
  }
  setDraft<K extends keyof DataSetRowSchema>(k: K, v: string) {
    this.draft.update((d) => ({ ...d, [k]: v }));
  }

  private run<T>(req: { subscribe: Function }, ok: (r: T) => string, after?: () => void) {
    this.busy.set(true);
    this.err.set(null);
    req.subscribe({
      next: (r: T) => {
        this.busy.set(false);
        this.dlg.set(null);
        this.msg.set({ ok: true, text: ok(r) });
        this.load();
        this.store.load();
        after?.();
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.err.set(errText(e));
      },
    });
  }
  rename(n: string) {
    this.run(this.datasetsApi.renameDataset(this.id(), n), () => `Renamed to “${n}”.`);
  }
  remove() {
    this.run(
      this.datasetsApi.deleteDataset(this.id()),
      (r) => `Deleted dataset (${(r as any).deleted?.n ?? 0} rows).`,
      () => this.router.navigate(['/datasets']),
    );
  }
  addRows() {
    this.run(
      this.datasetsApi.addDatasetRows(this.id(), this.parsedRows() as DataSetRowSchema[]),
      (r) => `Added ${(r as any).loaded.n} rows.`,
    );
  }
  replaceRows() {
    this.run(
      this.datasetsApi.replaceDatasetRows(this.id(), this.parsedRows() as DataSetRowSchema[]),
      (r) => `Replaced all rows - ${(r as any).loaded.n} loaded.`,
    );
  }
  deleteRows() {
    const ids = this.selected();
    this.run(
      this.datasetsApi.deleteDatasetRows(ids),
      () =>
        `Deleted ${ids.length} row${ids.length === 1 ? '' : 's'}. Tests referencing them are unlinked, not deleted.`,
    );
  }
  saveRow() {
    const r = this.editing()!;
    this.run(
      this.datasetsApi.updateDatasetRows([{ id: r.id, row_info: this.draft() }]),
      () => 'Row updated.',
    );
  }
  toTests() {
    this.run(
      this.testsApi.createTestsFromDataset(this.id(), this.typeNames()),
      (r) => `Created ${(r as any).test_cases.length} tests from this dataset.`,
      () => this.router.navigate(['/tests']),
    );
  }
}
