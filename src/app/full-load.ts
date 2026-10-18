// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { inject } from '@angular/core';
import { DOCUMENT, Location } from '@angular/common';
import { NavigationError } from '@angular/router';

/** How long after the app loaded a page in full on its own it leaves the next reason to the page
 *  instead: the load didn't help (the sign-in didn't take, or a page's code is still missing), and
 *  loading again would only loop. */
export const FULL_LOAD_GUARD_MS = 60_000;
const LOADED_IN_FULL_AT = 'assay.full-load';

/** Whether to load in full: never did (`lastLoad` null), or not within the guard. */
export function shouldLoadInFull(lastLoad: number | null, now: number): boolean {
  return lastLoad === null || now - lastLoad >= FULL_LOAD_GUARD_MS;
}

/**
 * Loads a page in full - the one shown, unless `url` names another - through the sign-in in front
 * of Assay, which comes back to it. For an expired sign-in (sign-in.interceptor.ts) and a page
 * whose code didn't load (below) alike: once a minute at most, so the two can't take turns, and
 * only if it can remember doing so, or a page whose storage is blocked could load forever.
 */
export function loadInFull(win: Window, url = win.location.href): void {
  try {
    const last = Number(win.sessionStorage.getItem(LOADED_IN_FULL_AT)) || null;
    if (!shouldLoadInFull(last, Date.now())) return;
    win.sessionStorage.setItem(LOADED_IN_FULL_AT, String(Date.now()));
  } catch {
    return;
  }
  const target = new URL(url, win.location.href).href;
  // The page shown is reloaded: assign() of its own address would only scroll to its #fragment.
  if (target === win.location.href) win.location.reload();
  else win.location.assign(target);
}

/** What a browser says when a page's code didn't load, a dynamic import() that failed: Chrome's
 *  and Edge's "Failed to fetch dynamically imported module", Firefox's "error loading dynamically
 *  imported module", Safari's "Importing a module script failed." */
const FAILED_IMPORT = /dynamically imported module|importing a module script failed/i;

/** Whether a navigation's error is a page's code that didn't load. */
export function isFailedImport(error: unknown): boolean {
  return error instanceof TypeError && FAILED_IMPORT.test(error.message);
}

/**
 * The router's answer when a page's code doesn't load: that page is loaded in full instead. Each
 * page's code comes the first time it's opened (app.routes.ts), and two things stop it:
 * - an expired sign-in, which redirects the request to its login page. A script can't follow
 *   that, and a page that never opens makes no request of its own, so nothing else notices;
 * - a release since the tab was opened: the old build's files are gone.
 * The full load goes through the login and back, and brings the build that's there now. Any other
 * navigation error stays as it was, so a fault in a page isn't hidden behind a reload.
 */
export function loadPageInFull(e: NavigationError): void {
  const win = inject(DOCUMENT).defaultView;
  if (!win || !isFailedImport(e.error)) return;
  // The page asked for, not the one shown: the address changes only once the page's code is in.
  loadInFull(win, inject(Location).prepareExternalUrl(e.url));
}
