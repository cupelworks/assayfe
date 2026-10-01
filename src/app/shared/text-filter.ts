import { signal } from '@angular/core';

/**
 * A text-filter query signal + substring match over one item at a time - the `filter` signal +
 * `toLowerCase().includes(...)` search that kept getting copy-pasted per list page (datasets,
 * test sets/plans, tests), differing only in which field(s) each one searches. An empty query
 * matches everything. Composes with `DateSort` rather than folding sorting in too - each is its
 * own small piece: `sort.apply(filter.apply(items))`.
 *
 * Doesn't try to cover the catalogue/picker pages (`test-types.component.ts`,
 * `checks-table.component.ts`'s type picker) - those combine text search with category chips and other
 * criteria in ways that are genuinely per-page, not a variant of this.
 */
export class TextFilter<T> {
  query = signal('');
  constructor(private searchOf: (item: T) => string) {}
  apply(items: T[]): T[] {
    const f = this.query().toLowerCase();
    return f ? items.filter((x) => this.searchOf(x).toLowerCase().includes(f)) : items;
  }
}
