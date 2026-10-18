// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/** How long after a reload for the sign-in an expired sign-in's answer is left to the page instead:
 *  the sign-in didn't take, and reloading again would only loop. */
export const RELOAD_GUARD_MS = 60_000;
const RELOADED_AT = 'assay.signin-reload';

/** What an expired sign-in answers a request: 403 from Azure Container Apps' authentication (an
 *  empty body, no WWW-Authenticate), 401 from App Service's. The API sends neither itself. */
const SIGN_IN_EXPIRED = new Set([401, 403]);

/** Whether to reload for the sign-in: never reloaded (`lastReload` null), or not within the guard. */
export function shouldReload(lastReload: number | null, now: number): boolean {
  return lastReload === null || now - lastReload >= RELOAD_GUARD_MS;
}

/** Reloads the page once for the sign-in - only if it can remember doing so, or a page whose
 *  storage is blocked could reload forever. */
function reloadForSignIn(win: Window) {
  try {
    if (!shouldReload(Number(win.sessionStorage.getItem(RELOADED_AT)) || null, Date.now())) return;
    win.sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    return;
  }
  win.location.reload();
}

/**
 * The app's own requests, as the sign-in in front of Assay needs them. Each says it comes from the
 * app (`X-Requested-With`), so when the sign-in has expired Azure's authentication answers 403 (or
 * 401) instead of redirecting to its login page, which a request can't follow. On either the page
 * reloads once: the reload goes through the login and comes back to the same page. Locally, with
 * no sign-in in front, there is neither.
 */
export const signInInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/')) return next(req);
  const win = inject(DOCUMENT).defaultView;
  return next(req.clone({ setHeaders: { 'X-Requested-With': 'XMLHttpRequest' } })).pipe(
    catchError((e: unknown) => {
      if (win && e instanceof HttpErrorResponse && SIGN_IN_EXPIRED.has(e.status)) {
        reloadForSignIn(win);
      }
      return throwError(() => e);
    }),
  );
};
