import { signal } from '@angular/core';
import { Observable } from 'rxjs';
import { Page } from '../api/models';

/** Signal-backed page state: call reload() after changing offset/limit or after a mutation. */
export class Paged<T> {
  items = signal<T[]>([]); total = signal(0); offset = signal(0); limit = signal(50); loading = signal(false); error = signal<string | null>(null);
  constructor(private fetch: (offset: number, limit: number) => Observable<Page<T>>, limit = 25, private onError?: (e: unknown) => string) { this.limit.set(limit); }
  reload() {
    this.loading.set(true); this.error.set(null);
    this.fetch(this.offset(), this.limit()).subscribe({
      next: p => { this.items.set(p.items); this.total.set(p.total); this.loading.set(false); if (p.total && this.offset() >= p.total) { this.offset.set(Math.max(0, Math.floor((p.total - 1) / this.limit()) * this.limit())); this.reload(); } },
      error: e => { this.loading.set(false); this.error.set(this.onError ? this.onError(e) : 'Request failed'); },
    });
  }
  go(offset: number) { this.offset.set(offset); this.reload(); }
  size(limit: number) { this.limit.set(limit); this.offset.set(0); this.reload(); }
  reset() { this.offset.set(0); this.reload(); }
}
