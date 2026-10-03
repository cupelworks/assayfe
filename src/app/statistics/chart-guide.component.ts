import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Interval, ScoreSummary, SeriesPoint, StripPoint, TestStatus } from '../api/models';
import { StatusMarkComponent, markLabel } from '../shared/status-mark.component';
import { RangeChartComponent, along } from './charts/range-chart.component';
import { RunStripComponent } from './charts/run-strip.component';
import { RunsGridComponent, GridRow } from './charts/runs-grid.component';
import { RateTrendComponent } from './charts/rate-trend.component';
import { ScorePlotComponent } from './charts/score-plot.component';
import { DumbbellComponent } from './charts/dumbbell.component';
import { diffCaption, pct } from './stats-format';

/** The guide's sections, in order - what the Statistical tests cards and the result pages link to. */
export const CHART_SECTIONS = [
  { id: 'range', label: 'The verdict and its range' },
  { id: 'strip', label: 'The times, as a strip' },
  { id: 'grid', label: 'The runs grid' },
  { id: 'trend', label: 'The met rate over time' },
  { id: 'scores', label: 'Scores' },
  { id: 'compare', label: 'A against B' },
  { id: 'marks', label: 'The marks' },
] as const;
/** A section's element id: `/statistical-tests#chart-range` lands on it. */
export const chartAnchor = (id: string) => `chart-${id}`;

// The examples: what a batch and a comparison would show, with the bounds the API computes
// (exact one-sided at 95% for a 90% target; Newcombe for B − A) - drawn by the app's own charts.
// The checks are named as people name theirs, never by their type.
const point = (index: number, ch: string, score: number | null = null): SeriesPoint => ({
  index,
  run_id: '',
  execution_id: null,
  status: ch === 'n' ? 'NotRan' : ch === 'x' ? 'Amber' : 'Green',
  passed: ch === 'n' ? null : ch === 'm',
  score,
  error: null,
});
/** 29 times: met, not met at 6 and 21, no value at 17 (the run was Not Ran) - so 26 of 28. */
const TIMES = 'mmmmmxmmmmmmmmmmnmmmxmmmmmmmm';
const strip = (statuses: Record<number, TestStatus>): StripPoint[] =>
  Array.from({ length: 29 }, (_, i) => ({
    index: i + 1,
    run_id: '',
    execution_id: null,
    status: statuses[i + 1] ?? 'Green',
  }));
const SCORES = [
  0.41, 0.42, 0.22, 0.24, 0.29, 0.43, 0.26, 0.48, 0.44, 0.4, 0.36, 0.52, 0.58, 0.31, 0.32, 0.55,
  0.27, 0.35, 0.33, 0.46, 0.33, 0.37, 0.38, 0.29, 0.34, 0.39, 0.28, 0.3, 0.5, 0.18,
];
const exact = (lower: number, point: number, upper: number): Interval => ({
  lower,
  point,
  upper,
  method: 'exact',
  level: 0.95,
  sides: 'one',
});

/** A against B, 29 times each: [check, A's rate, B's rate, B − A, its range's ends, verdict]. */
const COMPARE: [string, number, number, number, number, number, string][] = [
  ['Never asks for the PIN', 28 / 29, 20 / 29, -0.276, -0.46, -0.082, 'worse'],
  ['Offers to block the card', 15 / 29, 25 / 29, 0.345, 0.107, 0.537, 'better'],
  ['Mentions the order number', 1, 1, 0, -0.117, 0.117, 'no_difference'],
];

/**
 * "How to read the charts": each chart a batch's or a comparison's page draws, drawn here by the
 * same components with example data, its parts numbered, and how a verdict reads off it. Static -
 * it explains the charts, so it needs nothing from the API.
 */
@Component({
  selector: 'assay-chart-guide',
  standalone: true,
  imports: [
    RouterLink,
    StatusMarkComponent,
    RangeChartComponent,
    RunStripComponent,
    RunsGridComponent,
    RateTrendComponent,
    ScorePlotComponent,
    DumbbellComponent,
  ],
  templateUrl: './chart-guide.component.html',
  styleUrls: ['../shared/page.css', './chart-guide.component.css'],
})
export class ChartGuideComponent {
  anchor = chartAnchor;
  markLabel = markLabel;
  /** The sections, numbered: the row of links under the guide's title, and each section's number. */
  sections = CHART_SECTIONS.map((s, i) => ({ ...s, no: String(i + 1).padStart(2, '0') }));
  rateTicks = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
  gate = [
    {
      name: 'Mentions the order number',
      met: '29 of 29',
      rate: '100%',
      interval: exact(0.901855, 1, 1),
      verdict: 'pass',
    },
    {
      name: 'Replies in English',
      met: '26 of 28',
      rate: '93%',
      interval: exact(0.791795, 0.928571, 0.987159),
      verdict: 'inconclusive',
    },
    {
      name: 'Never asks for the PIN',
      met: '20 of 29',
      rate: '69%',
      interval: exact(0.520988, 0.689655, 0.827535),
      verdict: 'fail',
    },
  ];
  /** Where the range section's numbers 1 (the point) and 2 (the range) sit: on its second row. */
  callouts = (() => {
    const i = this.gate[1].interval;
    const lo = along(i.lower!, 0.5, 1),
      hi = along(i.upper!, 0.5, 1);
    return { point: along(i.point!, 0.5, 1), range: lo + (hi - lo) * 0.12 };
  })();
  /** The strip's times numbered under it, and what it holds. */
  stripIndex = [1, 5, 10, 15, 20, 25, 29];
  stripTally = {
    met: [...TIMES].filter((c) => c === 'm').length,
    notMet: [...TIMES].filter((c) => c === 'x').length,
    none: [...TIMES].filter((c) => c === 'n').length,
  };
  series = [...TIMES].map((ch, i) => point(i + 1, ch));
  grid: GridRow[] = [
    {
      key: 'a',
      name: 'Client shares PIN and card number',
      sub: null,
      testId: null,
      strip: strip({ 6: 'Amber', 21: 'Amber' }),
    },
    {
      key: 'b',
      name: 'Lost card: block first',
      sub: null,
      testId: null,
      strip: strip({ 3: 'Amber', 9: 'Amber', 14: 'Amber', 17: 'Red', 22: 'Amber', 27: 'Amber' }),
    },
    {
      key: 'c',
      name: 'Unrecognised card payment',
      sub: null,
      testId: null,
      strip: strip({ 17: 'NotRan', 24: 'Amber' }),
    },
  ];
  scoreSeries = SCORES.map((s, i) => point(i + 1, s >= 0.3 ? 'm' : 'x', s));
  scores: ScoreSummary = {
    n: 30,
    mean: 0.3667,
    sd: 0.0989,
    min: 0.18,
    max: 0.58,
    p10: 0.258,
    p25: 0.2925,
    median: 0.355,
    p75: 0.4275,
    p90: 0.502,
  };
  scoreInterval: Interval = {
    lower: 0.336,
    point: 0.3667,
    upper: 0.3974,
    method: 't',
    level: 0.95,
    sides: 'one',
  };
  diffTicks = [-0.6, -0.3, 0, 0.3, 0.6];
  compare = COMPARE.map(([name, a, b, d, lo, hi, verdict]) => ({
    name,
    a,
    b,
    d,
    lo,
    hi,
    verdict,
    vals: `${pct(a)} → ${pct(b)}`,
    cap: diffCaption(d, lo, hi, false),
  }));
  batchMarks = [
    { key: 'Passed', text: 'Every check reaches the target.' },
    { key: 'Failed', text: 'At least one check falls short.' },
    { key: 'Inconclusive', text: 'Finished, but too few runs to tell either way.' },
    { key: 'Incomplete', text: 'Stopped before every run ran.' },
    {
      key: 'NotRan',
      text: 'No check could be decided: every run Not Ran, or every check errored.',
    },
  ];
  checkMarks = [
    { key: 'pass', text: 'At or above the target.' },
    { key: 'fail', text: 'Below it.' },
    { key: 'inconclusive', text: 'The target is inside the range.' },
    { key: 'none', text: 'Too few values to decide: none, or fewer than the test needs.' },
  ];
  /** A link in the row under the title: to its section, also when the fragment is already the
   *  route's (the router wouldn't scroll again). */
  go(id: string) {
    setTimeout(() => document.getElementById(chartAnchor(id))?.scrollIntoView());
  }
  compareMarks = [
    { key: 'better', text: 'B met it more often, beyond chance.' },
    { key: 'worse', text: 'B met it less often, beyond chance.' },
    { key: 'no_difference', text: 'None this size can see.' },
    { key: 'no_worse', text: 'At most the margin worse, beyond chance.' },
  ];
}
