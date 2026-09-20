import { inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { ASSAY_API_BASE } from './api-base.token';
import * as M from './models';

export const PAGE = (offset = 0, limit = 100) => new HttpParams({ fromObject: { offset, limit } });

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
