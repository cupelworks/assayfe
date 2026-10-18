// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Signal, WritableSignal, inject, linkedSignal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FilterChoice } from './filters';

/** A value of the address's ?status= (or ?origin=, ?outcome=): once, several times, or not
 *  there - as withComponentInputBinding() binds it. */
export type Several<T> = T | T[] | undefined;
export const several = <T>(v: Several<T>): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const same = (a: readonly string[], b: readonly string[]) => a.join(' ') === b.join(' ');

/** A work list's choice, some of whose facets are kept in the address. */
export interface AddressChoice {
  /** The choice: the address's facets as it says, the others kept as chosen. */
  choice: WritableSignal<FilterChoice>;
  /** A new choice, its addressed facets put in the address. */
  choose: (c: FilterChoice) => void;
}

/**
 * A work list's choice when some of its facets are in the address - Runs' statuses and origins,
 * Batches' verdicts, Comparisons' outcomes - so another page can open it at one (the Overview's
 * tallies) and the browser's Back goes back to it. `address`: those facets' values as the address
 * gives them, by facet key; `params`: each of those facets' query key (`from` → `origin`). Call it
 * in a field initializer: it injects the router.
 */
export function addressChoice(
  address: Signal<FilterChoice>,
  params: Record<string, string>,
): AddressChoice {
  const router = inject(Router),
    route = inject(ActivatedRoute);
  const choice = linkedSignal<FilterChoice, FilterChoice>({
    source: address,
    computation: (a, prev) => ({ ...(prev?.value ?? {}), ...a }),
  });
  return {
    choice,
    choose: (c) => {
      choice.set(c);
      const now = address(),
        keys = Object.keys(params);
      if (keys.every((k) => same(c[k] ?? [], now[k] ?? []))) return;
      router.navigate([], {
        relativeTo: route,
        queryParams: Object.fromEntries(keys.map((k) => [params[k], c[k]?.length ? c[k] : null])),
        queryParamsHandling: 'merge',
      });
    },
  };
}
