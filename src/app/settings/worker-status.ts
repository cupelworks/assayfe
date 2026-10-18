// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { WorkerHealth, WorkerHealthStatus } from '../api/models';

/** How each status reads - the verdict, its run-status dot and what the user should do. The
 *  sentences are the backend's meaning of each status, in the page's words. */
export const WORKER_STATUS: Record<
  WorkerHealthStatus,
  { label: string; color: string; text: string }
> = {
  ready: {
    label: 'Ready',
    color: 'var(--color-status-green)',
    text: 'The broker is reachable and every worker runs the current code. Nothing to do.',
  },
  outdated: {
    label: 'Restart needed',
    color: 'var(--color-status-amber)',
    text:
      'At least one worker runs older code than the API, so work it picks up can fail or wait ' +
      'forever. Restart the workers marked below on the current code.',
  },
  no_worker: {
    label: 'No workers',
    color: 'var(--color-accent)',
    text: 'The broker is reachable but no worker answered, so runs and checks wait in the queue. Start a worker.',
  },
  broker_unreachable: {
    label: 'Broker unreachable',
    color: 'var(--color-accent)',
    text:
      "The queue (Redis) can't be reached: runs stay Pending, and connection tests complete " +
      'at once as not sent.',
  },
};

/** Each status as a run's mark: ready green, a restart amber, no worker or no broker red. */
export const WORKER_MARK: Record<WorkerHealthStatus, string> = {
  ready: 'Green',
  outdated: 'Amber',
  no_worker: 'Red',
  broker_unreachable: 'Red',
};

/** Workers the user has to restart - the ones the API reports a problem for. */
export const workersToRestart = (h: WorkerHealth) => h.workers.filter((w) => w.problem != null);
