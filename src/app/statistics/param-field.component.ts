import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NumberInputDirective } from '../shared/number';
import { ParamRow } from './stats-params';

/** One statistical test parameter as a form field: label, value with its unit, the presets
 *  beside it, and its hint - or its problem. */
@Component({
  selector: 'assay-param-field',
  standalone: true,
  imports: [FormsModule, NumberInputDirective],
  template: `
    <div class="field">
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
      </div>
      @if (row().presets.length) {
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
        <div class="hint-line">{{ row().p.hint }}</div>
      }
    </div>
  `,
  styleUrl: './stats-form.css',
})
export class ParamFieldComponent {
  row = input.required<ParamRow>();
  changed = output<string>();
}
