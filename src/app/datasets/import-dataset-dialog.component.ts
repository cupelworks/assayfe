import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogComponent } from '../shared/dialog/dialog.component';
import { ROW_KEYS } from './row-keys';

/**
 * Import a dataset: its name, and its file - a path on the server, read there - then what each of
 * the file's lines must hold, with one for example. All or nothing: one wrong line and nothing is
 * imported.
 */
@Component({
  selector: 'assay-import-dataset-dialog',
  standalone: true,
  imports: [DialogComponent, FormsModule],
  template: `<assay-dialog
    [busy]="busy()"
    kicker="Datasets"
    title="Import a dataset"
    [primaryLabel]="busy() ? 'Importing…' : 'Import'"
    [primaryDisabled]="!name().trim() || !path().trim() || busy()"
    [error]="error()"
    (primary)="go()"
    (close)="closed.emit()"
  >
    <div class="lfield">
      <label for="ds-name">Name</label
      ><input
        id="ds-name"
        [ngModel]="name()"
        (ngModelChange)="name.set($event)"
        placeholder="Support tickets - EN"
        autofocus
      />
    </div>
    <div class="lfield">
      <label for="ds-path">File on the server</label
      ><input
        id="ds-path"
        class="mono"
        [ngModel]="path()"
        (ngModelChange)="path.set($event)"
        placeholder="/data/support_en.jsonl"
        (keydown.enter)="go()"
      />
      <span class="lfield-help">Its path, as the server sees it - a .jsonl file.</span>
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
  `,
})
export class ImportDatasetDialogComponent {
  busy = input(false);
  error = input<string | null>(null);
  confirm = output<{ name: string; path: string }>();
  closed = output<void>();
  name = signal('');
  path = signal('');
  keys = ROW_KEYS;
  example =
    '{"prompt": "How do I reset my password?", "expected_output": "Go to Settings > Security…", "model_output": "You can reset it from Settings…"}';
  go() {
    const name = this.name().trim();
    const path = this.path().trim();
    if (name && path && !this.busy()) this.confirm.emit({ name, path });
  }
}
