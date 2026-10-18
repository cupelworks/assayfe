// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { InjectionToken } from '@angular/core';

/** Where the API answers: `/api`, on the app's own origin - no CORS. In a deployment nginx forwards
 *  it to the API (nginx/default.conf.template), in development `ng serve` does (proxy.conf.json). */
export const ASSAY_API_BASE = new InjectionToken<string>('ASSAY_API_BASE', {
  providedIn: 'root',
  factory: () => '/api',
});
