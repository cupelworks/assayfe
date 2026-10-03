import { TallyPart, TallyRow } from '../shared/status-tally.component';

/** How many rows each of the Overview's sections shows: the latest 5. */
export const LATEST = 5;
/** The batches the verdicts summary counts: the last 100 (GET /statistics/batches's own page). */
export const BATCH_SAMPLE = 100;

/** A tally's two parts: how things ended, then what is still under way - as the Guide groups the
 *  statuses. Each verdict sits level with the run status it matches (Passed with Green, Failed with
 *  Red, Not Ran with Not Ran). */
export const VERDICTS_ENDED = ['Passed', 'Inconclusive', 'Failed', 'NotRan'];
export const RUNS_ENDED = ['Green', 'Amber', 'Red', 'NotRan'];
const UNDER_WAY = ['Running', 'Pending'];

/**
 * A summary's tally of statuses: each status in `ended`, then Running and Pending, counted in
 * `statuses`; a row leads where `link` says, or nowhere yet.
 */
export function tallyParts(
  statuses: string[],
  ended: string[],
  link?: (key: string) => Pick<TallyRow, 'link' | 'query'>,
): TallyPart[] {
  const row = (key: string): TallyRow => ({
    key,
    count: statuses.filter((s) => s === key).length,
    ...link?.(key),
  });
  return [
    { label: 'How it ended', rows: ended.map(row) },
    { label: 'While it runs', rows: UNDER_WAY.map(row) },
  ];
}
