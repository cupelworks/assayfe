import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatsScope, StripPoint, TestStatus } from '../../api/models';
import { STATUS, statusColor, statusLabel } from '../../shared/format';
import { runLink } from '../stats-format';

export interface GridRow {
  key: string;
  name: string;
  /** The test set an entry belongs to, in a plan. */
  sub: string | null;
  testId: string | null;
  strip: StripPoint[];
}

/** Every run of a batch: a row per entry, a square per time, coloured by the run's status, each
 *  opening its run. Statuses only - never a verdict, so it can show while the batch runs. */
@Component({
  selector: 'assay-runs-grid',
  standalone: true,
  imports: [RouterLink],
  styleUrls: ['../../shared/page.css'],
  template: `
    <div class="legend">
      @for (l of legend(); track l.key) {
        <span class="chip"><span class="dot" [style.background]="l.color"></span>{{ l.text }}</span>
      }
    </div>
    <div class="grid">
      @for (r of rows(); track r.key) {
        <div class="name" [title]="r.name">
          {{ r.name }}
          @if (r.sub) {
            <span class="small">{{ r.sub }}</span>
          }
        </div>
        <div class="cells">
          @for (c of r.strip; track c.index) {
            <a
              class="c"
              [routerLink]="link(c, r.testId)"
              [style.background]="statusColor(c.status)"
              [title]="'Time ' + c.index + ': ' + statusLabel(c.status)"
              [attr.aria-label]="'Time ' + c.index + ': ' + statusLabel(c.status)"
            ></a>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .legend {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--color-neutral-600);
    }
    .dot {
      width: 8px;
      height: 8px;
      display: inline-block;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 280px) minmax(0, 1fr);
      border-top: 2px solid var(--color-divider);
    }
    .name {
      padding: 8px 16px 8px 0;
      border-bottom: 1px solid var(--color-divider);
      font-size: 13px;
      font-weight: 600;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .name .small {
      display: block;
      font-weight: 400;
    }
    .cells {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
      align-content: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--color-divider);
    }
    .c {
      width: 10px;
      height: 16px;
      display: block;
    }
    .c:hover,
    .c:focus-visible {
      outline: 2px solid var(--color-text);
      outline-offset: 1px;
    }
  `,
})
export class RunsGridComponent {
  rows = input.required<GridRow[]>();
  /** Null draws an example: the squares link nowhere. */
  scope = input<StatsScope | null>(null);
  statusColor = statusColor;
  statusLabel = statusLabel;
  /** Each run status the grid holds, with its count, in the usual order. */
  legend = computed(() => {
    const n = new Map<TestStatus, number>();
    for (const r of this.rows())
      for (const c of r.strip) n.set(c.status, (n.get(c.status) ?? 0) + 1);
    return STATUS.filter((s) => n.get(s.key)).map((s) => ({
      key: s.key,
      color: s.color,
      text: `${n.get(s.key)} ${s.label}`,
    }));
  });
  link(c: StripPoint, testId: string | null) {
    const s = this.scope();
    return s ? runLink(s, c, testId) : null;
  }
}
