// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/** Who is signed in, as the sign-in in front of Assay says it: the name to call them by, their
 *  whole name, and the username their organization gave them. */
export interface SignedIn {
  first: string;
  name: string;
  username: string;
}

/** One claim of the sign-in: its type ("name", or a long ".../claims/name") and its value. */
interface Claim {
  typ: string;
  val: string;
}

/** Where Sign out goes: the platform's own logout, then back to Assay - which, signed out, is the
 *  sign-in again. */
export const SIGN_OUT_URL = '/.auth/logout?post_logout_redirect_uri=/';

function isClaim(c: unknown): c is Claim {
  return typeof (c as Claim)?.typ === 'string' && typeof (c as Claim)?.val === 'string';
}

/** A claim by its short type ("name") or its long one (".../claims/name"). */
function claim(claims: readonly Claim[], type: string): string | null {
  const c = claims.find((x) => x.typ === type || x.typ.endsWith(`/claims/${type}`));
  return c?.val.trim() || null;
}

/** The principal's claims: base64 JSON, read as UTF-8 (a name may have accents); none when it
 *  isn't what the platform sends. */
function claimsOf(principal: string): Claim[] {
  try {
    const json = new TextDecoder().decode(Uint8Array.from(atob(principal), (c) => c.charCodeAt(0)));
    const claims: unknown = JSON.parse(json)?.claims;
    return Array.isArray(claims) ? claims.filter(isClaim) : [];
  } catch {
    return [];
  }
}

/**
 * Who `/.assay/me` says is signed in, as the header shows them - null when nobody is. Its
 * `principal` is the platform's X-MS-CLIENT-PRINCIPAL header, whose claims hold the name and the
 * username; "" when no sign-in is in front.
 */
export function signedInFrom(answer: unknown): SignedIn | null {
  const principal = (answer as { principal?: unknown } | null)?.principal;
  const claims = typeof principal === 'string' && principal ? claimsOf(principal) : [];
  const username = claim(claims, 'preferred_username');
  const name = claim(claims, 'name') ?? username;
  if (!name) return null;
  return { first: name.split(/[\s@]/)[0], name, username: username ?? name };
}

/**
 * Who is signed in, read once when the app opens from `/.assay/me`: nginx answers it with the
 * sign-in's own header, as the platform serves no `/.auth/me` without a token store. For display
 * only. Where nothing signs in (locally: an empty principal, or under `ng serve` a page that isn't
 * JSON), nobody is, and the header shows no one.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private http = inject(HttpClient);
  user = signal<SignedIn | null>(null);

  load() {
    this.http.get<unknown>('/.assay/me').subscribe({
      next: (answer) => this.user.set(signedInFrom(answer)),
      error: () => this.user.set(null),
    });
  }
}
