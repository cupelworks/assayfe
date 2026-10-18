// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input, output, signal, computed } from '@angular/core';
import { DialogComponent } from './dialog.component';
import { SmartFilterComponent } from '../work/smart-filter.component';
import { FilterChoice, FilterFacet } from '../work/filters';

export interface PickRow {
  id: string;
  name: string;
  sub?: string;
  meta?: string;
  /** Already there, or can't be picked: shown pale, its `meta` boxed ("In this set"). */
  disabled?: boolean;
  dim?: boolean;
  /** The facets' values it has ("check" → ["ROUGE", "BERTScore"]) - what the filter's tokens
   *  narrow by. */
  facets?: Record<string, string[]>;
}

/**
 * Pick several things to add or link: the smart filter in small (words, and a facet's values as
 * tokens - "Check: ROUGE"), how many it shows and how many are ticked, then a ticked list where
 * what's there already can't be ticked again. The parent performs the request and passes busy and
 * error back in.
 */
@Component({
  selector: 'assay-pick-dialog',
  standalone: true,
  imports: [DialogComponent, SmartFilterComponent],
  templateUrl: './pick-dialog.component.html',
  styleUrl: './pick-dialog.component.css',
})
export class PickDialogComponent {
  kicker = input('');
  title = input.required<string>();
  rows = input.required<PickRow[]>();
  /** What the rows are, plural: "tests", "test sets". */
  noun = input('');
  /** What the rows can be narrowed by, as tokens. */
  facets = input<FilterFacet[]>([]);
  placeholder = input('Names…');
  submitLabel = input<(n: number) => string>((n) => `Add ${n || ''}`);
  emptyText = input('Nothing to pick.');
  busy = input(false);
  error = input<string | null>(null);
  confirm = output<string[]>();
  closed = output<void>();
  query = signal('');
  words = signal<string | null>(null);
  chosen = signal<FilterChoice>({});
  picked = signal<string[]>([]);
  shown = computed(() => {
    const terms = [this.words(), this.query()]
      .map((t) => (t ?? '').trim().toLowerCase())
      .filter(Boolean);
    const chosen = Object.entries(this.chosen()).filter(([, keys]) => keys.length);
    return this.rows().filter((r) => {
      const text = (r.name + ' ' + (r.sub ?? '')).toLowerCase();
      if (!terms.every((t) => text.includes(t))) return false;
      return chosen.every(([facet, keys]) => keys.some((k) => r.facets?.[facet]?.includes(k)));
    });
  });
  /** The shown rows that can be ticked. */
  open = computed(() => this.shown().filter((r) => !r.disabled));
  allPicked = computed(
    () => this.open().length > 0 && this.open().every((r) => this.picked().includes(r.id)),
  );
  filtered = computed(() => this.shown().length < this.rows().length);
  toggle(id: string) {
    this.picked.update((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }
  all() {
    const ids = this.open().map((r) => r.id);
    this.picked.set(
      this.allPicked()
        ? this.picked().filter((p) => !ids.includes(p))
        : [...new Set([...this.picked(), ...ids])],
    );
  }
}
