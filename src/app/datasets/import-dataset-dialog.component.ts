import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatasetsApiService } from '../api/datasets-api.service';
import { DataSetImportResult, InvalidLines } from '../api/models';
import { ActionRunner } from '../shared/action-runner';
import { bytesText } from '../shared/format';
import { DialogComponent } from '../shared/dialog/dialog.component';
import { FileDropComponent } from '../shared/file-drop.component';
import { LineCheck, LineChecksComponent } from './line-checks.component';
import { UploadProblem, uploadProblem } from './upload-problem';
import { ROW_KEYS } from './row-keys';

/** How many of the refused lines the dialog lists; the rest it counts. */
const SHOWN_LINES = 5;
/** A file's name less its extension: "support_en.jsonl" → "support_en". */
const stem = (name: string) => name.replace(/\.[^.]+$/, '');

/**
 * Import a dataset: a .jsonl file from the reader's computer -
 * dropped or chosen (`<assay-file-drop>`) - and its name, filled in from the file's own until one
 * is typed; then what each of the file's lines must hold, with one for example. All or nothing
 * (API 2.3.0, `POST /datasets/upload`): one wrong line and nothing is imported.
 *
 * A file over the server's limit (`GET /datasets/upload`) is refused before it's sent. What the
 * API refuses is said where it belongs (`uploadProblem`): a name already taken under the name;
 * lines that aren't rows - the API's sentence, the first five (`<assay-line-checks>`), how many
 * more - and a file it can't read in the dialog's error. Import stays off, saying why in the
 * footer, until what was refused changes: another file, another name. Says `imported` with what
 * came in.
 */
@Component({
  selector: 'assay-import-dataset-dialog',
  standalone: true,
  imports: [DialogComponent, FormsModule, FileDropComponent, LineChecksComponent],
  template: `<assay-dialog
    [busy]="act.busy()"
    kicker="Datasets"
    title="Import a dataset"
    [primaryLabel]="act.busy() ? 'Importing…' : 'Import'"
    [primaryDisabled]="act.busy() || blockers().length > 0"
    [blockers]="act.busy() ? [] : blockers()"
    [error]="act.err()"
    (primary)="go()"
    (close)="closed.emit()"
  >
    <div class="lfield">
      <span class="lfield-label">File</span>
      <assay-file-drop
        accept=".jsonl"
        noun="a .jsonl file"
        describedBy="ds-file-help"
        [invalid]="tooBig()"
        [file]="file()"
        (fileChange)="choose($event)"
      />
      @if (tooBig() && file(); as f) {
        <span class="err-line"
          >This file is {{ size(f) }}; the server takes files up to {{ limitText() }}.</span
        >
      }
      <span class="lfield-help" id="ds-file-help">{{
        limitText() ? 'Up to ' + limitText() + '.' : 'Up to the size the server takes.'
      }}</span>
    </div>
    <div class="lfield">
      <label for="ds-name">Name</label
      ><input
        id="ds-name"
        [class.invalid]="nameTaken()"
        [attr.aria-invalid]="nameTaken()"
        [ngModel]="name()"
        (ngModelChange)="type($event)"
        placeholder="Support tickets - EN"
        (keydown.enter)="go()"
      />
      @if (nameTaken() && taken(); as t) {
        <span class="err-line">{{ t.text }}</span>
      }
      <span class="lfield-help">{{
        fromFile()
          ? "From the file's name - change it if you like. No other dataset may have it."
          : 'No other dataset may have it.'
      }}</span>
    </div>
    <div class="fmt">
      <span class="cap">One JSON object a line, each with</span>
      @for (k of keys; track k.key) {
        <div class="key">
          <code>{{ k.key }}</code
          ><span>{{ k.text }}</span>
        </div>
      }
      <p class="eg">{{ example }}</p>
    </div>
    <p class="say">If one line is wrong, nothing is imported.</p>
    <div errDetail>
      @if (invalid()) {
        <assay-line-checks [lines]="shownLines()" />
        @if (moreLines(); as n) {
          <p class="more">and {{ n }} more {{ n === 1 ? 'line' : 'lines' }}.</p>
        }
        <p class="next">Fix them in the file, then choose it again.</p>
      }
    </div>
  </assay-dialog>`,
  styles: `
    .fmt {
      padding-top: 14px;
      border-top: 1px solid color-mix(in srgb, var(--color-text) 25%, transparent);
    }
    .cap {
      display: block;
      margin-bottom: 8px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    .key {
      display: grid;
      grid-template-columns: 140px minmax(0, 1fr);
      column-gap: 16px;
      padding: 5px 0;
      font-size: 13px;
      color: var(--color-neutral-800);
    }
    code,
    .eg {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    code {
      font-size: 12.5px;
      color: var(--color-text);
    }
    .eg {
      margin: 10px 0 0;
      padding: 10px 12px;
      background: color-mix(in srgb, var(--color-text) 5%, transparent);
      font-size: 12px;
      line-height: 1.5;
      color: var(--color-neutral-900);
      overflow-wrap: anywhere;
    }
    .say {
      margin: 0;
      font-size: 15px;
      color: var(--color-neutral-900);
    }
    /* Under the error's sentence: the refused lines, how many more, what to do. */
    [errDetail] {
      white-space: normal;
    }
    assay-line-checks {
      margin-top: 8px;
    }
    .more,
    .next {
      margin: 0;
      font-size: 13px;
      color: var(--color-neutral-800);
    }
    .more {
      margin-top: 8px;
    }
    @media (max-width: 960px) {
      .key {
        grid-template-columns: minmax(0, 1fr);
        row-gap: 2px;
      }
    }
  `,
})
export class ImportDatasetDialogComponent {
  imported = output<DataSetImportResult>();
  closed = output<void>();
  private api = inject(DatasetsApiService);
  act = new ActionRunner({ inDialog: () => true });
  keys = ROW_KEYS;
  example =
    '{"prompt": "How do I reset my password?", "expected_output": "Go to Settings > Security…", "model_output": "You can reset it from Settings…"}';
  size = (f: File) => bytesText(f.size);

  file = signal<File | null>(null);
  name = signal('');
  /** A name was typed: a file chosen after it no longer fills it in. */
  private typed = signal(false);
  /** The largest file the server takes, in bytes - null until read, or when it can't be. */
  private limit = signal<number | null>(null);
  limitText = computed(() => {
    const l = this.limit();
    return l == null ? null : bytesText(l);
  });
  /** What the API refused last: the name it found taken (and its sentence), the file it couldn't
   *  import, and that file's lines that aren't rows. */
  taken = signal<{ name: string; text: string } | null>(null);
  private failed = signal<File | null>(null);
  invalid = signal<InvalidLines | null>(null);

  fromFile = computed(() => !!this.file() && !this.typed());
  tooBig = computed(() => {
    const f = this.file(),
      l = this.limit();
    return !!f && l != null && f.size > l;
  });
  nameTaken = computed(() => this.taken()?.name === this.name().trim());
  shownLines = computed<LineCheck[]>(() =>
    (this.invalid()?.lines ?? [])
      .slice(0, SHOWN_LINES)
      .map((l) => ({ no: l.line, ok: false, text: l.msg })),
  );
  moreLines = computed(() => {
    const inv = this.invalid();
    return inv ? inv.invalid_lines - this.shownLines().length : 0;
  });
  /** Why Import is off, as the footer says it - what's missing, or what was refused and hasn't
   *  changed since. */
  blockers = computed(() => {
    const f = this.file();
    if (!f) return ['Choose a file'];
    if (this.tooBig()) return [`The file is over ${this.limitText()}`];
    if (f === this.failed()) return ['Choose the fixed file'];
    if (!this.name().trim()) return ['Name it'];
    if (this.nameTaken()) return ['Choose a new name'];
    return [];
  });

  constructor() {
    this.api.uploadLimit().subscribe({
      next: (l) => this.limit.set(l.max_bytes),
      error: () => {},
    });
  }

  /** A file dropped or chosen: what was said about the last one goes; it names the dataset unless
   *  a name was typed. */
  choose(f: File | null) {
    this.file.set(f);
    this.act.err.set(null);
    this.invalid.set(null);
    if (f && !this.typed()) this.name.set(stem(f.name));
  }
  type(name: string) {
    this.name.set(name);
    this.typed.set(true);
  }
  go() {
    const file = this.file(),
      name = this.name().trim();
    if (!file || this.blockers().length || this.act.busy()) return;
    this.invalid.set(null);
    this.act.run(this.api.uploadDataset(file, name), {
      then: (r) => this.imported.emit(r),
      onError: (e) => this.refused(uploadProblem(e), file, name),
    });
  }

  /** What the API refused, kept where it's said; the dialog's error's sentence, or null when it's
   *  said under the name. */
  private refused(p: UploadProblem, file: File, name: string): string | null {
    switch (p.kind) {
      case 'name':
        this.taken.set({ name, text: p.text });
        return null;
      case 'lines':
        this.failed.set(file);
        this.invalid.set(p.lines);
        return p.lines.msg;
      case 'file':
        this.failed.set(file);
        return p.text;
      default:
        return p.text;
    }
  }
}
