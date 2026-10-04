import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** A page above this one, by its title: where a breadcrumb leads back to. */
export interface GuideCrumb {
  label: string;
  link: string | unknown[];
}

/**
 * The red line over a page's title: each page above it, by its title - the words its page is
 * headed with (a run has no name: its title is when it ran) - a link back, cut at 32 characters
 * with "…" (the whole name on hover, and what a screen reader reads); a grey slash between them;
 * then what this page is, in ink (`here`: "Test", "Run", "Statistics batch") - every page names
 * itself, even when its title says it ("Run with statistics"). On a phone, only the page just
 * above, with an arrow back: the whole trail doesn't fit a phone's line.
 */
@Component({
  selector: 'assay-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="crumb" aria-label="Breadcrumb">
      @for (c of trail(); track $index) {
        @if (!$first) {
          <span class="sl" aria-hidden="true">/</span>
        }
        <a [routerLink]="c.link" [attr.title]="c.label">{{ c.label }}</a>
      }
      @if (here(); as h) {
        @if (trail().length) {
          <span class="sl" aria-hidden="true">/</span>
        }
        <span class="here" aria-current="page">{{ h }}</span>
      }
    </nav>
  `,
  styles: `
    :host {
      display: block;
    }
    .crumb {
      margin: 0;
      font-size: 11px;
      letter-spacing: 0.1em;
      line-height: 1.7;
      text-transform: uppercase;
      color: var(--color-accent);
    }
    /* About 32 characters of a name in these capitals: 22.5em - a ch is a "0", narrower than a
       capital with its letter spacing (32ch cut a 30-character name). */
    a {
      display: inline-block;
      max-width: 22.5em;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      vertical-align: top;
      color: var(--color-accent);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    a:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
    .sl {
      margin: 0 8px;
      color: var(--color-neutral-500);
    }
    .here {
      color: var(--color-text);
    }
    @media (max-width: 960px) {
      .sl,
      .here,
      a:not(:last-of-type) {
        display: none;
      }
      /* The way back only: the page just above, whole, a tap's height. */
      a:last-of-type {
        display: inline-flex;
        align-items: center;
        min-height: 32px;
        max-width: 100%;
        white-space: normal;
      }
      a:last-of-type::before {
        content: '← ';
        content: '← ' / '';
        white-space: pre;
      }
    }
  `,
})
export class BreadcrumbComponent {
  /** Each page above, outermost first. */
  trail = input<GuideCrumb[]>([]);
  /** What this page is, when its title doesn't say it. */
  here = input<string | null>(null);
}
