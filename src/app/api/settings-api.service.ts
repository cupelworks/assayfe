// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Injectable } from '@angular/core';
import * as M from './models';
import { ApiBase } from './api-base';

/** A settings group - each lives at /settings/<group> and works the same way. */
export type SettingsGroup = 'target' | 'judge';

/** /settings/<group>: read, save only what changed, reset to the environment's values, and run a
 *  check (a test call on a worker) with proposed changes that are never saved. One set of methods
 *  for every group, since every group has the same endpoints - and how the deployment runs
 *  (/settings/operations), read-only. */
@Injectable({ providedIn: 'root' })
export class SettingsApiService extends ApiBase {
  read<R>(group: SettingsGroup) {
    return this.http.get<R>(this.u(`/settings/${group}`));
  }
  /** Only the fields sent change; the first save copies the environment's values forward. */
  update<R>(group: SettingsGroup, changes: object) {
    return this.http.patch<R>(this.u(`/settings/${group}`), changes);
  }
  /** Drops what was saved from the UI; returns the settings now in effect (source "environment"). */
  reset<R>(group: SettingsGroup) {
    return this.http.delete<R>(this.u(`/settings/${group}`));
  }
  /** `body.settings`: proposed changes tried on top of the saved ones, never saved. The target
   *  group's check also takes an `input`; the judge's asks a fixed question and takes none. */
  startCheck<S>(group: SettingsGroup, body: { input?: string; settings: Partial<S> | null }) {
    return this.http.post<M.SettingsCheck<S>>(this.u(`/settings/${group}/checks`), body);
  }
  check<S>(group: SettingsGroup, id: string) {
    return this.http.get<M.SettingsCheck<S>>(this.u(`/settings/${group}/checks/${id}`));
  }
  /** How this deployment runs - read-only, set when the server starts (API 2.4.0). */
  operations() {
    return this.http.get<M.OperationsSettings>(this.u('/settings/operations'));
  }
}
