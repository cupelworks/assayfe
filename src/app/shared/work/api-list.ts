import { WritableSignal, computed, effect, signal, untracked } from '@angular/core';
import { Observable, map } from 'rxjs';
import { FacetCounts, Page } from '../../api/models';
import { QueryValue } from '../../api/api-base';
import { Paged } from '../paged';
import { SearchWords } from '../text-filter';
import { debounced } from '../debounced';
import { counted, errText } from '../format';
import { FilterChoice, chosenCount, createdCounts, createdEdges } from './filters';

/** A list's query parameters, as `QUERY` sends them (several values of one: the key once each). */
export type ListParams = Record<string, QueryValue>;

export interface ApiListOptions<T, C, P extends ListParams> {
  /** A page of what's asked for. */
  fetch: (params: P, offset: number, limit: number) => Observable<Page<T>>;
  /** The page's choice, words and sort, as the API's parameters - with nothing chosen, what the
   *  whole list is (Runs: `batch=none`). */
  params: (choice: FilterChoice, q: readonly string[], sort: string) => P;
  /** The sort shown first. */
  sort: string;
  limit?: number;
  /** What a count calls them: "run" → "493 runs" - or, when it changes (sets or plans), how. */
  noun: string | (() => string);
  /** The choice, when the page keeps it itself (Runs: some of it from the address). */
  choice?: WritableSignal<FilterChoice>;
  /** The counts beside the filter's values, for what's asked (`GET …/facets`). */
  counts?: (params: P) => Observable<C>;
}

/**
 * A work list the API searches, filters and sorts (API 2.0) - Runs, Tests, Test sets and plans,
 * Datasets: its words (`SearchWords`, each phrase a `q`, sent once they stand still), its facets'
 * choice and its sort, as the page maps them to parameters; the page of results (`Paged`), read
 * again from its first page whenever what's asked changes; the counts beside the filter's values,
 * when the page has them; and how many there are in all - the page's own total with nothing
 * narrowing, else asked once - for "N of M shown". Create it in a field initializer: it starts
 * effects.
 */
export class ApiList<T, C = never, P extends ListParams = ListParams> {
  words = new SearchWords();
  choice: WritableSignal<FilterChoice>;
  sort: WritableSignal<string>;
  /** The words as the API gets them: once they've stood still. */
  private terms = debounced(() => this.words.terms());
  /** What the API is asked. */
  params = computed(() => this.o.params(this.choice(), this.terms(), this.sort()));
  /** Something narrows the list: a facet's choice or words. */
  narrowed = computed(() => chosenCount(this.choice()) > 0 || this.terms().length > 0);
  page: Paged<T>;
  counts = signal<C | null>(null);
  /** Bumped by `refresh()`: the counts read again, as the page is. */
  private version = signal(0);
  /** Every one there is, with nothing narrowing - null until known. */
  everything = signal<number | null>(null);
  /** "N of M shown" when anything narrows, "N runs" without. */
  shownText = computed(() => {
    const n = this.page.total(),
      all = this.everything();
    return this.narrowed() && all != null ? `${n} of ${all} shown` : counted(n, this.noun());
  });

  constructor(private o: ApiListOptions<T, C, P>) {
    this.choice = o.choice ?? signal<FilterChoice>({});
    this.sort = signal(o.sort);
    this.page = new Paged<T>(
      (off, lim) => o.fetch(this.params(), off, lim),
      o.limit ?? 25,
      errText,
    );
    // From the first page, whenever what's asked or the order changes.
    effect(() => {
      this.params();
      // untracked: page.reset() -> reload() reads page's own offset()/limit() signals.
      untracked(() => this.page.reset());
    });
    // Every one there is: the page's total with nothing narrowing, else asked once.
    effect(() => {
      const total = this.page.total(),
        narrowed = this.narrowed();
      if (this.page.loading()) return;
      if (!narrowed) this.everything.set(total);
      else if (untracked(() => this.everything()) == null) this.readEverything();
    });
    // The counts, for what's asked; a newer answer drops the one before it.
    const counts = o.counts;
    if (counts)
      effect((onCleanup) => {
        this.version();
        const sub = counts(this.params()).subscribe({
          next: (c) => this.counts.set(c),
          error: () => this.counts.set(null),
        });
        onCleanup(() => sub.unsubscribe());
      });
  }

  /** The page and its counts, read again - after something changed what the list holds. */
  refresh() {
    this.page.reload();
    this.version.update((v) => v + 1);
  }
  /** What a list with nothing in it says: none at all, or none that matches. */
  empty(none: string) {
    if (this.page.loading() || this.page.total()) return null;
    return this.narrowed()
      ? `No ${this.noun()} matches these filters. Take one out, or clear them all.`
      : none;
  }
  private noun() {
    return typeof this.o.noun === 'function' ? this.o.noun() : this.o.noun;
  }
  private readEverything() {
    this.o.fetch(this.o.params({}, [], this.sort()), 0, 1).subscribe({
      next: (p) => this.everything.set(p.total),
      error: () => {},
    });
  }
}

/** A list's counts (`GET …/facets`), asked with the Created facet's edges (`created_edges`) - its
 *  `created` then counted by the facet's ranges (today, week, month, earlier). */
export function countsWithCreated(
  read: (edges: string[]) => Observable<FacetCounts>,
): Observable<FacetCounts> {
  const edges = createdEdges();
  return read(Object.values(edges)).pipe(
    map((f) => ({ ...f, created: createdCounts(f['created'], edges) })),
  );
}
