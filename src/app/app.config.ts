// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { signInInterceptor } from './api/sign-in.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([signInInterceptor])),
  ],
};
