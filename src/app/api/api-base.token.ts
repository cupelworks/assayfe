// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { InjectionToken } from '@angular/core';
export const ASSAY_API_BASE = new InjectionToken<string>('ASSAY_API_BASE', {
  providedIn: 'root',
  factory: () => 'http://localhost:8000',
});
