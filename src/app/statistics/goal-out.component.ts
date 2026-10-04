import { Component, input } from '@angular/core';

/** The goal out of reach, closing Run with statistics' "What Assay has seen": how far it gets at
 *  best, whatever the size, big, in amber - something to do - and the API's sentence beside it. */
@Component({
  selector: 'assay-goal-out',
  standalone: true,
  host: { role: 'status' },
  template: `
    <div class="gfig">
      <span class="big">{{ best() }}</span>
      <span class="gcap">at best, whatever the size</span>
    </div>
    <div class="gt">
      <h3>The goal is out of reach</h3>
      <p>{{ text() }}</p>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(9, minmax(0, 1fr));
      column-gap: 24px;
      margin-top: 40px;
      padding-top: 12px;
      border-top: 4px solid var(--color-status-amber);
    }
    .gfig {
      grid-column: 1 / 4;
    }
    .big {
      display: block;
      font-size: 64px;
      font-weight: 800;
      letter-spacing: -0.04em;
      line-height: 0.95;
      color: var(--color-status-amber);
      font-variant-numeric: tabular-nums;
    }
    .gcap {
      display: block;
      margin-top: 8px;
      font-size: 13px;
      color: var(--color-neutral-600);
    }
    .gt {
      grid-column: 4 / -1;
    }
    h3 {
      margin: 4px 0 0;
      font-size: 21px;
      font-weight: 800;
      letter-spacing: -0.01em;
      line-height: 1.25;
    }
    p {
      margin: 8px 0 0;
      font-size: 15px;
      line-height: 1.55;
      color: var(--color-neutral-900);
      text-wrap: pretty;
    }
    @media (max-width: 960px) {
      :host {
        grid-template-columns: minmax(0, 1fr);
        row-gap: 12px;
      }
      .gfig,
      .gt {
        grid-column: 1 / -1;
      }
      .big {
        font-size: 48px;
      }
    }
  `,
})
export class GoalOutComponent {
  /** The best chance any size gets: "84%". */
  best = input.required<string>();
  /** The API's sentence. */
  text = input('');
}
