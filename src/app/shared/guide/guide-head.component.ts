import { Component, afterNextRender, inject, input } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BreadcrumbComponent, GuideCrumb } from './breadcrumb.component';
import { CopyIdComponent } from '../copy-id.component';
import { StatusMarkComponent } from '../status-mark.component';
import { GuideSection } from './guide-sections';

/**
 * The top of a guide page, on the 12-column grid: a red kicker, the title - and beside it, flush
 * right on the margin, what the page marks `guideHeadAside` (the Overview: whether runs can start;
 * a work page: what to do) - the lede, an
 * optional key (a red line and what red means), then a numbered link per section (the Guide,
 * Charts) and what the page puts under it, across the grid (the catalogues: their key, their index
 * of sections, a filter; the Overview: its summaries). A link scrolls to its section - also when the fragment is already the
 * route's, which the router wouldn't scroll to again. The page opens on the section its fragment
 * names (`/charts#chart-scores`), else at its top: the router neither scrolls to anchors nor back
 * to the top in this app, so a link from far down another page would otherwise land far down this
 * one.
 *
 * A page with pages above it (a test, a set's run, a batch) puts its breadcrumb in the kicker's
 * place (`crumbs`: "Tests / Password Reset Instructions", then `kicker` - what the page is, even
 * when its title says it: "Statistics batch", "Run with statistics"); a page with nothing above
 * it (the Overview, a list, the Guide, a catalogue, Settings) has the kicker alone, naming its
 * part of the app ("Work"). A page of one thing's title is a name - `size="one"` sets it smaller,
 * as names run long.
 */
@Component({
  selector: 'assay-guide-head',
  standalone: true,
  imports: [RouterLink, BreadcrumbComponent, StatusMarkComponent, CopyIdComponent],
  host: { '[class.one]': "size() === 'one'", '[style.--ixs-across]': 'across()' },
  template: `
    <div class="kline">
      @if (crumbs().length) {
        <assay-breadcrumb class="kicker" [trail]="crumbs()" [here]="kicker() || null" />
      } @else {
        <div class="kicker">{{ kicker() }}</div>
      }
      @if (copyId(); as id) {
        <span class="idtag"
          ><span class="idcap" aria-hidden="true">{{ copyIdLabel() }}</span
          ><assay-copy-id [id]="id" [what]="copyIdLabel()" place="top"
        /></span>
      }
    </div>
    <h1 class="h1">{{ title() }}</h1>
    <div class="aside"><ng-content select="[guideHeadAside]" /></div>
    <p class="lede">{{ lede() }}</p>
    @if (key(); as k) {
      <p class="key">
        <i aria-hidden="true"></i><span>{{ k }}</span>
      </p>
    }
    @if (sections().length) {
      <nav class="ixs" [attr.aria-label]="navLabel()">
        @for (s of sections(); track s.id) {
          <a class="ix" [routerLink]="[]" [fragment]="s.id" (click)="go(s.id)"
            ><b>{{ s.no }}</b
            ><span class="nm">{{ s.label }}</span>
            @if (s.value) {
              <span class="val" [class.mono]="s.mono">
                @if (s.mark) {
                  <assay-mark [of]="s.mark" size="md" />
                }
                {{ s.value }}</span
              >
            }
            @if (s.detail) {
              <span class="det">{{ s.detail }}</span>
            }
          </a>
        }
      </nav>
    }
    <div class="rest"><ng-content /></div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      column-gap: 24px;
      padding: 72px 0 48px;
    }
    /* The kicker's line: the breadcrumb (or the part of the app) and, on a page of one thing, its
       ID at the right end. */
    .kline {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 8px 24px;
      margin-bottom: 12px;
    }
    .kicker {
      min-width: 0;
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-accent);
    }
    .idtag {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .idcap {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    .h1 {
      grid-column: 1 / 9;
      margin: 16px 0 0;
      font-size: 96px;
      font-weight: 800;
      letter-spacing: -0.04em;
      line-height: 0.92;
    }
    /* A name, not a page's title: smaller, balanced over its lines. */
    :host(.one) .h1 {
      font-size: 72px;
      letter-spacing: -0.035em;
      line-height: 0.95;
      text-wrap: balance;
      overflow-wrap: anywhere;
    }
    :host(.one) .lede {
      margin-top: 28px;
    }
    /* Beside the title, standing on its baseline: what the page adds there (the Overview:
       whether runs can start; a work page: what to do) - flush right on the right margin, the
       line the header's right group, a list's count and sort, the pager and the footer end on. */
    .aside {
      grid-column: 9 / -1;
      grid-row: 2;
      align-self: end;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      padding-bottom: 4px;
      text-align: right;
    }
    .aside:empty {
      display: none;
    }
    .lede {
      grid-column: 1 / 8;
      margin: 32px 0 0;
      font-size: 21px;
      line-height: 1.45;
      color: var(--color-neutral-800);
      text-wrap: pretty;
    }
    .key {
      grid-column: 1 / 8;
      display: flex;
      align-items: center;
      gap: 14px;
      margin: 22px 0 0;
      font-size: 15px;
      line-height: 1.5;
    }
    .key i {
      display: block;
      flex: none;
      width: 32px;
      height: 2px;
      background: var(--color-accent);
    }
    .ixs {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(var(--ixs-across, 3), minmax(0, 1fr));
      column-gap: 24px;
      margin-top: 72px;
    }
    .ix {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr);
      align-content: start;
      align-items: baseline;
      padding: 12px 0 13px;
      border-top: 1px solid var(--color-divider);
      font-size: 15px;
      font-weight: 600;
      color: var(--color-text);
      text-decoration: none;
    }
    .ix b {
      color: var(--color-accent);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .ix:hover .nm {
      color: var(--color-accent);
    }
    /* What the section holds now, under its label: big, then a line in small. */
    .val {
      grid-column: 2;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.01em;
      overflow-wrap: anywhere;
    }
    .val.mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0;
    }
    .det {
      grid-column: 2;
      margin-top: 2px;
      font-size: 13px;
      font-weight: 400;
      line-height: 1.45;
      color: var(--color-neutral-600);
      overflow-wrap: anywhere;
    }
    .ix:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
    .rest {
      grid-column: 1 / -1;
    }
    @media (max-width: 960px) {
      :host > * {
        grid-column: 1 / -1;
      }
      .h1 {
        font-size: 60px;
      }
      :host(.one) .h1 {
        font-size: 44px;
      }
      /* On a phone it stacks under the title, flush left as everything else. */
      .aside {
        grid-row: auto;
        align-items: flex-start;
        margin-top: 20px;
        padding-bottom: 0;
        text-align: left;
      }
      .ixs {
        grid-template-columns: minmax(0, 1fr);
        row-gap: 20px;
      }
    }
  `,
})
export class GuideHeadComponent {
  /** Its part of the app ("Work") - or, after a breadcrumb, what this page is ("Test", "Run"). */
  kicker = input('');
  title = input.required<string>();
  lede = input.required<string>();
  /** What the red line means, beside a red line - for a page whose pictures draw one. */
  key = input<string | null>(null);
  /** Each page above this one, by its title, outermost first: its breadcrumb. */
  crumbs = input<GuideCrumb[]>([]);
  /** The ID of the one thing the page is about, to copy, at the right end of the breadcrumb's
   *  line (`<assay-copy-id>`); none on a page about no one thing. */
  copyId = input<string | null>(null);
  /** What it's called there: "ID" - or whose, when the breadcrumb ends with another word ("Run
   *  ID" on a test in a set's run, whose breadcrumb ends "Test"). */
  copyIdLabel = input('ID');
  /** `one`: the title is a thing's name - smaller than a list's. */
  size = input<'list' | 'one'>('list');
  /** A numbered link per section; none on a page whose index is its own (the catalogues'). */
  sections = input<GuideSection[]>([]);
  navLabel = input('Sections');
  /** Section links a row: 3 (the Guide, Charts), 4 (Settings). One on a phone. */
  across = input(3);

  constructor() {
    const fragment = inject(ActivatedRoute).snapshot.fragment;
    afterNextRender(() =>
      fragment ? document.getElementById(fragment)?.scrollIntoView() : window.scrollTo(0, 0),
    );
  }

  go(id: string) {
    setTimeout(() => document.getElementById(id)?.scrollIntoView());
  }
}
