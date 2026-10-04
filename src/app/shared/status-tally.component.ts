import { Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StatusMarkComponent, markOf } from './status-mark.component';
import { UNDER_WAY } from './format';

/** A status's row in a tally: which status (its mark, name and colour), how many have it, and
 *  where the row leads - none yet: the row looks the same and does nothing. */
export interface TallyRow {
  key: string;
  count: number;
  /** Shown in place of the count - "88%" when the counts are shares. */
  figure?: string;
  /** Router commands of the list of these; null while that list isn't built. */
  link?: unknown[] | null;
  query?: Record<string, string> | null;
}
/** A part of a tally under its own caption: how it ended, or what is still under way. */
export interface TallyPart {
  label: string;
  rows: TallyRow[];
}

/**
 * Things counted by status, as the Overview opens with: a red caption, then each part under a small
 * caption of its own - a ruled row per status, as the app's lists that lead somewhere: its mark and
 * name, a bar for its share of the whole tally (in the status's colour, hollow for Inconclusive as
 * its mark is), the figure and an arrow. A row goes to its list; nothing here filters (a tile is
 * what filters in this app). A row whose list isn't built yet looks the same and does nothing; a
 * status with none is plain text - its 0 in grey, no arrow, nothing to hover or click. `still`: no
 * row leads anywhere (a set's run, its tests listed below it) - every row plain, no arrow column.
 * A run's checks count as `met`, `unmet` and `NotRan` (their marks: green, red, grey).
 */
@Component({
  selector: 'assay-status-tally',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, StatusMarkComponent],
  host: {
    role: 'group',
    '[attr.aria-label]': "label() || caption() + ', ' + detail()",
    '[class.still]': 'still()',
    '[class.thin]': 'thin()',
  },
  template: `
    @if (caption()) {
      <div class="cap">
        {{ caption() }} <span>· {{ detail() }}</span>
      </div>
    }
    @for (p of view(); track p.label) {
      @if (p.label) {
        <span class="part">{{ p.label }}</span>
      }
      <div class="rows">
        @for (r of p.rows; track r.key) {
          @if (!r.count || still()) {
            <div class="row still">
              <ng-container *ngTemplateOutlet="row; context: { $implicit: r }" />
            </div>
          } @else if (r.link) {
            <a class="row" [routerLink]="r.link" [queryParams]="r.query" [attr.aria-label]="r.aria">
              <ng-container *ngTemplateOutlet="row; context: { $implicit: r }" />
            </a>
          } @else {
            <button type="button" class="row" [attr.aria-label]="r.aria">
              <ng-container *ngTemplateOutlet="row; context: { $implicit: r }" />
            </button>
          }
        }
      </div>
    }
    <ng-template #row let-r>
      <span class="name"><assay-mark [of]="r.key" size="md" />{{ r.label }}</span>
      <span class="track"
        ><i [class.hollow]="r.hollow" [style.width.%]="r.pct" [style.--fill]="r.color"></i
      ></span>
      <span class="n" [class.zero]="!r.count">{{ r.figure ?? r.count }}</span>
      <span class="arrow" aria-hidden="true">{{ r.count ? '→' : '' }}</span>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .cap {
      margin-bottom: 12px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-accent);
    }
    .cap span {
      color: var(--color-neutral-600);
    }
    .part {
      display: block;
      margin-bottom: 8px;
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    .rows {
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid var(--color-divider);
    }
    .rows + .part {
      margin-top: 24px;
    }
    .row {
      all: unset;
      box-sizing: border-box;
      display: grid;
      grid-template-columns: minmax(0, 4fr) minmax(0, 6fr) 64px 18px;
      align-items: center;
      column-gap: 16px;
      min-height: 46px;
      padding: 4px 0;
      border-top: 1px solid var(--color-divider);
      color: var(--color-text);
      text-decoration: none;
      cursor: pointer;
    }
    .row:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
    .name {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 15px;
      font-weight: 600;
      white-space: nowrap;
    }
    .track {
      display: block;
      height: 8px;
      background: color-mix(in srgb, var(--color-text) 14%, transparent);
    }
    .track i {
      display: block;
      height: 8px;
      background: var(--fill);
    }
    .track i.hollow {
      background: transparent;
      box-shadow: inset 0 0 0 1.5px var(--fill);
    }
    .n {
      justify-self: end;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .n.zero {
      color: var(--color-neutral-500);
    }
    .arrow {
      font-size: 16px;
      font-weight: 700;
      color: var(--color-neutral-500);
      transition: transform 0.15s ease;
    }
    .row:not(.still):hover .name,
    .row:not(.still):hover .arrow {
      color: var(--color-accent);
    }
    .row:not(.still):hover .arrow {
      transform: translateX(3px);
    }
    /* None of this status: nothing to go to - the figure in grey, no arrow, nothing on hover. */
    .row.still {
      cursor: default;
    }
    @media (prefers-reduced-motion: reduce) {
      .arrow {
        transition: none;
      }
    }
    /* Nowhere to go from any row (a set's run, whose tests are listed below): no arrow column. */
    :host(.still) .row {
      grid-template-columns: minmax(0, 4fr) minmax(0, 6fr) 64px;
    }
    :host(.still) .arrow {
      display: none;
    }
    /* A second, smaller tally under a first (Run with statistics' other ending). */
    :host(.thin) .row {
      min-height: 36px;
    }
    :host(.thin) .name {
      font-size: 13px;
    }
    :host(.thin) .n {
      font-size: 17px;
    }
    @media (max-width: 960px) {
      .row {
        grid-template-columns: minmax(0, 5fr) minmax(0, 4fr) 48px 14px;
        column-gap: 12px;
      }
      :host(.still) .row {
        grid-template-columns: minmax(0, 5fr) minmax(0, 4fr) 48px;
      }
    }
  `,
})
export class StatusTallyComponent {
  /** What's counted, in red: "Verdicts" - none: the rows alone (a batch's likely ending). */
  caption = input('');
  /** Its accessible name, when it has no caption. */
  label = input('');
  /** Smaller rows, under a first tally. */
  thin = input(false);
  /** Which of them, after it: "the last 100 batches". */
  detail = input('');
  /** For a row's accessible name: "Failed: 15 batches". */
  noun = input('');
  parts = input.required<TallyPart[]>();
  /** No row leads anywhere: each is plain, as a 0 is - no arrow, nothing to hover or click. */
  still = input(false);

  view = computed(() => {
    const parts = this.parts();
    const total = parts.reduce((n, p) => n + p.rows.reduce((m, r) => m + r.count, 0), 0) || 1;
    return parts.map((p) => ({
      label: p.label,
      rows: p.rows.map((r) => {
        const mark = markOf(r.key);
        return {
          ...r,
          label: mark.label,
          color: mark.color,
          hollow: mark.shape === 'hollow',
          pct: Math.round((r.count / total) * 1000) / 10,
          aria: `${mark.label}: ${r.count} ${this.noun()}`.trim(),
        };
      }),
    }));
  });
}

/**
 * A summary's tally of statuses - the Overview's, a set's run's: each status in `ended`, then
 * Running and Pending, counted in `statuses` - a list of them, or the API's counts by status (a
 * set's run's `runs`); a row leads where `link` says, or nowhere yet.
 */
export function tallyParts(
  statuses: readonly string[] | Partial<Record<string, number>>,
  ended: string[],
  link?: (key: string) => Pick<TallyRow, 'link' | 'query'>,
): TallyPart[] {
  const count = (key: string) =>
    Array.isArray(statuses)
      ? statuses.filter((s) => s === key).length
      : ((statuses as Partial<Record<string, number>>)[key] ?? 0);
  const row = (key: string): TallyRow => ({ key, count: count(key), ...link?.(key) });
  return [
    { label: 'How it ended', rows: ended.map(row) },
    { label: 'While it runs', rows: UNDER_WAY.map(row) },
  ];
}
