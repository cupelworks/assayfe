import { Component } from '@angular/core';
import { Interval, ScoreSummary, SeriesPoint, StripPoint, TestStatus } from '../api/models';
import { StatusMarkComponent, markLabel } from '../shared/status-mark.component';
import { RangeChartComponent } from './charts/range-chart.component';
import { RunStripComponent } from './charts/run-strip.component';
import { RunsGridComponent, GridRow } from './charts/runs-grid.component';
import { RateTrendComponent } from './charts/rate-trend.component';
import { ScorePlotComponent } from './charts/score-plot.component';
import { DumbbellComponent } from './charts/dumbbell.component';

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
const point = (index: number, ch: string, score: number | null = null): SeriesPoint => ({
  index,
  run_id: '',
  execution_id: null,
  status: ch === 'n' ? 'NotRan' : ch === 'x' ? 'Amber' : 'Green',
  passed: ch === 'n' ? null : ch === 'm',
  score,
  error: null,
});
/** 29 times: met, not met at 6 and 21, no value at 17 (the run was Not Ran). */
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

/**
 * "How to read the charts": each chart a batch's or a comparison's page draws, drawn here by the
 * same components with example data, its parts numbered, and how a verdict reads off it. Static -
 * it explains the charts, so it needs nothing from the API.
 */
@Component({
  selector: 'assay-chart-guide',
  standalone: true,
  imports: [
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
  rateTicks = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
  gate = [
    { name: 'Contains', met: '29 of 29', interval: exact(0.902, 1, 1), verdict: 'pass' },
    {
      name: 'JSON Field Equals',
      met: '27 of 29',
      interval: exact(0.798, 0.931, 0.988),
      verdict: 'inconclusive',
    },
    {
      name: 'Regex Must Not Match',
      met: '20 of 29',
      interval: exact(0.521, 0.69, 0.828),
      verdict: 'fail',
    },
  ];
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
  compare = [
    {
      name: 'Regex Must Not Match',
      a: 28 / 29,
      b: 20 / 29,
      d: -0.276,
      lo: -0.46,
      hi: -0.082,
      verdict: 'worse',
      text: '-27.6 points · -46 to -8.2',
    },
    {
      name: 'Regex Match',
      a: 15 / 29,
      b: 25 / 29,
      d: 0.345,
      lo: 0.107,
      hi: 0.537,
      verdict: 'better',
      text: '+34.5 points · +10.7 to +53.7',
    },
    {
      name: 'Contains',
      a: 1,
      b: 1,
      d: 0,
      lo: -0.117,
      hi: 0.117,
      verdict: 'no_difference',
      text: '0 points · -11.7 to +11.7',
    },
  ];
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
  compareMarks = [
    { key: 'better', text: 'B met it more often, beyond chance.' },
    { key: 'worse', text: 'B met it less often, beyond chance.' },
    { key: 'no_difference', text: 'None this size can see.' },
    { key: 'no_worse', text: 'At most the margin worse, beyond chance.' },
  ];
}
