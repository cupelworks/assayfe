import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/** Who is signed in, as the sign-in in front of Assay says it: the name to call them by, their
 *  whole name, and the username their organization gave them. */
export interface SignedIn {
  first: string;
  name: string;
  username: string;
}

/** One sign-in as `/.auth/me` lists it (Azure Container Apps' authentication, with Entra ID). */
interface AuthMeEntry {
  user_id?: string;
  user_claims?: { typ: string; val: string }[];
}

/** Where Sign out goes: the platform's own logout, then back to Assay - which, signed out, is the
 *  sign-in again. */
export const SIGN_OUT_URL = '/.auth/logout?post_logout_redirect_uri=/';

/** A claim of a sign-in by its short type ("name") or its long one (".../claims/name"). */
function claim(e: AuthMeEntry, type: string): string | null {
  const c = e.user_claims?.find((x) => x.typ === type || x.typ.endsWith(`/claims/${type}`));
  return c?.val?.trim() || null;
}

/** The sign-in `/.auth/me` gives, as the header shows it - null when it gives none. */
export function signedInFrom(entries: unknown): SignedIn | null {
  const e = Array.isArray(entries) ? (entries[0] as AuthMeEntry | undefined) : undefined;
  const username = (e && (claim(e, 'preferred_username') ?? e.user_id?.trim())) || null;
  if (!e || !username) return null;
  const name = claim(e, 'name') ?? username;
  return { first: name.split(/[\s@]/)[0], name, username };
}

/**
 * Who is signed in, read once when the app opens from the platform's `/.auth/me` - beside the
 * app, never under the API. Where nothing signs in (running Assay locally: no `/.auth`, or a page
 * that isn't JSON), nobody is, and the header shows no one.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private http = inject(HttpClient);
  user = signal<SignedIn | null>(null);

  load() {
    this.http.get<unknown>('/.auth/me').subscribe({
      next: (entries) => this.user.set(signedInFrom(entries)),
      error: () => this.user.set(null),
    });
  }
}
