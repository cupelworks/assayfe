import { RunOrigin, TestStatus } from '../api/models';
import { CatalogIndexGroup, CatalogIndexItem } from '../shared/catalog';
import { RUNS_ENDED, UNDER_WAY, statusLabel } from '../shared/format';
import { FilterFacet } from '../shared/work/filters';

/** Runs' statuses in the Overview's order: how it ended, then what is still under way. */
export const RUN_STATUSES = [...RUNS_ENDED, ...UNDER_WAY] as TestStatus[];
/** What each status means for one run: its tile's words. */
const BLURB: Record<string, string> = {
  Green: 'Every check was met.',
  Amber: "Some checks were met, some weren't.",
  Red: 'No check was met.',
  NotRan: 'Nothing could be checked.',
  Running: 'Running now.',
  Pending: 'Created, not yet picked up.',
};
/** The tiles' captions, as the Overview groups the statuses. */
export const RUN_TILE_GROUPS: CatalogIndexGroup[] = [
  { label: 'How it ended', count: RUNS_ENDED.length },
  { label: 'While it runs', count: UNDER_WAY.length },
];
/** Runs' quick filters: a tile per status, with how many runs have it (the API's totals). */
export const runTiles = (counts: Record<string, number> | null): CatalogIndexItem[] =>
  RUN_STATUSES.map((key) => ({
    key,
    mark: key,
    label: statusLabel(key),
    count: counts?.[key] ?? 0,
    blurb: BLURB[key],
  }));
/** The Status facet: the tiles' values - one at a time, as the API filters by one. */
export const statusFacet = (counts: Record<string, number> | null): FilterFacet => ({
  key: 'status',
  label: 'Status',
  sub: 'runs with each',
  single: true,
  values: RUN_STATUSES.map((key) => ({
    key,
    label: statusLabel(key),
    mark: key,
    count: counts ? (counts[key] ?? 0) : null,
  })),
});

/** Where a run was started from. */
export const ORIGINS: RunOrigin[] = ['Standalone', 'TestSet', 'TestPlan'];
export const FROM_LABEL: Record<RunOrigin, string> = {
  Standalone: 'On its own',
  TestSet: 'Test set',
  TestPlan: 'Test plan',
};
/** The From facet: on its own, a set's, a plan's - one at a time, as the API filters by one. */
export const fromFacet = (counts: Record<string, number> | null): FilterFacet => ({
  key: 'from',
  label: 'From',
  sub: 'runs from each',
  single: true,
  values: ORIGINS.map((key) => ({
    key,
    label: FROM_LABEL[key],
    count: counts ? (counts[key] ?? 0) : null,
  })),
});
