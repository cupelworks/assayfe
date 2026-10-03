import { computed, signal } from '@angular/core';

/**
 * Checkbox bulk-selection over a list of rows with ids: the header "select all" checkbox, one
 * checkbox per row, and the ids the bulk action then operates on. Pure client state - `rowsOf`
 * is whatever the page currently shows (the loaded page, after any text filter), so "all" means
 * "all shown", never "all that exist". Callers `clear()` on reload, since a stale id from a
 * previous page would otherwise survive invisibly into the next bulk action.
 *
 * Extracted from three byte-identical copies (tests list, dataset rows, test set entries) - the
 * same rule as DateSort/TextFilter: pulled out at the third copy, not written generically up
 * front. See `docs/improvement_ui/dev_notes.md` note 3.
 */
export class Selection {
  ids = signal<string[]>([]);
  constructor(private rowsOf: () => { id: string }[]) {}
  /** True when every visible row is selected (and there is at least one) - drives the header
   *  checkbox, and flips toggleAll() between select-all and clear. */
  allChecked = computed(() => {
    const rows = this.rowsOf();
    return rows.length > 0 && rows.every((r) => this.ids().includes(r.id));
  });
  has(id: string) {
    return this.ids().includes(id);
  }
  toggle(id: string) {
    this.ids.update((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  toggleAll() {
    this.ids.set(this.allChecked() ? [] : this.rowsOf().map((r) => r.id));
  }
  clear() {
    this.ids.set([]);
  }
}
