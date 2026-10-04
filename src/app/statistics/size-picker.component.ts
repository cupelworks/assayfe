import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OddsPoint } from '../api/models';
import { NumberInputDirective } from '../shared/number';
import { OddsChartComponent } from './charts/odds-chart.component';

/** A size to pick: its title and what it is, its chance of an answer, its calls. */
export interface SizeOption {
  key: string;
  /** "Until there's an answer" - not a fixed size. */
  until: boolean;
  times: number;
  title: string;
  what: string;
  chance: string;
  chanceCap: string;
  app: string;
  judge: string;
  on: boolean;
}

/** The curve beside the sizes: the chance of an answer against the size. */
export interface SizeChart {
  odds: OddsPoint[];
  goal: number;
  picked: OddsPoint | null;
  best: OddsPoint | null;
  app: number;
  judge: number;
}

/**
 * Run with statistics' sizes to pick from (04): a ruled row each, on five of the body's nine
 * columns - its title and what it is, its chance of an answer, its calls; "until there's an
 * answer" says how it goes when picked - then "Another size" to type; beside them, on four, the
 * chance of an answer against the size (`<assay-odds-chart>`), or why there's no curve.
 */
@Component({
  selector: 'assay-size-picker',
  standalone: true,
  imports: [FormsModule, NumberInputDirective, OddsChartComponent],
  host: { '[class.no-chart]': '!chart()' },
  template: `
    <div class="rows" role="radiogroup" [attr.aria-labelledby]="labelledBy()">
      @for (z of sizes(); track z.key) {
        <label class="so" [class.on]="z.on">
          <input
            type="radio"
            name="sp-size"
            [checked]="z.on"
            (change)="z.until ? until.emit() : size.emit(z.times)"
          />
          <span
            ><span class="t">{{ z.title }}</span
            ><span class="small">{{ z.what }}</span></span
          >
          <span class="ch"
            ><span class="fig">{{ z.chance }}</span
            ><span class="small">{{ z.chanceCap }}</span></span
          >
          <span class="calls"
            ><b>{{ z.app }}</b> application<br /><b>{{ z.judge }}</b> judge calls</span
          >
          @if (z.until && z.on) {
            <span class="more">{{ untilText() }}</span>
          }
        </label>
      }
      <label class="so" [class.on]="other()" for="sp-times">
        <input type="radio" name="sp-size" [checked]="other()" tabindex="-1" />
        <span class="other"
          ><span class="t">Another size</span
          ><input
            id="sp-times"
            [class.invalid]="otherInvalid()"
            assayNumber="numeric"
            placeholder="e.g. 100"
            [ngModel]="otherText()"
            (ngModelChange)="typed.emit($event)"
          /><span class="u">times</span></span
        >
      </label>
    </div>
    @if (chart(); as c) {
      <figure class="chart">
        <figcaption class="small-caps">Chance that every check gets an answer</figcaption>
        <assay-odds-chart
          [odds]="c.odds"
          [goal]="c.goal"
          [picked]="c.picked"
          [best]="c.best"
          [appPerTime]="c.app"
          [judgePerTime]="c.judge"
        />
      </figure>
    } @else if (noChart()) {
      <p class="nochart">{{ noChart() }}</p>
    }
  `,
  styleUrls: ['./stats-figures.css', './size-picker.component.css'],
})
export class SizePickerComponent {
  sizes = input.required<readonly SizeOption[]>();
  /** The id of what names the sizes - their section's title. */
  labelledBy = input<string | null>(null);
  /** "Another size" is the one picked; what it shows; whether it can't be. */
  other = input(false);
  otherText = input<string | number>('');
  otherInvalid = input(false);
  /** How "until there's an answer" goes, under it when it's picked. */
  untilText = input('');
  chart = input<SizeChart | null>(null);
  /** Why there's no curve, when there's none. */
  noChart = input<string | null>(null);
  size = output<number>();
  until = output<void>();
  typed = output<string>();
}
