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
        @if (inline()) {
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
  styles: `
    .inline > label {
      font-weight: 600;
      color: var(--color-text);
    }
    .inline .with-unit {
      gap: 6px;
      flex-wrap: wrap;
    }
    .inline .input.num {
      width: 64px;
    }
    .inline .unit {
      margin-right: 4px;
    }
    .preset {
      height: 28px;
      padding: 0 8px;
      border: 1px solid color-mix(in srgb, var(--color-text) 40%, transparent);
      background: transparent;
      color: var(--color-text);
      font: inherit;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
    }
    .preset:hover {
      border-color: var(--color-accent);
    }
    .preset.on {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: var(--color-bg);
    }
    .preset:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
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
