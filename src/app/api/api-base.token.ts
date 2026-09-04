import { InjectionToken } from '@angular/core';
export const ASSAY_API_BASE = new InjectionToken<string>('ASSAY_API_BASE', { providedIn: 'root', factory: () => 'http://localhost:8000' });
