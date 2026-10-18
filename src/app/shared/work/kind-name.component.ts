// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * A thing under its kind in small capitals - "TEST SET" over the set's name, a link to its page:
 * where a run was started from (Runs), what a batch tested (Batches), what a comparison compared
 * (Comparisons). `lead`: the name set as a row's own name is (work.css's .cell-nm) - the row's
 * thing; else in plain weight, beside a name of its own.
 */
@Component({
  selector: 'assay-kind-name',
  standalone: true,
  imports: [RouterLink],
  host: { '[class.lead]': 'lead()' },
  template: `<span class="k">{{ kind() }}</span>
    @if (link(); as l) {
      <a [routerLink]="l">{{ name() }}</a>
    } @else {
      <span class="nm">{{ name() }}</span>
    }`,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }
    .k {
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
      line-height: 1.7;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    a,
    .nm {
      font-weight: 600;
      color: var(--color-text);
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    :host(.lead) a,
    :host(.lead) .nm {
      font-size: 16px;
      font-weight: 800;
      letter-spacing: -0.01em;
      line-height: 1.25;
    }
    a:hover {
      color: var(--color-accent);
    }
    a:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  `,
})
export class KindNameComponent {
  kind = input.required<string>();
  name = input.required<string>();
  link = input<unknown[] | null>(null);
  lead = input(false);
}
