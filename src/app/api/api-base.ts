import { inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { ASSAY_API_BASE } from './api-base.token';
import * as M from './models';

export const PAGE = (offset = 0, limit = 100) => new HttpParams({ fromObject: { offset, limit } });

/** A query parameter's value: one, several, or none. */
export type QueryValue = string | number | readonly (string | number)[] | null | undefined;
/** Query parameters from an object, as the API reads several values of one filter - the key once
 *  per value (`?status=Red&status=NotRan`, agreed for API 2.0) - sending nothing for a value that's
 *  missing, empty, or an empty list. */
export const QUERY = (o: Record<string, QueryValue>) =>
  new HttpParams({
    fromObject: Object.fromEntries(
      Object.entries(o).filter(
        ([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length),
      ) as [string, string | number | readonly (string | number)[]][],
    ),
  });

/** Shared plumbing for every resource-scoped API service: URL building, safe list fetches, page unwrapping. */
export abstract class ApiBase {
  protected http = inject(HttpClient);
  readonly base = inject(ASSAY_API_BASE).replace(/\/$/, '');
  protected u(p: string) {
    return `${this.base}${p}`;
  }
  protected ids(list: string[]) {
    return list.map((id) => ({ id }));
  }
  safe<T>(o: Observable<T[]>) {
    return o.pipe(catchError(() => of([] as T[])));
  }
  protected items<T>(o: Observable<M.Page<T>>) {
    return o.pipe(map((p) => p.items));
  }
}
