import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatasetsApiService } from '../api/datasets-api.service';
import { TestsApiService } from '../api/tests-api.service';
import { CatalogStore } from '../api/catalog.store';
import { DataSetMetadata, DataSetRow, DataSetRowSchema, TestCaseRead } from '../api/models';
import { ActionRunner } from '../shared/action-runner';
import { Selection } from '../shared/selection';
import { Paged } from '../shared/paged';
import { ApiList } from '../shared/work/api-list';
import { latestRunOf, refreshStandings } from '../api/latest';
import { LatestStatusComponent } from '../shared/work/latest-status.component';
import { counted, displayName, errText, short, shortDate } from '../shared/format';
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
import { MakeTests, MakeTestsDialogComponent, NumberedRow } from './make-tests-dialog.component';
import { ROW_KEY } from './row-keys';

type Dlg =
  null | 'rename' | 'delete' | 'addRows' | 'replace' | 'deleteRows' | 'toTests' | 'editRow';

/**
 * A dataset's page, on the Guide's layout. Its top: the way back, its name, "Make tests from
 * rows" and the quiet rest (Add rows · Replace rows · Rename · Delete), a lede and what a row
 * holds. Then 01 its rows - found by their words, by the API (`ApiList`), ticked to make tests
 * from or to delete - and 02 the tests made from it (`from_dataset`), each with the row it came
 * from and how it stands.
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
    LatestStatusComponent,
  ],
  templateUrl: './dataset-detail.component.html',
  styleUrls: [
    '../shared/guide/guide.css',
    '../shared/guide/head-aside.css',
    '../shared/work/work.css',
    './dataset-detail.component.css',
  ],
})
export class DatasetDetailComponent {
  id = input.required<string>();
  private datasetsApi = inject(DatasetsApiService);
  private testsApi = inject(TestsApiService);
  private store = inject(CatalogStore);
  private router = inject(Router);
  rowKey = ROW_KEY;
  displayName = displayName;
  sections = numbered('dataset-', ['Rows', 'Tests made from it']);

  meta = signal<DataSetMetadata | null>(null);
  name = computed(() => this.meta()?.name ?? short(this.id()));
  /** Its rows, by number, as the API finds them by their words (prompt, expected and recorded
   *  answer). */
  rowsList = new ApiList<DataSetRow, never, { id: string; q: readonly string[] }>({
    noun: 'row',
    sort: '',
    params: (_, q) => ({ id: this.id(), q }),
    fetch: (p, o, l) => this.datasetsApi.datasetRows(p.id, o, l, p.q),
  });
  rows = this.rowsList.page.items;
  /** How many rows it has - the dataset's, whatever the words. */
  total = computed(() => this.meta()?.row_count ?? this.rowsList.page.total());
  /** The page's rows, each with its number in the dataset (kept when others go). */
  shown = computed<NumberedRow[]>(() => this.rows().map((row) => ({ no: row.number, row })));
  /** The tests made from it - each with the row it came from and how it stands. */
  made = new Paged<TestCaseRead>(
    (o, l) => this.testsApi.testsPage({ from_dataset: [this.id()], sort: 'name' }, o, l),
    5,
    errText,
  );
  madeRuns = computed(() => new Map(this.made.items().map((t) => [t.id, latestRunOf(t)])));
  madeEmpty = computed(() =>
    this.made.loading() || this.made.items().length
      ? null
      : 'No test was made from it yet - Make tests from rows makes some.',
  );
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
  shownText = this.rowsList.shownText;
  columns: CatalogColumn[] = [
    { label: 'Prompt', width: 3 },
    { label: 'Expected output', width: 3 },
    { label: 'Model output', width: 3 },
    idColumn(),
    { label: '', width: 0.6 },
  ];
  rowsEmpty = computed(() => this.rowsList.empty('No rows yet - Add rows pastes them in.'));
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
  allRows = computed(() =>
    !this.rowsList.narrowed() && this.total() <= this.rows().length ? this.rows() : null,
  );

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
    // Its rows read again for another dataset (`rowsList`'s parameters hold its id); its own.
    effect(() => {
      this.id();
      untracked(() => {
        this.loadMeta();
        this.made.reset();
      });
    });
    effect(() => {
      this.rows();
      untracked(() => this.selection.clear());
    });
    refreshStandings(
      () => this.made.items(),
      () => {
        if (!this.made.loading()) this.made.reload();
      },
    );
  }

  /** It, its rows and its tests, again - after a change. */
  load() {
    this.loadMeta();
    this.rowsList.page.reload();
    this.made.reload();
  }
  private loadMeta() {
    this.datasetsApi.dataset(this.id()).subscribe({
      next: (m) => this.meta.set(m),
      error: (e) => this.act.msg.set({ ok: false, text: errText(e) }),
    });
  }
  go(offset: number) {
    this.rowsList.page.go(offset);
  }
  size(limit: number) {
    this.rowsList.page.size(limit);
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
  /** Tests from the rows the dialog was opened for - the ticked ones, or every row - made as it
   *  says; then Tests, showing those made from this dataset. */
  toTests(m: MakeTests) {
    const ticked = this.making();
    this.act.run(
      this.testsApi.createTestsFromDataset(this.id(), m.assignments, {
        ...m.how,
        ...(ticked ? { row_ids: ticked.map((r) => r.row.id) } : {}),
      }),
      {
        ok: (r) => `Made ${counted(r.test_cases.length, 'test')} from this dataset.`,
        then: () => {
          this.store.loadTests();
          this.router.navigate(['/tests'], { queryParams: { dataset: this.id() } });
        },
      },
    );
  }
}
