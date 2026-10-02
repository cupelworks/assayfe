import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SeriesPoint, StatsScope } from '../../api/models';
import { runLink } from '../stats-format';

/** What one time of a check was: met, not met, or no value (errored, or the run Not Ran). */
export function pointText(p: SeriesPoint): string {
  if (p.passed === true) return 'met';
  if (p.passed === false) return 'not met';
  return p.error ? `couldn't run: ${p.error}` : 'Not Ran';
}

/** A check's times as a strip - met, not met, no value - each opening its run. */
@Component({
  selector: 'assay-run-strip',
  standalone: true,
  imports: [RouterLink],
  template: `@for (p of series(); track p.index) {
    <a
      class="s"
      [class.m]="p.passed === true"
      [class.x]="p.passed === false"
      [routerLink]="link(p)"
      [title]="'Time ' + p.index + ': ' + text(p)"
      [attr.aria-label]="'Time ' + p.index + ': ' + text(p)"
    ></a>
  }`,
  // One line of squares that share the width - up to 50 a line, more wrap.
  host: { '[style.grid-template-columns]': "'repeat(' + columns() + ', minmax(0, 1fr))'" },
  styles: `
    :host {
      display: grid;
      gap: 2px;
      max-width: 400px;
    }
    .s {
      height: 14px;
      min-width: 2px;
      display: block;
      background: var(--color-neutral-800);
    }
    .s.m {
      background: var(--color-status-green);
    }
    .s.x {
      background: var(--color-accent);
    }
    .s:hover,
    .s:focus-visible {
      outline: 2px solid var(--color-text);
      outline-offset: 1px;
    }
  `,
})
export class RunStripComponent {
  series = input.required<SeriesPoint[]>();
  scope = input.required<StatsScope>();
  testId = input<string | null>(null);
  columns = computed(() => Math.max(1, Math.min(this.series().length, 50)));
  text = pointText;
  link(p: SeriesPoint) {
    return runLink(this.scope(), p, this.testId());
  }
}
