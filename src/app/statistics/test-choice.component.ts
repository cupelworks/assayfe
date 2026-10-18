// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatisticalTest } from '../api/models';

/** One statistical test to choose, and why it can't be chosen here (null when it can). */
export interface TestOption {
  t: StatisticalTest;
  off: boolean;
  reason: string | null;
}

/**
 * The statistical tests as radio rows - name, question (or why it can't apply here) - each with
 * "About this test →", which opens its card on the Statistical tests page in a new tab, so the
 * dialog keeps what was typed. Shared by the run and the compare dialogs.
 */
@Component({
  selector: 'assay-test-choice',
  standalone: true,
  imports: [RouterLink],
  template: `<div class="qs" role="radiogroup" [attr.aria-labelledby]="labelledBy()">
    @for (q of items(); track q.t.id) {
      <div class="q" [class.on]="q.t.id === choice()" [class.off]="q.off">
        <input
          type="radio"
          [id]="name() + '-' + q.t.id"
          [name]="name()"
          [checked]="q.t.id === choice()"
          [disabled]="q.off"
          (change)="picked.emit(q.t.id)"
        />
        <label class="q-text" [for]="name() + '-' + q.t.id">
          <span class="q-name">{{ q.t.name }}</span>
          <span class="small">{{ q.reason ?? q.t.question }}</span>
        </label>
        <a
          class="about"
          routerLink="/statistical-tests"
          [fragment]="q.t.id"
          target="_blank"
          rel="noopener"
          >About this test →</a
        >
      </div>
    }
  </div>`,
  styleUrls: ['../shared/page.css', './stats-form.css'],
  styles: `
    .about {
      font-size: 12px;
      color: var(--color-accent);
      text-decoration: none;
      white-space: nowrap;
      padding-top: 2px;
    }
    .about:hover {
      text-decoration: underline;
    }
  `,
})
export class TestChoiceComponent {
  items = input.required<TestOption[]>();
  choice = input.required<string>();
  /** The radio group's name, unique on the page. */
  name = input.required<string>();
  /** The id of the element naming the group. */
  labelledBy = input<string | null>(null);
  picked = output<string>();
}
