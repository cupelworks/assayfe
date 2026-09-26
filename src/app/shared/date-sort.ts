import { signal } from '@angular/core';

/**
 * A single-column newest-first/oldest-first toggle over one date field - the signal, the toggle,
 * and the comparator, in one place instead of copy-pasted per component (RunsListComponent and
 * ScopesListComponent each had an identical version of this before). Client-side only: every list
 * here is returned newest-first with no sort param of its own, so `apply()` only reorders whatever
 * page is currently loaded, not the underlying dataset across pages.
 *
 * Doesn't cover a competing multi-column sort like execution.component.ts's Created/Executed
 * toggle (which also has to decide where a null date sorts) - that's a genuinely different shape,
 * not a variant of this one, so it keeps its own sortKey/sortDir fields rather than being forced
 * through this class.
 */
export class DateSort<T> {
  dir = signal<'desc' | 'asc'>('desc');
  constructor(private dateOf: (item: T) => string) {}
  toggle() {
    this.dir.update((d) => (d === 'desc' ? 'asc' : 'desc'));
  }
  apply(items: T[]): T[] {
    const dir = this.dir();
    return [...items].sort((a, b) => {
      const diff = new Date(this.dateOf(a)).getTime() - new Date(this.dateOf(b)).getTime();
      return dir === 'asc' ? diff : -diff;
    });
  }
}
