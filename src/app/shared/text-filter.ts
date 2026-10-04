import { computed, signal } from '@angular/core';

/**
 * The words a list is searched by: what's being typed (`query`) and the words kept as a token
 * (`kept` - the smart filter's Enter), each looked for on its own. A list that searches what it
 * holds applies them (`TextFilter`); a list the API searches sends `terms()` - its `q`, once each.
 */
export class SearchWords {
  query = signal('');
  /** Words kept as a token (the smart filter's Enter), looked for as well as the query. */
  kept = signal<string | null>(null);
  /** Every word looked for, lower case: the kept words and the query. */
  terms = computed(() =>
    [this.kept(), this.query()].map((t) => (t ?? '').trim().toLowerCase()).filter(Boolean),
  );
  /** What it's looking for, as typed - for "No test matches …". */
  text = computed(() =>
    [this.kept(), this.query()]
      .map((t) => (t ?? '').trim())
      .filter(Boolean)
      .join('" and "'),
  );
}

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
export class TextFilter<T> extends SearchWords {
  constructor(private searchOf: (item: T) => string) {
    super();
  }
  apply(items: T[]): T[] {
    const terms = this.terms();
    return terms.length
      ? items.filter((x) => {
          const text = this.searchOf(x).toLowerCase();
          return terms.every((t) => text.includes(t));
        })
      : items;
  }
}
