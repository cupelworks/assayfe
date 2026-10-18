// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input } from '@angular/core';
import { StatusMarkComponent } from '../shared/status-mark.component';

/** A line of a file or a paste, as read: its number (as an editor counts it), whether it reads as
 *  a row, and what it says - the row's prompt, or what's wrong with it. */
export interface LineCheck {
  no: number;
  ok: boolean;
  text: string;
}

/**
 * Lines said back as they were read, a ruled line each: a green mark and the prompt when it reads
 * as a row, a red one and what's wrong when it doesn't - "Line 3 · expected_output is missing." A
 * dataset's paste as it's typed (`<assay-paste-rows>`), and the lines of a file the API refused
 * (the import dialog).
 */
@Component({
  selector: 'assay-line-checks',
  standalone: true,
  imports: [StatusMarkComponent],
  template: `<ul>
    @for (l of lines(); track l.no) {
      <li [class.bad]="!l.ok">
        <assay-mark [of]="l.ok ? 'Green' : 'Red'" /><span class="ln">Line {{ l.no }}</span
        ><span class="t">{{ l.text }}</span>
      </li>
    }
  </ul>`,
  styles: `
    :host {
      display: block;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: grid;
      grid-template-columns: 8px 56px minmax(0, 1fr);
      column-gap: 10px;
      align-items: baseline;
      padding: 5px 0;
      border-bottom: 1px solid color-mix(in srgb, var(--color-text) 14%, transparent);
      font-size: 13px;
      color: var(--color-neutral-900);
    }
    .ln {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    .t {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    li.bad .t {
      color: var(--color-accent-700);
      font-weight: 600;
      white-space: normal;
    }
  `,
})
export class LineChecksComponent {
  lines = input.required<readonly LineCheck[]>();
}
