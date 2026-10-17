import { Component, computed, input, model } from '@angular/core';
import { DataSetRowSchema } from '../api/models';
import { LineCheck, LineChecksComponent } from './line-checks.component';

/** One pasted line, read: its row, or what's wrong with it. */
export interface PastedLine {
  no: number;
  row: DataSetRowSchema | null;
  /** The line's prompt when it reads; what's wrong when it doesn't. */
  text: string;
}

const KEYS = ['prompt', 'expected_output', 'model_output'] as const;

/** Each non-empty line of a paste, read as a dataset row - said back in words, good or not. */
export function readLines(paste: string): PastedLine[] {
  return paste
    .split(/\r?\n/)
    .map((line, i) => ({ line: line.trim(), no: i + 1 }))
    .filter((l) => l.line)
    .map(({ line, no }) => {
      let o: unknown;
      try {
        o = JSON.parse(line);
      } catch {
        return { no, row: null, text: "isn't one JSON object - check its quotes and braces" };
      }
      if (!o || typeof o !== 'object' || Array.isArray(o))
        return { no, row: null, text: "isn't one JSON object" };
      const r = o as Record<string, unknown>;
      const missing = KEYS.filter((k) => typeof r[k] !== 'string');
      if (missing.length) return { no, row: null, text: `has no ${missing.join(', no ')}` };
      return {
        no,
        row: {
          prompt: r['prompt'] as string,
          expected_output: r['expected_output'] as string,
          model_output: r['model_output'] as string,
        },
        text: r['prompt'] as string,
      };
    });
}

/**
 * Rows to paste, one JSON object a line: the lines numbered beside a box that keeps them as typed,
 * then each line said back as it's read (`<assay-line-checks>`) - its prompt beside a green mark,
 * or what's wrong with it beside a red one. Its `rows` are the rows to send, null while a line is
 * wrong.
 */
@Component({
  selector: 'assay-paste-rows',
  standalone: true,
  imports: [LineChecksComponent],
  template: `
    <div class="paste ruled">
      <div class="nos" aria-hidden="true">
        @for (n of numbers(); track n) {
          <div>{{ n }}</div>
        }
      </div>
      <textarea
        [attr.aria-label]="label()"
        spellcheck="false"
        placeholder='{"prompt": "…", "expected_output": "…", "model_output": "…"}'
        [value]="text()"
        [style.height.px]="height()"
        (input)="text.set($any($event.target).value)"
      ></textarea>
    </div>
    @if (checks().length) {
      <assay-line-checks aria-live="polite" [lines]="checks()" />
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .paste {
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr);
    }
    .paste:focus-within {
      border-bottom: 2px solid var(--color-accent);
    }
    .nos {
      padding: 10px 8px 10px 0;
      border-right: 1px solid color-mix(in srgb, var(--color-text) 25%, transparent);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 20px;
      text-align: right;
      color: var(--color-neutral-500);
    }
    textarea {
      all: unset;
      box-sizing: border-box;
      width: 100%;
      padding: 10px;
      overflow-x: auto;
      overflow-y: hidden;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 20px;
      color: var(--color-text);
      caret-color: var(--color-accent);
      white-space: pre;
      cursor: text;
    }
    textarea::placeholder {
      color: var(--color-neutral-500);
    }
  `,
})
export class PasteRowsComponent {
  text = model('');
  label = input('Rows, one JSON object a line');
  lines = computed(() => readLines(this.text()));
  /** Each line said back: read as a row or not, and what it says. */
  checks = computed<LineCheck[]>(() =>
    this.lines().map((l) => ({ no: l.no, ok: !!l.row, text: l.text })),
  );
  numbers = computed(() =>
    this.text()
      .split(/\r?\n/)
      .map((_, i) => i + 1),
  );
  /** As tall as its lines, so the numbers beside it stay level with them (eight at least). */
  height = computed(() => Math.max(8, this.numbers().length) * 20 + 20);
  bad = computed(() => this.lines().filter((l) => !l.row));
  /** The rows to send - null while a line is wrong or nothing is pasted. */
  rows = computed(() =>
    this.lines().length && !this.bad().length
      ? this.lines().map((l) => l.row as DataSetRowSchema)
      : null,
  );
}
