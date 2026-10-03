import { RUNS_ENDED } from '../shared/format';
import { tallyParts } from '../shared/status-tally.component';

/** How many rows each of the Overview's sections shows: the latest 5. */
export const LATEST = 5;
/** The batches the verdicts summary counts: the last 100 (GET /statistics/batches's own page). */
export const BATCH_SAMPLE = 100;

/** A tally's two parts: how things ended, then what is still under way - as the Guide groups the
 *  statuses. Each verdict sits level with the run status it matches (Passed with Green, Failed with
 *  Red, Not Ran with Not Ran). */
export const VERDICTS_ENDED = ['Passed', 'Inconclusive', 'Failed', 'NotRan'];
export { RUNS_ENDED };

export { tallyParts };
