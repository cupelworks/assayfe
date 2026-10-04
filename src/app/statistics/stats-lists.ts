import { BatchStatus, ComparisonOutcome, ScopeFacets, StatsScope } from '../api/models';
import { CatalogStore } from '../api/catalog.store';
import { CatalogIndexGroup, CatalogIndexItem } from '../shared/catalog';
import { UNDER_WAY, displayName, short } from '../shared/format';
import { markLabel } from '../shared/status-mark.component';
import { FilterChoice, FilterFacet } from '../shared/work/filters';
import { StatsScopeQuery } from '../api/statistics-api.service';

/** How a batch ended - the verdicts, then the endings with none - and what is still under way. */
export const BATCHES_ENDED: BatchStatus[] = [
  'Passed',
  'Inconclusive',
  'Failed',
  'NotRan',
  'Incomplete',
  'Done',
];
export const BATCH_STATUSES = [...BATCHES_ENDED, ...UNDER_WAY] as BatchStatus[];
/** What each status means for a batch: its tile's words. */
const BATCH_BLURB: Record<BatchStatus, string> = {
  Passed: 'Every check reaches the target.',
  Inconclusive: 'Not enough runs to tell either way: a bigger batch would likely settle it.',
  Failed: 'At least one check falls short.',
  NotRan: 'No check could be decided.',
  Incomplete: 'Stopped before every run ran. What ran is kept.',
  Done: 'A trial finished: how each check behaves, and no verdict.',
  Running: 'Runs going. No verdict until every run has finished.',
  Pending: 'Created, no run started yet.',
};
/** The tiles' captions, as the Overview's tally groups the statuses. */
export const BATCH_TILE_GROUPS: CatalogIndexGroup[] = [
  { label: 'How it ended', count: BATCHES_ENDED.length },
  { label: 'While it runs', count: UNDER_WAY.length },
];
/** Batches' quick filters: a tile per status, with how many batches have it (the API's counts). */
export const batchTiles = (counts: Partial<Record<string, number>> | null): CatalogIndexItem[] =>
  BATCH_STATUSES.map((key) => ({
    key,
    mark: key,
    label: markLabel(key),
    count: counts?.[key] ?? 0,
    blurb: BATCH_BLURB[key],
  }));
/** The Verdict facet: the tiles' values - several add up (any of them). */
export const verdictFacet = (counts: Partial<Record<string, number>> | null): FilterFacet => ({
  key: 'status',
  label: 'Verdict',
  sub: 'batches with each',
  values: BATCH_STATUSES.map((key) => ({
    key,
    label: markLabel(key),
    mark: key,
    count: counts ? (counts[key] ?? 0) : null,
  })),
});

/** What a comparison showed, the five its checks can add up to; `none` (nothing could be
 *  compared) is a value of the facet only, when there is one. */
export const OUTCOMES: ComparisonOutcome[] = [
  'worse',
  'better',
  'no_worse',
  'inconclusive',
  'no_difference',
];
/** What each outcome means: its tile's words. */
const OUTCOME_BLURB: Record<ComparisonOutcome, string> = {
  worse: 'At least one check got worse.',
  better: 'At least one check got better, and none worse.',
  no_worse: 'Every check is at least as good as before.',
  inconclusive: "Can't tell yet: bigger batches would settle it.",
  no_difference: 'No check changed clearly either way.',
  none: 'Nothing could be compared.',
};
/** An outcome's word: "Worse", "No clear difference" - "Nothing compared" for `none`. */
export const outcomeLabel = (o: ComparisonOutcome) =>
  o === 'none' ? 'Nothing compared' : markLabel(o);
export const OUTCOME_TILE_GROUPS: CatalogIndexGroup[] = [
  { label: 'What it showed', count: OUTCOMES.length },
];
/** Comparisons' quick filters: a tile per outcome, with how many comparisons showed it. */
export const outcomeTiles = (counts: Partial<Record<string, number>> | null): CatalogIndexItem[] =>
  OUTCOMES.map((key) => ({
    key,
    mark: key,
    label: outcomeLabel(key),
    count: counts?.[key] ?? 0,
    blurb: OUTCOME_BLURB[key],
  }));
/** The What it showed facet: the tiles' values, and Nothing compared when there is one. */
export const outcomeFacet = (counts: Partial<Record<string, number>> | null): FilterFacet => ({
  key: 'outcome',
  label: 'What it showed',
  sub: 'comparisons with each',
  values: [...OUTCOMES, ...(counts?.['none'] ? (['none'] as const) : [])].map((key) => ({
    key,
    label: outcomeLabel(key),
    mark: key === 'none' ? null : key,
    dash: key === 'none',
    count: counts ? (counts[key] ?? 0) : null,
  })),
});

/** The scope facets, as the API names them: a test, a set, a plan. */
const SCOPE_FACETS: { key: keyof ScopeFacets; label: string }[] = [
  { key: 'test_id', label: 'Test' },
  { key: 'test_set_id', label: 'Test set' },
  { key: 'test_plan_id', label: 'Test plan' },
];
/** The names the scope facets go by: the catalogue's tests, sets and plans (its first page of
 *  each), and the scopes of the rows shown - for one past that page. */
export function scopeNames(store: CatalogStore, shown: readonly StatsScope[]) {
  const names = new Map<string, string>();
  for (const x of [...store.tests(), ...store.sets(), ...store.plans()])
    names.set(x.id, displayName(x.name, x.id));
  for (const s of shown) if (!names.has(s.id)) names.set(s.id, displayName(s.name, s.id));
  return names;
}
/**
 * The Test, Test set and Test plan facets of Batches or Comparisons: the ones that have any (the
 * API's counts, only ids with some) and the ones chosen, by name - `names` maps an id to its own,
 * else "Test 1a2b3c4d". Several of one add up (any of them); a test and a set together match
 * nothing, as a batch has one scope - the counts say so (each facet within the others).
 */
export function scopeFacets(
  counts: ScopeFacets | null,
  choice: FilterChoice,
  names: ReadonlyMap<string, string>,
  sub: string,
): FilterFacet[] {
  return SCOPE_FACETS.map(({ key, label }) => {
    const have = counts?.[key] ?? {},
      ids = new Set([...Object.keys(have), ...(choice[key] ?? [])]);
    return {
      key,
      label,
      sub,
      many: true,
      values: [...ids]
        .map((id) => ({
          key: id,
          label: names.get(id) ?? `${label} ${short(id)}`,
          count: counts ? (have[id] ?? 0) : null,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
  });
}
/** The scope facets' choice as the API's parameters - each repeatable. */
export const scopeParams = (c: FilterChoice): StatsScopeQuery => ({
  test_id: c['test_id'],
  test_set_id: c['test_set_id'],
  test_plan_id: c['test_plan_id'],
});
