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

/** How many of a list's things have each latest verdict - `latest` maps a thing to its latest
 *  batch's status - and how many have none of them ("Not yet": never run with statistics). */
function verdictCounts(latest: Map<string, string>, total: number) {
  const count = (key: string) => [...latest.values()].filter((s) => s === key).length;
  return {
    ...Object.fromEntries(VERDICTS.map((v) => [v.key, count(v.key)])),
    [NOT_YET]: Math.max(0, total - latest.size),
  } as Record<string, number>;
}

/**
 * A work list's quick filters: a tile per latest verdict - Failed, Inconclusive, Passed - and one
 * for the things never run with statistics, each with how many.
 */
export function verdictTiles(latest: Map<string, string>, total: number): CatalogIndexItem[] {
  const counts = verdictCounts(latest, total);
  return [
    ...VERDICTS.map((v) => ({
      key: v.key,
      mark: v.key,
      label: v.key,
      count: counts[v.key],
      blurb: v.blurb,
    })),
    {
      key: NOT_YET,
      dash: true,
      label: 'Not yet',
      count: counts[NOT_YET],
      blurb: 'Never run with statistics: no verdict to go by.',
    },
  ];
}

/** The Verdict facet: the tiles' values, under the line. */
export function verdictFacet(latest: Map<string, string>, total: number): FilterFacet {
  return {
    key: 'verdict',
    label: 'Verdict',
    sub: 'the latest batch',
    values: verdictTiles(latest, total).map((t) => ({
      key: t.key,
      label: t.label,
      count: t.count,
      mark: t.mark ?? null,
      dash: t.dash,
    })),
  };
}

/** The Latest run facet: a run's statuses, and "Never run" - with how many, when known. */
export function latestRunFacet(latest: Map<string, string> | null, total: number): FilterFacet {
  const count = (key: string) =>
    latest ? [...latest.values()].filter((s) => s === key).length : null;
  return {
    key: 'run',
    label: 'Latest run',
    sub: 'outside a batch',
    values: [
      { key: 'Green', label: 'Green', mark: 'Green', count: count('Green') },
      { key: 'Amber', label: 'Amber', mark: 'Amber', count: count('Amber') },
      { key: 'Red', label: 'Red', mark: 'Red', count: count('Red') },
      { key: 'NotRan', label: 'Not Ran', mark: 'NotRan', count: count('NotRan') },
      {
        key: 'never',
        label: 'Never run',
        dash: true,
        count: latest ? Math.max(0, total - latest.size) : null,
      },
    ],
  };
}
