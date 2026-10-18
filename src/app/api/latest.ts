// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { LatestBatch, LatestExecution, LatestStandaloneRun } from './models';
import { StatusCount, isInFlight, statusCountsOf } from '../shared/format';
import { pollWhile, whenTabShown } from '../shared/poll';
import { BATCH_POLL_MS } from '../statistics/stats-format';

/**
 * The newest item of each key, in the list's order - the latest verdict, run or comparison of each
 * test, set or plan, from a list that comes newest first - and how many items had that key.
 */
export function firstOfEach<T>(items: T[], key: (item: T) => string) {
  const firsts = new Map<string, { item: T; count: number }>();
  for (const item of items) {
    const k = key(item);
    const seen = firsts.get(k);
    if (seen) seen.count++;
    else firsts.set(k, { item, count: 1 });
  }
  return [...firsts.values()];
}

/** How an item stands, as the API lists it (API 2.0): its latest verdict and its latest run - a
 *  test's own, or a set's or plan's run of every test. */
export interface Standing {
  latest_batch?: LatestBatch | null;
  latest_run?: LatestStandaloneRun | null;
  latest_execution?: LatestExecution | null;
}

/** An item's latest run as a list's cell shows it (`<assay-latest-status>`): a test's one status,
 *  or a set's or plan's run counted by status; when; its run's id, to open it; whether it replayed
 *  an earlier one. Null: never run outside a batch. */
export interface LatestRun {
  status: string | null;
  counts: StatusCount[];
  at: string;
  id: string;
  replayed: boolean;
}
export function latestRunOf(x: Standing): LatestRun | null {
  if (x.latest_run)
    return {
      status: x.latest_run.status,
      counts: [],
      at: x.latest_run.created_at,
      id: x.latest_run.id,
      replayed: false,
    };
  if (x.latest_execution)
    return {
      status: null,
      counts: statusCountsOf(x.latest_execution.runs),
      at: x.latest_execution.created_at,
      id: x.latest_execution.id,
      replayed: x.latest_execution.replayed,
    };
  return null;
}

/** A run of an item's still under way: a test's run, or any of a set's or plan's. */
const runUnderWay = (x: Standing) =>
  isInFlight(x.latest_run?.status) ||
  Object.entries(x.latest_execution?.runs ?? {}).some(([status, n]) => isInFlight(status) && !!n);

/**
 * Keeps a list's standings fresh, as the pages that show them are: `read` again every 2 seconds
 * while a row's latest run is under way, every 3 while its latest batch is, and when the tab comes
 * back into view ("Run with statistics ↗" opens its own). Call it in a field initializer or a
 * constructor.
 */
export function refreshStandings(rows: () => readonly Standing[], read: () => void) {
  pollWhile(() => rows().some(runUnderWay), read);
  pollWhile(() => rows().some((x) => isInFlight(x.latest_batch?.status)), read, BATCH_POLL_MS);
  whenTabShown(read);
}
