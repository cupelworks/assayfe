import { Injectable } from '@angular/core';
import { ApiBase } from './api-base';

@Injectable({ providedIn: 'root' })
export class SystemApiService extends ApiBase {
  health() {
    return this.http.get<unknown>(this.u('/health'));
  }
}
