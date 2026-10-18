// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NumberInputDirective } from '../shared/number';
import { ParamRow } from './stats-params';

/** One statistical test parameter as a form field: label, value with its unit, the presets
 *  beside it (on the value's line when `inline`, under it otherwise), and its hint - `hint` when
 *  given, the API's otherwise - or its problem. */
@Component({
  selector: 'assay-param-field',
  standalone: true,
  imports: [FormsModule, NumberInputDirective],
  template: `
    <div class="field" [class.inline]="inline()">
      <label [for]="'sp-' + row().p.key">{{ row().p.label }}</label>
      <div class="with-unit">
        <input
          [id]="'sp-' + row().p.key"
          class="input num"
          [class.invalid]="row().issue"
          assayNumber
          [ngModel]="row().text"
          (ngModelChange)="changed.emit($event)"
        /><span class="unit">{{ row().unit }}</span>
        @if (inline() && row().presets.length) {
          <span class="presets" role="group" [attr.aria-label]="'Usual: ' + row().p.label">
            @for (c of row().presets; track c.label) {
              <button
                type="button"
                class="preset"
                [class.on]="c.on"
                [attr.aria-pressed]="c.on"
                (click)="changed.emit(c.text)"
              >
                {{ c.label }}
              </button>
            }
          </span>
        }
      </div>
      @if (!inline() && row().presets.length) {
        <div class="chips">
          @for (c of row().presets; track c.label) {
            <button type="button" class="chip-btn" (click)="changed.emit(c.text)">
              <span class="tag" [class.tag-accent]="c.on" [class.tag-outline]="!c.on">{{
                c.label
              }}</span>
            </button>
          }
        </div>
      }
      @if (row().issue) {
        <div class="err">{{ row().issue }}</div>
      } @else {
        <div class="hint-line">{{ hint() ?? row().p.hint }}</div>
      }
    </div>
  `,
  styleUrl: './stats-form.css',
  /* Inline, as Run with statistics sets it: the name in small capitals, the value
     big on a line with its unit, the usual values beside it in small capitals (the picked one
     red), what the value means under it. */
  styles: `
    .inline > label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    .inline .with-unit {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }
    .inline .input.num {
      all: unset;
      box-sizing: border-box;
      width: 60px;
      padding: 2px 0 5px;
      border-bottom: 1px solid var(--color-divider);
      font-family: inherit;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      color: var(--color-text);
    }
    .inline .input.num:focus {
      padding-bottom: 4px;
      border-bottom: 2px solid var(--color-accent);
    }
    .inline .input.num.invalid {
      border-bottom-color: var(--color-accent);
    }
    .inline .unit {
      padding-bottom: 7px;
      font-size: 15px;
      font-weight: 700;
      color: var(--color-neutral-600);
    }
    .presets {
      display: flex;
      align-items: center;
      margin-left: auto;
      padding-bottom: 3px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .preset {
      all: unset;
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      color: var(--color-neutral-800);
      font-variant-numeric: tabular-nums;
      cursor: pointer;
    }
    .preset + .preset::before {
      content: '·';
      margin: 0 8px;
      color: var(--color-neutral-500);
    }
    .preset:hover,
    .preset.on {
      color: var(--color-accent);
    }
    .preset:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
    .inline .hint-line {
      font-size: 13px;
      line-height: 1.45;
      color: var(--color-neutral-600);
      text-wrap: pretty;
    }
  `,
})
export class ParamFieldComponent {
  row = input.required<ParamRow>();
  /** The presets on the value's own line (the run dialog), not under it (the compare dialog). */
  inline = input(false);
  /** What the value means, in words - in place of the API's hint. */
  hint = input<string | null>(null);
  changed = output<string>();
}
