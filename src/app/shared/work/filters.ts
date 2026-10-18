/**
 * The smart filter's words: what a list can be narrowed by (a facet - "Checks", "Latest run"),
 * each facet's values, and which are chosen. The filter itself (`<assay-smart-filter>`) only
 * holds the choice; the page decides what it does with it. Runs sends all of it to the API; the
 * other lists apply their words to the page they show and keep the rest of the choice for when the
 * API takes it.
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

/** When a thing was made, as the Created facet has it: since the reader's midnight, in the last 7
 *  or 30 days, or before that. One at a time - the first three hold one another. */
export const CREATED_VALUES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'In the last 7 days' },
  { key: 'month', label: 'In the last 30 days' },
  { key: 'earlier', label: 'Before that' },
] as const;

/** A Created range's edges, from now: `from` (inclusive) and `to` (not); null leaves that side
 *  open. What a page counts with and what it sends the API (`created_from` / `created_to`), so
 *  the two mean the same "today". */
export function createdRange(
  key: string,
  now = new Date(),
): { from: Date | null; to: Date | null } {
  const ago = (days: number) => new Date(now.getTime() - days * 864e5);
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  switch (key) {
    case 'today':
      return { from: midnight, to: null };
    case 'week':
      return { from: ago(7), to: null };
    case 'month':
      return { from: ago(30), to: null };
    case 'earlier':
      return { from: null, to: ago(30) };
    default:
      return { from: null, to: null };
  }
}

/** A facet of two values as the API's true or false: one chosen - true for `yes`, false for `no`;
 *  both or neither - nothing sent ("Answer: a recorded one" → `has_recorded_answer=true`). */
export function yesNo(keys: readonly string[] | undefined, yes: string, no: string) {
  if (keys?.length !== 1) return null;
  return keys[0] === yes ? 'true' : keys[0] === no ? 'false' : null;
}

/** The Created facet's chosen range as the API's parameters - none chosen: nothing sent. */
export function createdParams(keys: readonly string[] | undefined) {
  const r = createdRange(keys?.[0] ?? '');
  return { created_from: r.from?.toISOString() ?? null, created_to: r.to?.toISOString() ?? null };
}

/** The Created ranges' starting edges, from now - what a list's counts are asked with
 *  (`created_edges`): since midnight, 7 days ago, 30 days ago. */
export function createdEdges(now = new Date()) {
  const at = (key: string) => createdRange(key, now).from!.toISOString();
  return { today: at('today'), week: at('week'), month: at('month') };
}
export type CreatedEdges = ReturnType<typeof createdEdges>;

/** The API's Created counts - from each edge sent, and `before` the earliest - by the facet's
 *  ranges. The API keys each count by the edge as sent; one written another way for the same
 *  moment ("…22:00:00Z" for "…22:00:00.000Z") is found by the instant it names. */
export function createdCounts(
  created: Partial<Record<string, number>> | null | undefined,
  edges: CreatedEdges,
): Record<string, number> | null {
  if (!created) return null;
  const at = (edge: string) => {
    const key =
      edge in created
        ? edge
        : Object.keys(created).find((k) => k !== 'before' && Date.parse(k) === Date.parse(edge));
    return key === undefined ? 0 : (created[key] ?? 0);
  };
  return {
    today: at(edges.today),
    week: at(edges.week),
    month: at(edges.month),
    earlier: created['before'] ?? 0,
  };
}

/** The Created facet, counted from the dates given, or from counts by range (the API's, through
 *  `createdCounts`); null: no counts. */
export function createdFacet(
  from: string[] | Partial<Record<string, number>> | null | undefined,
): FilterFacet {
  const now = new Date();
  const holds = (key: string, iso: string) => {
    const r = createdRange(key, now),
      t = +new Date(iso);
    return (!r.from || t >= +r.from) && (!r.to || t < +r.to);
  };
  const count = (key: string) =>
    !from
      ? null
      : Array.isArray(from)
        ? from.filter((d) => holds(key, d)).length
        : ((from as Partial<Record<string, number>>)[key] ?? 0);
  return {
    key: 'created',
    label: 'Created',
    single: true,
    values: CREATED_VALUES.map((r) => ({ key: r.key, label: r.label, count: count(r.key) })),
  };
}
