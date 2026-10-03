/**
 * The smart filter's words: what a list can be narrowed by (a facet - "Checks", "Latest run"),
 * each facet's values, and which are chosen. The filter itself (`<assay-smart-filter>`) only
 * holds the choice; the page decides what it does with it - today the API filters nothing but
 * pages, so a list applies its words to the page it shows and keeps the rest of the choice for
 * when the API takes it (see docs/to_be_implemented_after_be_version_2/dev_notes.md).
 */

/** One value of a facet: "Amber" with its mark and how many it would leave (null: not known). */
export interface FilterValue {
  key: string;
  label: string;
  count?: number | null;
  /** A status mark beside it ("Amber", "Failed"), or a dash ("Never run"). */
  mark?: string | null;
  dash?: boolean;
}

/** A facet: a kind of filter, under the line ("Checks", "Verdict", "Created"). */
export interface FilterFacet {
  key: string;
  label: string;
  /** Beside its panel's title, small: what its counts count ("tests with each"). */
  sub?: string;
  values: FilterValue[];
  /** Many values: its panel has a line to find one, and shows the first ten. */
  many?: boolean;
  /** One value at a time (a date range), not several. */
  single?: boolean;
}

/** The chosen values, by facet key. */
export type FilterChoice = Record<string, string[]>;

/** A thing the typed words name, to open it ("Tests: Refund Request…" → its page). */
export interface FilterItem {
  label: string;
  link: unknown[];
}

/** How many values a chosen facet keeps, and the facets with any chosen. */
export const chosenCount = (choice: FilterChoice) =>
  Object.values(choice).reduce((n, keys) => n + keys.length, 0);

/** When a thing was made, as the Created facet counts it: the latest range that holds it. */
export const CREATED_VALUES = [
  { key: 'today', label: 'Today', days: 1 },
  { key: 'week', label: 'In the last 7 days', days: 7 },
  { key: 'month', label: 'In the last 30 days', days: 30 },
  { key: 'earlier', label: 'Before that', days: Infinity },
] as const;

/** The Created facet, its counts from the dates given (null when the list has none - tests). */
export function createdFacet(dates: string[] | null): FilterFacet {
  const ages = dates?.map((iso) => (Date.now() - +new Date(iso)) / 864e5) ?? null;
  return {
    key: 'created',
    label: 'Created',
    single: true,
    values: CREATED_VALUES.map((r, i) => ({
      key: r.key,
      label: r.label,
      count: ages
        ? ages.filter((d) => (r.days === Infinity ? d >= CREATED_VALUES[i - 1].days : d < r.days))
            .length
        : null,
    })),
  };
}
