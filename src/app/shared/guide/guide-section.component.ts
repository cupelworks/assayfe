// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, input } from '@angular/core';
import { GuideSection } from './guide-sections';

/**
 * A section of a guide page, on the 12-column grid: its red number and title in columns 1-3 (and
 * under the title, optionally, what it holds - "15 types"), then what it says in 4-12 - a
 * nine-column grid its content is laid on, with `guide.css`'s classes (`g-lead`, `g-text`,
 * `g-wide`, `g-note`), which the page includes for the content it projects. Its rail - the number,
 * the title and what goes under it (`sectionRail`: Settings' Save and Discard, the workers' Check
 * again) - stays in view while the body scrolls, on every page (not on a phone);
 * `[stickyRail]="false"` keeps one where it starts.
 */
@Component({
  selector: 'assay-guide-section',
  standalone: true,
  host: {
    role: 'region',
    '[id]': 'section().id',
    '[attr.aria-labelledby]': "section().id + '-title'",
    '[class.sticky-rail]': 'stickyRail()',
  },
  template: `
    <div class="rail">
      <span class="num" aria-hidden="true">{{ section().no }}</span>
      <h2 class="title" [id]="section().id + '-title'">{{ section().label }}</h2>
      @if (sub(); as holds) {
        <div class="sub">{{ holds }}</div>
      }
      <ng-content select="[sectionRail]" />
    </div>
    <div class="body"><ng-content /></div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      column-gap: 24px;
      padding: 44px 0 60px;
      border-top: 2px solid var(--color-text);
    }
    .rail {
      grid-column: 1 / 4;
    }
    /* The rail - its number, title and what's under it - in view while the body scrolls. */
    :host(.sticky-rail) .rail {
      align-self: start;
      position: sticky;
      top: 24px;
    }
    .num {
      display: block;
      font-size: 64px;
      font-weight: 800;
      color: var(--color-accent);
      letter-spacing: -0.04em;
      line-height: 0.9;
      font-variant-numeric: tabular-nums;
    }
    .title {
      margin: 18px 0 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.015em;
      line-height: 1.12;
      text-wrap: balance;
    }
    .sub {
      margin-top: 10px;
      font-size: 13px;
      color: var(--color-neutral-600);
    }
    .body {
      grid-column: 4 / 13;
      display: grid;
      grid-template-columns: repeat(9, minmax(0, 1fr));
      column-gap: 24px;
      align-items: start;
      min-width: 0;
    }
    @media (max-width: 960px) {
      :host,
      .body {
        grid-template-columns: minmax(0, 1fr);
      }
      .rail,
      .body {
        grid-column: 1 / -1;
      }
      .rail {
        margin-bottom: 24px;
      }
      :host(.sticky-rail) .rail {
        position: static;
      }
      .num {
        font-size: 48px;
      }
      .title {
        margin: 10px 0 0;
      }
    }
  `,
})
export class GuideSectionComponent {
  section = input.required<GuideSection>();
  /** What the section holds, under its title: "15 types". */
  sub = input<string | null>(null);
  /** Its rail stays in view while its body scrolls (not on a phone); false keeps it where it
   *  starts. */
  stickyRail = input(true);
}
