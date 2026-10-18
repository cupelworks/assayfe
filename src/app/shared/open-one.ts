// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { signal } from '@angular/core';

/**
 * One item of a list open at a time - a catalogue row's details, a statistical test's "How is
 * this calculated?": opening one closes the one before, and opening it again closes it. Pulled out
 * at the third copy (the Test types rows, the Statistical tests rows and their methods), as
 * `Selection`, `TextFilter` and `DateSort` were.
 */
export class OpenOne {
  readonly id = signal<string | null>(null);
  is(id: string) {
    return this.id() === id;
  }
  toggle(id: string) {
    this.id.update((open) => (open === id ? null : id));
  }
  open(id: string) {
    this.id.set(id);
  }
}
