import { Injectable } from '@angular/core';
import * as M from './models';
import { ApiBase } from './api-base';

/** /settings - so far only the application-under-test group (`/settings/target`). */
@Injectable({ providedIn: 'root' })
export class SettingsApiService extends ApiBase {
  target() {
    return this.http.get<M.TargetSettingsRead>(this.u('/settings/target'));
  }
  /** Only the fields sent change; the first save copies the environment's values forward. */
  updateTarget(changes: M.TargetSettingsUpdate) {
    return this.http.patch<M.TargetSettingsRead>(this.u('/settings/target'), changes);
  }
  /** Drops what was saved from the UI; returns the settings now in effect (source "environment"). */
  resetTarget() {
    return this.http.delete<M.TargetSettingsRead>(this.u('/settings/target'));
  }
  /** `settings`: proposed changes tried on top of the saved ones, never saved. */
  startTargetCheck(input: string, settings: M.TargetSettingsUpdate | null) {
    return this.http.post<M.TargetCheck>(this.u('/settings/target/checks'), { input, settings });
  }
  targetCheck(id: string) {
    return this.http.get<M.TargetCheck>(this.u(`/settings/target/checks/${id}`));
  }
}
