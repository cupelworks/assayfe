import { CatalogIndexItem } from '../catalog';
import { FilterFacet } from './filters';

/** The latest verdicts a work list's tiles show, Failed first: what needs looking at. */
const VERDICTS = [
  { key: 'Failed', blurb: 'At least one check fell short of the goal.' },
  { key: 'Inconclusive', blurb: "Can't be told yet: a bigger batch would settle it." },
  { key: 'Passed', blurb: 'Every check met the goal.' },
] as const;
/** Never run with statistics. */
export const NOT_YET = 'none';

/** A list's counts by value - the API's (`GET …/facets`), within the other filters chosen; null
 *  while they're read. */
type Counts = Partial<Record<string, number>> | null | undefined;

/**
 * A work list's quick filters: a tile per latest verdict - Failed, Inconclusive, Passed - and one
 * for the things never run with statistics, each with how many (the API's `latest_verdict`).
 */
export function verdictTiles(counts: Counts): CatalogIndexItem[] {
  return [
    ...VERDICTS.map((v) => ({
      key: v.key,
      mark: v.key,
      label: v.key,
      count: counts?.[v.key] ?? 0,
      blurb: v.blurb,
    })),
    {
      key: NOT_YET,
      dash: true,
      label: 'Not yet',
      count: counts?.[NOT_YET] ?? 0,
      blurb: 'Never run with statistics: no verdict to go by.',
    },
  ];
}

/** The Verdict facet: the tiles' values, under the line. */
export function verdictFacet(counts: Counts): FilterFacet {
  return {
    key: 'verdict',
    label: 'Verdict',
    sub: 'the latest batch',
    values: verdictTiles(counts).map((t) => ({
      key: t.key,
      label: t.label,
      count: counts ? t.count : null,
      mark: t.mark ?? null,
      dash: t.dash,
    })),
  };
}

/** The Latest run facet: a run's statuses, and "Never run" - with how many (the API's
 *  `latest_run`; null while read). */
export function latestRunFacet(counts: Counts): FilterFacet {
  const count = (key: string) => (counts ? (counts[key] ?? 0) : null);
  return {
    key: 'run',
    label: 'Latest run',
    sub: 'outside a batch',
    values: [
      { key: 'Green', label: 'Green', mark: 'Green', count: count('Green') },
      { key: 'Amber', label: 'Amber', mark: 'Amber', count: count('Amber') },
      { key: 'Red', label: 'Red', mark: 'Red', count: count('Red') },
      { key: 'NotRan', label: 'Not Ran', mark: 'NotRan', count: count('NotRan') },
      { key: 'never', label: 'Never run', dash: true, count: count('never') },
    ],
  };
}
