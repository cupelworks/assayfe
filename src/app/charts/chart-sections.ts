// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
/** The Charts page's sections, in order - what the Statistical tests cards and the result pages
 *  link to. */
export const CHART_SECTIONS = [
  { id: 'range', label: 'The verdict and its range' },
  { id: 'strip', label: 'The times, as a strip' },
  { id: 'grid', label: 'The runs grid' },
  { id: 'trend', label: 'The met rate over time' },
  { id: 'scores', label: 'Scores' },
  { id: 'compare', label: 'A against B' },
  { id: 'marks', label: 'The marks' },
] as const;
export const CHART_ANCHOR = 'chart-';
/** A section's element id: `/charts#chart-range` lands on it. */
export const chartAnchor = (id: string) => CHART_ANCHOR + id;
