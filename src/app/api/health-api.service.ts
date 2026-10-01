import { Injectable } from '@angular/core';
import * as M from './models';
import { ApiBase } from './api-base';

/** GET /health/worker - the broker and the workers. (GET /health is the API's own liveness check,
 *  not used here.) */
@Injectable({ providedIn: 'root' })
export class HealthApiService extends ApiBase {
  worker() {
    return this.http.get<M.WorkerHealth>(this.u('/health/worker'));
  }
}
