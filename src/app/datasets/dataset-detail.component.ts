import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatasetsApiService } from '../api/datasets-api.service';
import { TestsApiService } from '../api/tests-api.service';
import { CatalogStore } from '../api/catalog.store';
import { DataSetMetadata, DataSetRow, DataSetRowSchema, TestTypeAssignment } from '../api/models';
import { ActionRunner } from '../shared/action-runner';
import { Selection } from '../shared/selection';
import { TextFilter } from '../shared/text-filter';
import { counted, errText, short, shortDate } from '../shared/format';
import { PagerComponent } from '../shared/pager.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { numbered } from '../shared/guide/guide-sections';
import { CATALOG, CatalogColumn, idColumn } from '../shared/catalog';
import { SmartFilterComponent } from '../shared/work/smart-filter.component';
import { QuietAction, QuietActionsComponent } from '../shared/work/quiet-actions.component';
import { BulkAction, BulkBarComponent } from '../shared/work/bulk-bar.component';
import { BannerComponent } from '../shared/work/banner.component';
import { NamedListComponent } from '../shared/work/named-list.component';
import { inWords } from '../shared/work/sentences';
import { NameDialogComponent } from '../shared/dialog/name-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { RowsDialogComponent } from './rows-dialog.component';
import { EditRowDialogComponent } from './edit-row-dialog.component';
import { MakeTestsDialogComponent, NumberedRow } from './make-tests-dialog.component';
import { ROW_KEY } from './row-keys';

type Dlg =
  null | 'rename' | 'delete' | 'addRows' | 'replace' | 'deleteRows' | 'toTests' | 'editRow';

/**
 * A dataset's page, on the Guide's layout. Its top: the way back, its name, "Make tests from
 * rows" and the quiet rest (Add rows · Replace rows · Rename · Delete), a lede and what a row
 * holds. Then 01 its rows - found by their words on the page shown, ticked to make tests from or
 * to delete - and 02 the tests made from it, which the API can't say yet.
 */
@Component({
  selector: 'assay-dataset-detail',
  standalone: true,
  imports: [
    RouterLink,
    GuideHeadComponent,
    GuideSectionComponent,
    CATALOG,
    SmartFilterComponent,
    QuietActionsComponent,
    BulkBarComponent,
    BannerComponent,
    NamedListComponent,
    PagerComponent,
    NameDialogComponent,
    ConfirmDialogComponent,
    RowsDialogComponent,
    EditRowDialogComponent,
    MakeTestsDialogComponent,
  ],
  templateUrl: './dataset-detail.component.html',
  styleUrls: [
    '../shared/guide/guide.css',
    '../shared/guide/head-aside.css',
    '../shared/work/work.css',
  ],
})
export class DatasetDetailComponent {
  id = input.required<string>();
  private datasetsApi = inject(DatasetsApiService);
  private testsApi = inject(TestsApiService);
  private store = inject(CatalogStore);
  private router = inject(Router);
  rowKey = ROW_KEY;
  sections = numbered('dataset-', ['Rows', 'Tests made from it']);

  meta = signal<DataSetMetadata | null>(null);
  name = computed(() => this.meta()?.name ?? short(this.id()));
  rows = signal<DataSetRow[]>([]);
  total = signal(0);
  offset = signal(0);
  limit = signal(25);
  loading = signal(true);
  filter = new TextFilter<DataSetRow>(
    (r) => `${r.row_info.prompt} ${r.row_info.expected_output} ${r.row_info.model_output}`,
  );
  /** The page's rows, numbered in the dataset, that the words leave. */
  shown = computed<NumberedRow[]>(() => {
    const kept = new Set(this.filter.apply(this.rows()).map((r) => r.id));
    return this.rows()
      .map((row, i) => ({ no: this.offset() + i + 1, row }))
      .filter((r) => kept.has(r.row.id));
  });
  selection = new Selection(() => this.shown().map((r) => r.row));
  editing = signal<NumberedRow | null>(null);

  lede = computed(() => {
    const n = this.total();
    const when = this.meta() ? ` Imported ${shortDate(this.meta()!.created_at)}.` : '';
    if (!n) return `No rows yet: add some, to make tests from.${when}`;
    const many =
      n === 1 ? 'One question' : `${inWords(n).replace(/^./, (c) => c.toUpperCase())} questions`;
    return `${many} with the answers they should get, to make tests from.${when}`;
  });
  quiet: QuietAction[] = [
    { key: 'addRows', label: 'Add rows' },
    { key: 'replace', label: 'Replace rows' },
    { key: 'rename', label: 'Rename' },
    { key: 'delete', label: 'Delete' },
  ];
  shownText = computed(() =>
    this.filter.terms().length
      ? `${this.shown().length} of ${this.rows().length} on this page`
      : counted(this.total(), 'row'),
  );
  columns: CatalogColumn[] = [
    { label: 'Prompt', width: 3 },
    { label: 'Expected output', width: 3 },
    { label: 'Model output', width: 3 },
    idColumn(),
    { label: '', width: 0.6 },
  ];
  rowsEmpty = computed(() => {
    if (this.loading()) return null;
    if (this.filter.terms().length && !this.shown().length)
      return `No row on this page has "${this.filter.text()}".`;
    return this.total() ? null : 'No rows yet - Add rows pastes them in.';
  });
  madeColumns: CatalogColumn[] = [
    { label: 'Test', width: 3.4 },
    { label: 'From row', width: 1 },
    { label: 'Latest verdict', width: 2.4 },
    { label: 'Latest run', width: 2 },
    idColumn(),
  ];

  /** The ticked rows, numbered - what "Make tests from N rows…" and "Delete…" act on. */
  ticked = computed(() => this.shown().filter((r) => this.selection.has(r.row.id)));
  tickedNames = computed(() =>
    this.ticked().map((r) => ({ name: r.row.row_info.prompt, note: `row ${r.no}` })),
  );
  bulkActions = computed<BulkAction[]>(() => [
    {
      key: 'toTests',
      label: `Make tests from ${counted(this.selection.ids().length, 'row')}…`,
    },
    { key: 'deleteRows', label: 'Delete…', red: true },
  ]);
  /** The rows the make-tests dialog was opened for: the ticked ones, or all (null). */
  making = signal<NumberedRow[] | null>(null);
  /** Every row, when they're all on this page - the make-tests dialog checks them. */
  allRows = computed(() => (this.total() <= this.rows().length ? this.rows() : null));

  dlg = signal<Dlg>(null);
  act = new ActionRunner({
    inDialog: () => !!this.dlg(),
    done: () => {
      this.dlg.set(null);
      this.load();
      this.store.loadDatasets();
    },
  });

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        this.offset.set(0);
        this.load();
      });
    });
  }

  load() {
    this.loading.set(true);
    this.datasetsApi.dataset(this.id()).subscribe({
      next: (m) => this.meta.set(m),
      error: (e) => this.act.msg.set({ ok: false, text: errText(e) }),
    });
    this.datasetsApi.datasetRows(this.id(), this.offset(), this.limit()).subscribe({
      next: (p) => {
        this.rows.set(p.items);
        this.total.set(p.total);
        this.selection.clear();
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.act.msg.set({ ok: false, text: errText(e) });
      },
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
  open(d: Dlg) {
    this.act.err.set(null);
    this.dlg.set(d);
  }
  quietAct(key: string) {
    this.open(key as Dlg);
  }
  bulk(key: string) {
    if (key === 'toTests') this.makeTests(this.ticked());
    else this.open('deleteRows');
  }
  makeTests(rows: NumberedRow[] | null) {
    this.making.set(rows);
    this.open('toTests');
  }
  edit(r: NumberedRow) {
    this.editing.set(r);
    this.open('editRow');
  }

  rename(n: string) {
    this.act.run(this.datasetsApi.renameDataset(this.id(), n), { ok: () => `Renamed to “${n}”.` });
  }
  remove() {
    this.act.run(this.datasetsApi.deleteDataset(this.id()), {
      then: () => this.router.navigate(['/datasets']),
    });
  }
  addRows(rows: DataSetRowSchema[]) {
    this.act.run(this.datasetsApi.addDatasetRows(this.id(), rows), {
      ok: (r) => `Added ${counted(r.loaded.n, 'row')}.`,
    });
  }
  replaceRows(rows: DataSetRowSchema[]) {
    this.act.run(this.datasetsApi.replaceDatasetRows(this.id(), rows), {
      ok: (r) => `Replaced the rows: ${counted(r.loaded.n, 'row')} now.`,
    });
  }
  deleteRows() {
    const ids = this.selection.ids();
    this.act.run(this.datasetsApi.deleteDatasetRows(ids), {
      ok: () =>
        `Deleted ${counted(ids.length, 'row')}. The tests made from them keep their content.`,
    });
  }
  saveRow(info: DataSetRowSchema) {
    const r = this.editing()!.row;
    this.act.run(this.datasetsApi.updateDatasetRows([{ id: r.id, row_info: info }]), {
      ok: () => `Saved row ${this.editing()!.no}.`,
    });
  }
  /** Every row makes a test - the API's only way today. Ticked rows wait for it: nothing is sent
   *  (docs/to_be_implemented_after_be_version_2/dev_notes.md). */
  toTests(assignments: TestTypeAssignment[]) {
    if (this.making()) return;
    this.act.run(this.testsApi.createTestsFromDataset(this.id(), assignments), {
      ok: (r) => `Made ${counted(r.test_cases.length, 'test')} from this dataset.`,
      then: () => {
        this.store.loadTests();
        this.router.navigate(['/tests']);
      },
    });
  }
}
