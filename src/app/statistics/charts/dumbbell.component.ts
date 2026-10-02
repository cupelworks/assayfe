import { Component, computed, input } from '@angular/core';
import { StatusMarkComponent } from '../../shared/status-mark.component';
import { along } from './range-chart.component';

/** A against B on one axis: A hollow, B wearing the verdict's mark, the line between them. */
@Component({
  selector: 'assay-dumbbell',
  standalone: true,
  imports: [StatusMarkComponent],
  template: `
    @if (between(); as l) {
      <i class="link" [style.left.%]="l.left" [style.width.%]="l.width"></i>
    }
    @if (aPos() != null) {
      <i class="a" [style.left.%]="aPos()" title="A"></i>
    }
    @if (bPos() != null) {
      <assay-mark class="b" [of]="mark()" [style.left.%]="bPos()" />
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      height: 22px;
    }
    .link {
      position: absolute;
      top: 10px;
      height: 2px;
      background: var(--color-neutral-500);
    }
    .a {
      position: absolute;
      top: 7px;
      width: 8px;
      height: 8px;
      margin-left: -4px;
      background: var(--color-bg);
      box-shadow: inset 0 0 0 1.5px var(--color-text);
    }
    .b {
      position: absolute;
      top: 7px;
      margin-left: -4px;
    }
  `,
})
export class DumbbellComponent {
  /** A's and B's values, on the axis from `min` to `max`; null leaves a side out. */
  a = input<number | null>(null);
  b = input<number | null>(null);
  min = input(0);
  max = input(1);
  /** B's mark: the verdict (better, worse, no_difference…). */
  mark = input<string | null>(null);
  aPos = computed(() => (this.a() == null ? null : along(this.a()!, this.min(), this.max())));
  bPos = computed(() => (this.b() == null ? null : along(this.b()!, this.min(), this.max())));
  between = computed(() => {
    const a = this.aPos(),
      b = this.bPos();
    return a == null || b == null ? null : { left: Math.min(a, b), width: Math.abs(b - a) };
  });
}
