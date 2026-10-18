// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { copyText, short } from './format';

let tips = 0;

/**
 * A thing's ID, to copy: its first 8 characters -
 * the uuid's own first group, so nothing reads as cut - in the quiet grey of a date, with a copy
 * mark. Hover or Tab shows the whole ID above it; a click copies all 36 and says "Copied" in their
 * place for 1.5 s, then the ID again - a screen reader hears it. When the browser won't copy, it
 * says so in red and shows the whole ID selected, for ⌘C. A table's "ID" column holds it through
 * `<assay-catalog-cell [copyId]>`; a page's top through `<assay-guide-head [copyId]>`, a size
 * smaller.
 */
@Component({
  selector: 'assay-copy-id',
  standalone: true,
  host: { '[class.at-top]': "place() === 'top'" },
  template: `
    <button
      type="button"
      class="id"
      [class.done]="state() === 'copied'"
      [class.failed]="state() === 'failed'"
      [attr.aria-label]="'Copy the ' + whose() + ' ' + id()"
      [attr.aria-describedby]="showTip() ? tipId : null"
      (click)="copy()"
      (pointerenter)="pointer($event, true)"
      (pointerleave)="pointer($event, false)"
      (focus)="focused($event)"
      (blur)="tip.set(false)"
    >
      @switch (state()) {
        @case ('copied') {
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 6.2L4.6 9.3L10.5 2.8" /></svg
          >Copied
        }
        @case ('failed') {
          Couldn’t copy
        }
        @default {
          {{ shown()
          }}<svg viewBox="0 0 12 12" aria-hidden="true">
            <rect x="3.5" y="0.5" width="8" height="8" />
            <path d="M0.5 3.5V11.5H8.5" />
          </svg>
        }
      }
    </button>
    @if (showTip()) {
      <span class="tip" role="tooltip" [id]="tipId">
        <span class="full" #full
          ><b>{{ shown() }}</b
          >{{ rest() }}</span
        >
        <span class="hint">{{
          state() === 'failed' ? 'Selected · ⌘C or Ctrl+C copies it' : 'Click to copy'
        }}</span>
      </span>
    }
    <span class="said" aria-live="polite">{{ said() }}</span>
  `,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
      vertical-align: top;
      /* 32 px to point at, the line it sits on kept as tall as its text. */
      margin: -6px 0;
      text-transform: none;
      letter-spacing: normal;
    }
    .id {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 32px;
      font-family: var(--font-body);
      font-size: 14px;
      line-height: 1.3;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      color: var(--color-neutral-600);
      cursor: pointer;
    }
    :host(.at-top) .id {
      font-size: 13px;
    }
    .id:hover,
    .id:focus-visible {
      color: var(--color-accent);
    }
    .id:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
    .id.done {
      font-weight: 600;
      color: var(--color-text);
    }
    .id.failed {
      font-weight: 600;
      color: var(--color-accent);
    }
    svg {
      flex: none;
      width: 12px;
      height: 12px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.25;
    }
    .done svg {
      stroke-width: 1.6;
    }
    /* The whole ID, over the short one: the part shown bright, the rest grey. */
    .tip {
      position: absolute;
      right: 0;
      bottom: calc(100% + 8px);
      z-index: 5;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px 11px;
      background: var(--color-text);
      color: var(--color-neutral-500);
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 400;
      line-height: 1.3;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      pointer-events: none;
    }
    .tip b {
      font-weight: 400;
      color: var(--color-bg);
    }
    .full {
      user-select: all;
    }
    .hint {
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-neutral-400);
    }
    .said {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    @media (max-width: 960px) {
      /* A finger's 44 px. */
      :host {
        margin: -12px 0;
      }
      .id {
        min-height: 44px;
      }
    }
  `,
})
export class CopyIdComponent {
  /** The whole ID: what a click copies. */
  id = input.required<string>();
  /** Whose ID, as its column or the page's top calls it: "ID", "Entry ID", "Run ID". */
  what = input('ID');
  /** `top`: on a page's top, on the breadcrumb's line - a size smaller. */
  place = input<'cell' | 'top'>('cell');

  state = signal<'idle' | 'copied' | 'failed'>('idle');
  /** Pointed at with a mouse, or reached with Tab. */
  tip = signal(false);
  shown = computed(() => short(this.id()));
  rest = computed(() => this.id().slice(8));
  /** "ID", "entry ID": for "Copy the entry ID …". */
  whose = computed(() =>
    this.what() === 'ID' ? 'ID' : this.what().replace(/^\w/, (c) => c.toLowerCase()),
  );
  showTip = computed(() => this.state() === 'failed' || (this.tip() && this.state() === 'idle'));
  said = computed(() =>
    this.state() === 'copied'
      ? `${this.what()} copied`
      : this.state() === 'failed'
        ? `Couldn’t copy the ${this.whose()}`
        : '',
  );
  tipId = `copy-id-${++tips}`;
  private full = viewChild<ElementRef<HTMLElement>>('full');
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /** A mouse's hover shows the whole ID; a finger's tap only copies. */
  pointer(e: PointerEvent, on: boolean) {
    if (e.pointerType === 'mouse') this.tip.set(on);
  }
  /** Tab shows the whole ID; a click's focus doesn't. */
  focused(e: FocusEvent) {
    if ((e.target as HTMLElement).matches(':focus-visible')) this.tip.set(true);
  }
  async copy() {
    const ok = await copyText(this.id());
    clearTimeout(this.timer);
    this.state.set(ok ? 'copied' : 'failed');
    // Couldn't: the whole ID, shown selected, for the keyboard to copy.
    if (!ok)
      setTimeout(() => {
        const el = this.full()?.nativeElement;
        if (el) getSelection()?.selectAllChildren(el);
      });
    this.timer = setTimeout(() => this.state.set('idle'), ok ? 1500 : 4000);
  }
}
