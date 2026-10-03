import { signal } from '@angular/core';

/**
 * A text-filter query signal + substring match over one item at a time - the `filter` signal +
 * `toLowerCase().includes(...)` search that kept getting copy-pasted per list page (datasets,
 * test sets/plans, tests), differing only in which field(s) each one searches. An empty query
 * matches everything. Composes with `DateSort` rather than folding sorting in too - each is its
 * own small piece: `sort.apply(filter.apply(items))`.
 *
 * The catalogue pages (Test types, Statistical tests) search with it too, beside their own index
 * of categories or kinds. Doesn't try to cover `checks-table.component.ts`'s type picker, which
 * combines text search with category chips and other criteria in a way that's its own.
 */
export class TextFilter<T> {
  query = signal('');
  constructor(private searchOf: (item: T) => string) {}
  apply(items: T[]): T[] {
    const f = this.query().toLowerCase();
    return f ? items.filter((x) => this.searchOf(x).toLowerCase().includes(f)) : items;
  }
}
