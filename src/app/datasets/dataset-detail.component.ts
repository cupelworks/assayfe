import { Component, inject, input, signal, computed, effect, untracked } from '@angular/core';
import { ActionRunner } from '../shared/action-runner';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatasetsApiService } from '../api/datasets-api.service';
import { TestsApiService } from '../api/tests-api.service';
import { CatalogStore } from '../api/catalog.store';
import { DataSetMetadata, DataSetRow, DataSetRowSchema } from '../api/models';
import { TestTypesStore } from '../api/test-types.store';
import { CheckDraft, checkIssues, toAssignments, typesNeedingReference } from '../api/checks';
import { rel, short, errText } from '../shared/format';
import { ChecksTableComponent } from '../shared/checks-table.component';
import { DialogComponent } from '../shared/dialog/dialog.component';
import { NameDialogComponent } from '../shared/dialog/name-dialog.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { PagerComponent } from '../shared/pager.component';

type Dlg =
  null | 'rename' | 'delete' | 'addRows' | 'replace' | 'deleteRows' | 'toTests' | 'editRow';
const EMPTY: DataSetRowSchema = { prompt: '', expected_output: '', model_output: '' };

import { Selection } from '../shared/selection';

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
    ChecksTableComponent,
  ],
  templateUrl: './dataset-detail.component.html',
  styleUrls: ['../shared/page.css', './dataset-detail.component.css'],
})
export class DatasetDetailComponent {
  id = input.required<string>();
  datasetsApi = inject(DatasetsApiService);
  testsApi = inject(TestsApiService);
  testTypesStore = inject(TestTypesStore);
  store = inject(CatalogStore);
  router = inject(Router);
  rel = rel;
  short = short;
  meta = signal<DataSetMetadata | null>(null);
  rows = signal<DataSetRow[]>([]);
  total = signal(0);
  offset = signal(0);
  limit = signal(25);
  /** Checkbox bulk selection over the visible rows - see shared/selection.ts. */
  selection = new Selection(() => this.rows());
  dlg = signal<Dlg>(null);
  /** Busy flag, dialog error and page banner for this page's API actions - see shared/action-runner.ts. */
  act = new ActionRunner({
    inDialog: () => !!this.dlg(),
    done: () => {
      this.dlg.set(null);
      this.load();
      this.store.load();
    },
  });
  jsonl = signal('');
  /** The checks every test created from the rows gets - the same table as the test form. */
  batchChecks = signal<CheckDraft[]>([]);
  /** What blocks "Create tests from rows": `checkIssues` (api/checks.ts, shared with the test
   *  form), with reference fields skipped - every row brings its own expected_output. */
  configIssues = computed(() =>
    checkIssues(this.batchChecks(), this.testTypesStore.byName(), null),
  );
  /** Checks' types that need a non-empty expected_output per row - informational only, not part
   *  of configIssues(): this dialog can't check every row's expected_output without fetching the
   *  whole dataset, so it can only say that some check needs one. The backend rejects the create
   *  call (422, listing the offending row ids) if any row is missing one. */
  referenceTypesInBatch = computed(() =>
    typesNeedingReference(this.batchChecks(), this.testTypesStore.byName()),
  );
  editing = signal<DataSetRow | null>(null);
  draft = signal<DataSetRowSchema>({ ...EMPTY });
  name = computed(() => this.meta()?.name ?? short(this.id()));
  pageLabel = computed(() => (this.total() ? `${this.total()} rows` : '0 rows'));
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
      error: (e) => this.act.msg.set({ ok: false, text: errText(e) }),
    });
    this.datasetsApi.datasetRows(this.id(), this.offset(), this.limit()).subscribe({
      next: (p) => {
        this.rows.set(p.items);
        this.total.set(p.total);
        this.selection.clear();
      },
      error: (e) => this.act.msg.set({ ok: false, text: errText(e) }),
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
  open(d: Dlg, row?: DataSetRow) {
    this.act.err.set(null);
    this.jsonl.set('');
    this.batchChecks.set([]);
    if (row) {
      this.editing.set(row);
      this.draft.set({ ...row.row_info });
    }
    this.dlg.set(d);
  }
  setDraft<K extends keyof DataSetRowSchema>(k: K, v: string) {
    this.draft.update((d) => ({ ...d, [k]: v }));
  }

  rename(n: string) {
    this.act.run(this.datasetsApi.renameDataset(this.id(), n), { ok: () => `Renamed to “${n}”.` });
  }
  remove() {
    this.act.run(this.datasetsApi.deleteDataset(this.id()), {
      ok: (r) => `Deleted dataset (${r.deleted.n} rows).`,
      then: () => this.router.navigate(['/datasets']),
    });
  }
  addRows() {
    this.act.run(
      this.datasetsApi.addDatasetRows(this.id(), this.parsedRows() as DataSetRowSchema[]),
      { ok: (r) => `Added ${r.loaded.n} rows.` },
    );
  }
  replaceRows() {
    this.act.run(
      this.datasetsApi.replaceDatasetRows(this.id(), this.parsedRows() as DataSetRowSchema[]),
      { ok: (r) => `Replaced all rows - ${r.loaded.n} loaded.` },
    );
  }
  deleteRows() {
    const ids = this.selection.ids();
    this.act.run(this.datasetsApi.deleteDatasetRows(ids), {
      ok: () =>
        `Deleted ${ids.length} row${ids.length === 1 ? '' : 's'}. Tests referencing them are unlinked, not deleted.`,
    });
  }
  saveRow() {
    const r = this.editing()!;
    this.act.run(this.datasetsApi.updateDatasetRows([{ id: r.id, row_info: this.draft() }]), {
      ok: () => 'Row updated.',
    });
  }
  toTests() {
    if (this.configIssues().length) return;
    const assignments = toAssignments(this.batchChecks(), this.testTypesStore.byName());
    this.act.run(this.testsApi.createTestsFromDataset(this.id(), assignments), {
      ok: (r) => `Created ${r.test_cases.length} tests from this dataset.`,
      then: () => this.router.navigate(['/tests']),
    });
  }
}
