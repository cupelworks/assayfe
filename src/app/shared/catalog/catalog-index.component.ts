import { Component, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';

/** A tile of a catalogue's index: one of its sections - numbered as the section is - how many it
 *  holds, and what they are. */
export interface CatalogIndexItem {
  key: string;
  no: string;
  label: string;
  count: number;
  blurb: string;
}
/** A last tile that leads to another page instead ("How to read the charts"). */
export interface CatalogIndexLink {
  label: string;
  blurb: string;
  text: string;
  link: string;
}

/**
 * A catalogue's index, under its title: a tile per section, three across, each a rule, its number
 * and label, a big count, its blurb and "Show only →". A tile shows only its section (`selected`,
 * two-way); clicked again, everything again. The selected tile's rule turns thick and red. An
 * optional last tile leads to another page.
 */
@Component({
  selector: 'assay-catalog-index',
  standalone: true,
  imports: [RouterLink],
  host: { role: 'navigation', '[attr.aria-label]': 'label()' },
  template: `
    @for (i of items(); track i.key) {
      @let on = selected() === i.key;
      <button
        type="button"
        class="tile"
        [class.on]="on"
        [attr.aria-pressed]="on"
        (click)="selected.set(on ? null : i.key)"
      >
        <span class="no">{{ i.no }}</span>
        <span class="lb">{{ i.label }}</span>
        <span class="ct">{{ i.count }}</span>
        <span class="bl">{{ i.blurb }}</span>
        <span class="ac">{{ on ? selectedText() : 'Show only →' }}</span>
      </button>
    }
    @if (link(); as l) {
      <a class="tile" [routerLink]="l.link">
        <svg class="no" viewBox="0 0 14 14" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M1 7h11M8 3l4 4-4 4" stroke-width="2" />
        </svg>
        <span class="lb">{{ l.label }}</span>
        <span class="bl">{{ l.blurb }}</span>
        <span class="ac">{{ l.text }}</span>
      </a>
    }
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      column-gap: 24px;
      margin-top: 64px;
    }
    .tile {
      all: unset;
      box-sizing: border-box;
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr);
      align-content: start;
      row-gap: 8px;
      padding: 12px 0 22px;
      border-top: 1px solid var(--color-divider);
      color: var(--color-text);
      cursor: pointer;
    }
    .tile > * {
      grid-column: 2;
    }
    .tile > .no {
      grid-column: 1;
      grid-row: 1;
      font-size: 15px;
      font-weight: 800;
      color: var(--color-accent);
      font-variant-numeric: tabular-nums;
    }
    svg.no {
      width: 14px;
      height: 14px;
      margin-top: 4px;
    }
    .lb {
      font-size: 15px;
      font-weight: 600;
    }
    .ct {
      margin-top: 8px;
      font-size: 56px;
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 0.95;
      font-variant-numeric: tabular-nums;
    }
    .bl {
      max-width: 360px;
      font-size: 13px;
      line-height: 1.45;
      color: var(--color-neutral-600);
      text-wrap: pretty;
    }
    .ac {
      margin-top: 4px;
      font-size: 12px;
      font-weight: 700;
      color: var(--color-accent);
    }
    .tile:hover .lb {
      color: var(--color-accent);
    }
    .tile.on {
      padding-top: 9px;
      border-top: 4px solid var(--color-accent);
    }
    .tile.on .ac {
      color: var(--color-text);
    }
    .tile:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 4px;
    }
    @media (max-width: 960px) {
      :host {
        grid-template-columns: minmax(0, 1fr);
        margin-top: 48px;
      }
      .ct {
        font-size: 44px;
      }
    }
  `,
})
export class CatalogIndexComponent {
  items = input.required<CatalogIndexItem[]>();
  selected = model<string | null>(null);
  /** What the selected tile says: "Showing only this" (a category) or "Showing only these". */
  selectedText = input('Showing only these');
  link = input<CatalogIndexLink | null>(null);
  label = input('Sections');
}
