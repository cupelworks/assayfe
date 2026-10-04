import { Observable, catchError, forkJoin, map, of } from 'rxjs';

/**
 * Who holds each of these - the sets holding a copy of each ticked test, the plans linking each
 * ticked set - read once each, when a pick dialog opens (API 2.0's reverse lookups): holder id →
 * the ids it holds. One that can't be read holds nothing here; the API still refuses a double.
 */
export function holdersOf(
  ids: readonly string[],
  read: (id: string) => Observable<string[]>,
): Observable<Map<string, Set<string>>> {
  if (!ids.length) return of(new Map());
  return forkJoin(ids.map((id) => read(id).pipe(catchError(() => of<string[]>([]))))).pipe(
    map((lists) => {
      const held = new Map<string, Set<string>>();
      lists.forEach((holders, i) => {
        for (const h of holders) held.set(h, (held.get(h) ?? new Set()).add(ids[i]));
      });
      return held;
    }),
  );
}
