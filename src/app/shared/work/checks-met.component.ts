// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, computed, input } from '@angular/core';
import { RunChecks, TestTypeResult } from '../../api/models';
import { isInFlight, listed } from '../format';
import { runSays } from './sentences';

/** A run's checks, counted: how many were met of how many, which weren't (by label), and - when
 *  none could be checked - why. */
export interface ChecksMet {
  status: string;
  met: number;
  total: number;
  notMet: string[];
  error: string | null;
}
/** A run's details counted, with every check's label too - what its page says of the ones met. */
export interface ChecksRead extends ChecksMet {
  names: string[];
}

/** A run's details, counted - `results` keyed by each check's label. A check that couldn't run
 *  (`errored`) wasn't met either. */
export function checksMet(d: {
  status: string;
  results?: Record<string, TestTypeResult> | null;
  error?: string | null;
}): ChecksRead {
  const results = Object.entries(d.results ?? {});
  return {
    status: d.status,
    met: results.filter(([, r]) => r.passed).length,
    total: results.length,
    names: results.map(([label]) => label),
    notMet: results.filter(([, r]) => !r.passed).map(([label]) => label),
    error: d.error ?? null,
  };
}

/** A run as a list has it - its checks counted by the API (`checks`: none while it's under way, or
 *  when it couldn't run) and why it couldn't run - as the cell shows it. The same rule as
 *  `checksMet`: a check that failed or couldn't run wasn't met. */
export function checksListed(r: {
  status: string;
  checks?: RunChecks | null;
  error?: string | null;
}): ChecksMet {
  return {
    status: r.status,
    met: r.checks?.met ?? 0,
    total: r.checks?.total ?? 0,
    notMet: r.checks?.not_met ?? [],
    error: r.error ?? null,
  };
}

/** "2 of 2 met", "1 of 2 met - Regex Match wasn't", "0 of 2 met - BERTScore and ROUGE
 *  weren't"; past three not met, how many: "2 of 14 met - 12 weren't". */
export function checksMetSays(c: ChecksMet): string {
  if (!c.total) return 'No checks to meet.';
  const no = c.notMet;
  const head = `${c.met} of ${c.total} met`;
  if (!no.length) return head;
  return `${head} - ${no.length <= 3 ? listed(no) : no.length} ${no.length === 1 ? "wasn't" : "weren't"}`;
}

/**
 * A run's checks, as a list's cell says them: a bar - met in green, not met in red - over "1 of 2
 * met - Regex Match wasn't"; when nothing could be checked, the run's error as written (Not Ran);
 * while it runs, what it's doing. "…" while the run is read; `failed`: it couldn't be.
 */
@Component({
  selector: 'assay-checks-met',
  standalone: true,
  template: `
    @if (checks(); as c) {
      @if (c.status === 'NotRan') {
        <span class="err">{{ said() }}</span>
      } @else {
        @if (bar(); as b) {
          <span class="seg" aria-hidden="true"
            ><i class="ok" [style.width.%]="b.ok"></i><i class="no" [style.width.%]="b.no"></i
          ></span>
        }
        <span class="t">{{ said() }}</span>
      }
    } @else {
      <span class="t wait">{{ failed() ? "Couldn't be read." : '…' }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 7px;
      min-width: 0;
    }
    .seg {
      display: flex;
      width: var(--met-bar, 140px);
      max-width: 100%;
      height: 6px;
      background: color-mix(in srgb, var(--color-text) 14%, transparent);
    }
    .seg i {
      display: block;
      height: 6px;
    }
    .ok {
      background: var(--color-status-green);
    }
    .no {
      background: var(--color-accent);
    }
    .t {
      color: var(--color-neutral-900);
      text-wrap: pretty;
    }
    .wait {
      color: var(--color-neutral-600);
    }
    .err {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12.5px;
      line-height: 1.5;
      color: var(--color-text);
      overflow-wrap: anywhere;
    }
  `,
})
export class ChecksMetComponent {
  /** The run's checks, counted (`checksMet`, `checksListed`); null while it's read. */
  checks = input<ChecksMet | null>(null);
  /** The run couldn't be read. */
  failed = input(false);
  said = computed(() => {
    const c = this.checks();
    if (!c) return '';
    if (c.status === 'NotRan') return c.error || runSays('NotRan');
    if (isInFlight(c.status)) return runSays(c.status);
    return checksMetSays(c);
  });
  /** The bar's two parts, as shares of every check - none while it runs or with no checks. */
  bar = computed(() => {
    const c = this.checks();
    if (!c || !c.total || isInFlight(c.status)) return null;
    return { ok: (c.met / c.total) * 100, no: ((c.total - c.met) / c.total) * 100 };
  });
}
