// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, input } from '@angular/core';
import { statusColor, statusLabel } from './format';

export type MarkShape = 'filled' | 'hollow' | 'half' | 'framed';
export interface Mark {
  label: string;
  color: string;
  shape: MarkShape;
}

const green = 'var(--color-status-green)';
const red = 'var(--color-accent)';
const grey = 'var(--color-neutral-800)';
const outline = 'var(--color-neutral-600)';
const ink = 'var(--color-text)';

/** The words a batch, a check's verdict and a comparison add to a run's statuses, with their
 *  marks. One colour map with the runs': Passed and Failed are Green's and Red's colours, and
 *  Inconclusive (hollow), Incomplete (half-filled) and Done (framed: a closed square with a filled
 *  centre, in the text's colour - a finished trial, no verdict) differ from the greys by shape,
 *  not shade. */
const MARKS: Record<string, Mark> = {
  // A batch's outcome.
  Passed: { label: 'Passed', color: green, shape: 'filled' },
  Failed: { label: 'Failed', color: red, shape: 'filled' },
  Inconclusive: { label: 'Inconclusive', color: outline, shape: 'hollow' },
  Incomplete: { label: 'Incomplete', color: grey, shape: 'half' },
  Done: { label: 'Done', color: ink, shape: 'framed' },
  // A check's verdict in a batch; `none`: no verdict could be drawn.
  pass: { label: 'Passed', color: green, shape: 'filled' },
  fail: { label: 'Failed', color: red, shape: 'filled' },
  inconclusive: { label: 'Inconclusive', color: outline, shape: 'hollow' },
  none: { label: 'No verdict', color: grey, shape: 'filled' },
  // A comparison's outcome per check.
  better: { label: 'Better', color: green, shape: 'filled' },
  worse: { label: 'Worse', color: red, shape: 'filled' },
  no_difference: { label: 'No clear difference', color: outline, shape: 'hollow' },
  no_worse: { label: 'No worse', color: green, shape: 'filled' },
  // A run's checks, counted (a set's run's tally): met, not met - and Not Ran, a run's own.
  met: { label: 'Met', color: green, shape: 'filled' },
  unmet: { label: 'Not met', color: red, shape: 'filled' },
};

/** The mark of any status word: a run's (Green, Amber, …) or one of the statistics' above. */
export const markOf = (key: string | null | undefined): Mark =>
  MARKS[key ?? 'none'] ?? {
    label: statusLabel(key ?? ''),
    color: statusColor(key ?? ''),
    shape: 'filled',
  };
export const markLabel = (key: string | null | undefined) => markOf(key).label;

/** `<assay-mark of="Inconclusive" />` - the square that stands for a status, verdict or outcome. */
@Component({
  selector: 'assay-mark',
  standalone: true,
  host: {
    'aria-hidden': 'true',
    '[class.mark-hollow]': "mark().shape === 'hollow'",
    '[class.mark-half]': "mark().shape === 'half'",
    '[class.mark-framed]': "mark().shape === 'framed'",
    '[class.mark-md]': "size() === 'md'",
    '[class.mark-lg]': "size() === 'lg'",
    '[style.--mark]': 'mark().color',
  },
  template: '',
  styles: `
    :host {
      display: inline-block;
      flex: none;
      width: 8px;
      height: 8px;
      background: var(--mark);
    }
    :host(.mark-md) {
      width: 10px;
      height: 10px;
    }
    :host(.mark-lg) {
      width: 14px;
      height: 14px;
    }
    :host(.mark-hollow) {
      background: transparent;
      box-shadow: inset 0 0 0 1.5px var(--mark);
    }
    :host(.mark-half) {
      background: linear-gradient(90deg, var(--mark) 50%, transparent 50%);
      box-shadow: inset 0 0 0 1.5px var(--mark);
    }
    :host(.mark-framed) {
      background: linear-gradient(var(--mark), var(--mark)) center / 40% 40% no-repeat;
      box-shadow: inset 0 0 0 1.5px var(--mark);
    }
  `,
})
export class StatusMarkComponent {
  of = input.required<string | null>();
  /** sm 8 px (in text), md 10 px (a point on a chart), lg 14 px. */
  size = input<'sm' | 'md' | 'lg'>('sm');
  mark = computed(() => markOf(this.of()));
}
