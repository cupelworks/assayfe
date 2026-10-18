// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input, model, output } from '@angular/core';
import { StatusMarkComponent } from '../status-mark.component';
import { FilterFacet, FilterValue } from './filters';

/**
 * A facet's panel, opened under its name in the smart filter: its name and what its counts count,
 * a line to find a value when it has many, its values to tick - a radio each for a one-value facet
 * - with their marks and counts (one that would leave none can't be ticked), how many more there
 * are, then Clear and Done. It holds no choice: it says what was ticked (`pick`) and the smart
 * filter keeps it. The sheet it opens in (`.pop`) is the smart filter's.
 */
@Component({
  selector: 'assay-facet-panel',
  standalone: true,
  imports: [StatusMarkComponent],
  host: {
    role: 'group',
    '[attr.aria-label]': 'facet().label',
    '[class.wide]': '!!facet().many',
  },
  template: `
    <div class="ph">
      <b>{{ facet().label }}</b>
      @if (facet().sub) {
        <span>{{ facet().sub }}</span>
      }
    </div>
    @if (facet().many) {
      <div class="pfind">
        <input
          type="text"
          [attr.aria-label]="'Find ' + facet().label.toLowerCase()"
          [placeholder]="'Find ' + facet().label.toLowerCase()"
          [value]="find()"
          (input)="find.set($any($event.target).value)"
        />
      </div>
    }
    @for (v of values(); track v.key) {
      <label class="opt" [class.on]="isOn(v.key)" [class.zero]="v.count === 0">
        <input
          class="chk"
          [type]="facet().single ? 'radio' : 'checkbox'"
          [name]="group()"
          [checked]="isOn(v.key)"
          [disabled]="v.count === 0"
          (change)="pick.emit(v.key)"
        />
        <span class="om">
          @if (v.mark) {
            <assay-mark [of]="v.mark" />
          } @else if (v.dash) {
            <i class="dash"></i>
          }
        </span>
        <span class="ol">{{ v.label }}</span>
        @if (v.count != null) {
          <span class="oc">{{ v.count }}</span>
        }
      </label>
    }
    @if (more(); as m) {
      <span class="more">{{ m }}</span>
    }
    <div class="pf">
      <button type="button" class="go" [disabled]="!chosen().length" (click)="clear.emit()">
        Clear
      </button>
      <button type="button" class="go" (click)="done.emit()">Done</button>
    </div>
  `,
  styleUrls: ['./sheet.css', './facet-panel.component.css'],
})
export class FacetPanelComponent {
  facet = input.required<FilterFacet>();
  /** Its values' group name, unique on the page (a one-value facet's are radios). */
  group = input.required<string>();
  /** The values it shows: those its find line names, the first ten of many. */
  values = input.required<readonly FilterValue[]>();
  /** The ticked values' keys. */
  chosen = input<readonly string[]>([]);
  /** Under the values: how many more there are, or that none has that name. */
  more = input('');
  /** What's typed in its find line. */
  find = model('');
  pick = output<string>();
  clear = output<void>();
  done = output<void>();

  isOn(key: string) {
    return this.chosen().includes(key);
  }
}
