// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Signal, effect, signal, untracked } from '@angular/core';

/**
 * A signal that follows `source` once it has stood still for `ms` - what a list sends to the API
 * as words are typed, so a request isn't made at each key. A value equal to the last one (as JSON)
 * changes nothing. Create it where `effect` can be: a field initializer or a constructor.
 */
export function debounced<T>(source: () => T, ms = 300): Signal<T> {
  const out = signal(untracked(source), {
    equal: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  effect((onCleanup) => {
    const value = source();
    const timer = setTimeout(() => out.set(value), ms);
    onCleanup(() => clearTimeout(timer));
  });
  return out.asReadonly();
}
