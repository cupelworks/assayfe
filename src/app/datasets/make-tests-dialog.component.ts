// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DataSetRow, FromDatasetOptions, TestTypeAssignment } from '../api/models';
import { TestTypesStore } from '../api/test-types.store';
import { CheckDraft, checkIssues, toAssignments, typesNeedingReference } from '../api/checks';
import { counted, listed } from '../shared/format';
import { DialogComponent } from '../shared/dialog/dialog.component';
import { ChecksTableComponent } from '../shared/checks-table.component';
import { StatusMarkComponent } from '../shared/status-mark.component';

/** A test's name after its prompt, as `POST /tests/from-dataset` names it (`naming: "prompt"`):
 *  every run of spaces, tabs and line breaks one space, trimmed; up to 60 characters, it's the name;
 *  longer, the first 59 - cut back to their last space when the 60th character isn't one - trimmed,
 *  and "…": never more than 60 characters. */
export function nameFromPrompt(prompt: string) {
  const s = prompt.replace(/\s+/g, ' ').trim();
  if (s.length <= 60) return s;
  let head = s.slice(0, 59);
  if (s[59] !== ' ' && head.includes(' ')) head = head.slice(0, head.lastIndexOf(' '));
  return `${head.trim()}…`;
}

/** What the dialog asks for: the checks every test gets, and how the tests are made. */
export interface MakeTests {
  assignments: TestTypeAssignment[];
  how: Pick<FromDatasetOptions, 'naming' | 'recorded_answers'>;
}

/** A row the dialog makes a test from, with its number in the dataset. */
export interface NumberedRow {
  no: number;
  row: DataSetRow;
}

/**
 * Make tests from a dataset's rows - every row, or the ticked ones: what each row gives its test
 * (its prompt the input, its expected output, its model output the recorded answer - or left out),
 * how the tests are named, and the checks every one of them gets, the test form's own table. A
 * check that compares with the expected output says whether every row has one.
 *
 * All of it is sent (API 2.0): the rows (every one, or the ticked), how they're named - after the
 * prompt, cut as the API cuts it (`nameFromPrompt`), or numbered - and the recorded answers kept or
 * left out.
 */
@Component({
  selector: 'assay-make-tests-dialog',
  standalone: true,
  imports: [DialogComponent, ChecksTableComponent, StatusMarkComponent],
  template: `<assay-dialog
    [busy]="busy()"
    [kicker]="kicker()"
    [title]="title()"
    [wide]="true"
    [primaryLabel]="busy() ? 'Making…' : 'Make ' + counted(count(), 'test')"
    [primaryDisabled]="busy() || !count() || issues().length > 0"
    [blockers]="issues()"
    [error]="error()"
    (primary)="go()"
    (close)="closed.emit()"
  >
    @if (rows(); as rows) {
      <div class="chips">
        @for (r of rows; track r.row.id) {
          <span
            ><b>Row {{ r.no }}</b> {{ r.row.row_info.prompt }}</span
          >
        }
      </div>
    }
    @if (madeAlready(); as line) {
      <p class="ok">
        <assay-mark of="Amber" /><span>{{ line }}</span>
      </p>
    }
    <div>
      <span class="cap">Each row gives its test</span>
      <div class="map">
        <span class="from">Prompt</span><span class="arrow">→</span
        ><span class="to">its input</span> <span class="from">Expected output</span
        ><span class="arrow">→</span><span class="to">its expected output</span>
        <span class="from">Model output</span><span class="arrow">→</span>
        <label class="keep"
          ><input type="checkbox" class="chk" [checked]="keep()" (change)="keep.set(!keep())" />
          {{ keep() ? 'its recorded answer' : 'left out' }}
          <small>{{
            keep()
              ? 'runs score it, without asking the application - an empty one asks it'
              : 'runs ask the application live'
          }}</small></label
        >
      </div>
    </div>
    <div>
      <span class="cap">Names</span>
      <div class="radios" role="radiogroup" aria-label="Names">
        <label class="radio-row"
          ><input
            type="radio"
            name="mt-names"
            [checked]="byPrompt()"
            (change)="byPrompt.set(true)"
          />
          <span
            ><b>After its prompt</b><small>“{{ example() }}”</small></span
          ></label
        >
        <label class="radio-row"
          ><input
            type="radio"
            name="mt-names"
            [checked]="!byPrompt()"
            (change)="byPrompt.set(false)"
          />
          <span
            ><b>Numbered</b><small>“New Test 1”, “New Test 2”… - you rename them later</small></span
          ></label
        >
      </div>
    </div>
    <div>
      <span class="cap">Checks every test gets</span>
      <assay-checks-table
        [(checks)]="checks"
        [hasReference]="null"
        hint="every test made from the rows gets these"
      />
    </div>
    @if (needRef().length) {
      <p class="ok">
        <assay-mark [of]="missing() === null ? 'Pending' : missing()!.length ? 'Amber' : 'Green'" />
        <span>{{ refLine() }}</span>
      </p>
    }
  </assay-dialog>`,
  styles: `
    .cap {
      display: block;
      margin-bottom: 6px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 18px;
      font-size: 13px;
      color: var(--color-neutral-800);
    }
    .chips b {
      font-weight: 700;
      color: var(--color-text);
    }
    .map {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1.4fr);
      column-gap: 12px;
      border-top: 1px solid var(--color-text);
    }
    .map > * {
      padding: 9px 0;
      border-bottom: 1px solid color-mix(in srgb, var(--color-text) 25%, transparent);
      font-size: 14px;
    }
    .from {
      padding-top: 11px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    .arrow {
      text-align: center;
      color: var(--color-neutral-500);
    }
    .to,
    .keep {
      font-weight: 600;
      color: var(--color-text);
    }
    .keep {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 10px;
      cursor: pointer;
    }
    small {
      display: block;
      flex-basis: 100%;
      font-size: 12px;
      font-weight: 400;
      color: var(--color-neutral-600);
    }
    .keep small {
      padding-left: 26px;
    }
    .chk,
    .radio-row input {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--color-accent);
      cursor: pointer;
    }
    .radios {
      border-top: 1px solid color-mix(in srgb, var(--color-text) 25%, transparent);
    }
    .radio-row {
      display: grid;
      grid-template-columns: 16px minmax(0, 1fr);
      column-gap: 10px;
      align-items: baseline;
      padding: 9px 0;
      border-bottom: 1px solid color-mix(in srgb, var(--color-text) 25%, transparent);
      font-size: 14px;
      color: var(--color-neutral-900);
      cursor: pointer;
    }
    .radio-row input {
      transform: translateY(3px);
    }
    .radio-row b {
      font-weight: 700;
      color: var(--color-text);
    }
    .ok {
      display: flex;
      align-items: baseline;
      gap: 10px;
      margin: 0;
      font-size: 13px;
      color: var(--color-neutral-800);
    }
  `,
})
export class MakeTestsDialogComponent {
  kicker = input('');
  /** The ticked rows; null: every row of the dataset. */
  rows = input<NumberedRow[] | null>(null);
  /** Every row, when they're all at hand (a dataset on one page) - to check expected outputs. */
  allRows = input<DataSetRow[] | null>(null);
  total = input(0);
  busy = input(false);
  error = input<string | null>(null);
  confirm = output<MakeTests>();
  closed = output<void>();
  private types = inject(TestTypesStore);
  counted = counted;
  keep = signal(true);
  byPrompt = signal(true);
  checks = signal<CheckDraft[]>([]);

  count = computed(() => this.rows()?.length ?? this.total());
  title = computed(
    () =>
      `Make tests from ${this.rows() ? counted(this.count(), 'row') : `all ${counted(this.total(), 'row')}`}`,
  );
  /** The first row's prompt as its test's name would read. */
  example = computed(() =>
    nameFromPrompt(
      (this.rows()?.[0]?.row ?? this.allRows()?.[0])?.row_info.prompt ??
        'How do I reset my password?',
    ),
  );
  /** The rows at hand that tests were made from already - making them again makes one more each:
   *  "Row 4 has a test already: this makes one more." Null when none has, or they aren't at hand. */
  madeAlready = computed(() => {
    const rows = this.rows() ?? this.allRows()?.map((row) => ({ no: row.number, row }));
    const made = (rows ?? []).filter((r) => r.row.test_count > 0);
    if (!made.length) return null;
    if (made.length === 1) {
      const r = made[0];
      return `Row ${r.no} has ${counted(r.row.test_count, 'test')} already: this makes one more.`;
    }
    const nos = made.map((r) => String(r.no));
    return `Rows ${made.length <= 5 ? listed(nos) : `${nos.slice(0, 5).join(', ')} and ${nos.length - 5} more`} have tests already: this makes one more of each.`;
  });
  /** What keeps "Make" disabled - the checks' own (expected outputs come from each row). */
  issues = computed(() => checkIssues(this.checks(), this.types.byName(), null));
  needRef = computed(() => typesNeedingReference(this.checks(), this.types.byName()));
  /** The rows without an expected output, by number - null when not every row is at hand. */
  missing = computed(() => {
    const ticked = this.rows();
    const all = this.allRows();
    const rows = ticked ?? all?.map((row) => ({ no: row.number, row }));
    if (!rows) return null;
    return rows.filter((r) => !r.row.row_info.expected_output.trim()).map((r) => r.no);
  });
  refLine = computed(() => {
    const what = this.needRef().join(', ');
    const missing = this.missing();
    if (missing === null)
      return `${what} compare with the expected output: a row without one is refused.`;
    if (!missing.length)
      return `${what} compare with the expected output: ${this.count() === 1 ? 'the row has one' : 'every row has one'}.`;
    return `${what} compare with the expected output: row ${missing.join(', ')} has none, so it would be refused.`;
  });

  go() {
    if (this.busy() || this.issues().length) return;
    this.confirm.emit({
      assignments: toAssignments(this.checks(), this.types.byName()),
      how: {
        naming: this.byPrompt() ? 'prompt' : 'numbered',
        recorded_answers: this.keep() ? 'keep' : 'leave_out',
      },
    });
  }
}
