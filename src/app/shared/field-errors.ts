import { signal } from '@angular/core';

/**
 * Per-field error messages for a form, keyed by field name. One instance per source of errors
 * (the form's own save, a connection check, …) so each can be cleared on its own terms; the
 * template merges them for display. `clear` is what editing a field calls, `clearKeys` what
 * reloading some fields calls (only those fields' messages stop applying).
 */
export class FieldErrorStore {
  all = signal<Record<string, string>>({});
  set(errors: Record<string, string>) {
    this.all.set(errors);
  }
  clear(key: string) {
    this.clearKeys([key]);
  }
  clearKeys(keys: readonly string[]) {
    const cur = this.all();
    if (!keys.some((k) => k in cur)) return;
    this.all.set(Object.fromEntries(Object.entries(cur).filter(([k]) => !keys.includes(k))));
  }
  reset() {
    this.all.set({});
  }
}
