// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { StatusCount, counted, isInFlight } from '../format';

/** What a run's status means, as the Guide says it - a run of one test. */
const RUN_SAYS: Record<string, string> = {
  Pending: 'Created, not yet picked up.',
  Running: 'Running now.',
  Green: 'Every check was met in this run.',
  Amber: "Some checks were met in this run, some weren't.",
  Red: 'No check was met in this run.',
  NotRan: 'Nothing could be checked: something went wrong before any check ran.',
};
export const runSays = (status: string | null | undefined) => RUN_SAYS[status ?? ''] ?? '';

/**
 * How a run of a set or plan went, in a sentence, from its runs counted by status: "Every run met
 * every check.", "5 runs met every check; 4 met some.", "No check was met in either run." - or,
 * while it runs, how far it got.
 */
export function countsSays(counts: StatusCount[]): string {
  const n = (key: string) => counts.find((c) => c.key === key)?.value ?? 0;
  const total = counts.reduce((t, c) => t + c.value, 0);
  if (!total) return '';
  const going = counts.filter((c) => isInFlight(c.key)).reduce((t, c) => t + c.value, 0);
  if (going) return `${total - going} of ${counted(total, 'run')} done so far.`;
  if (n('Green') === total)
    return total === 1
      ? runSays('Green')
      : total === 2
        ? 'Every check was met in both runs.'
        : 'Every run met every check.';
  if (n('Red') === total)
    return total === 1
      ? runSays('Red')
      : total === 2
        ? 'No check was met in either run.'
        : 'No run met a check.';
  const parts = [
    [n('Green'), 'met every check'],
    [n('Amber'), 'met some'],
    [n('Red'), 'met none'],
    [n('NotRan'), "couldn't be checked"],
  ].filter(([k]) => k) as [number, string][];
  return (
    parts
      .map(([k, what], i) => (i === 0 ? `${counted(k, 'run')} ${what}` : `${k} ${what}`))
      .join('; ') + '.'
  );
}

/** "two", "five" - a small count in words, for a page's lede; 11 and up as figures. */
export const inWords = (n: number) =>
  ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ??
  String(n);
