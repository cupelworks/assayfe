import { Component, computed, input } from '@angular/core';
import { GuideArrowComponent } from './guide-arrow.component';

/** A step of a flow: a thing ("Test", with a small note under it), or what makes the next one - a
 *  labelled arrow ("Run standalone"). */
export interface FlowStep {
  node?: string;
  /** Under a thing, small: "× every entry, every linked set". */
  note?: string;
  edge?: string;
}

/** One of the Guide's workflows (05) drawn as a line: each thing ruled under, each step between
 *  them a red label over a red arrow. One line from a 1264 px window up (the longest, workflow 2,
 *  needs 572 px); narrower, it wraps rather than run off the page. */
@Component({
  selector: 'assay-guide-flow',
  standalone: true,
  imports: [GuideArrowComponent],
  host: { '[class.noted]': 'noted()' },
  template: `
    @for (s of path(); track $index) {
      @if (s.edge) {
        <span class="edge"
          ><span class="lb">{{ s.edge }}</span
          ><assay-guide-arrow
        /></span>
      } @else {
        <!-- The name in its own span: no space after it, so the rule under it is its length. -->
        <span class="node"
          ><span>{{ s.node }}</span>
          @if (s.note) {
            <small>{{ s.note }}</small>
          }
        </span>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-end;
      flex-wrap: wrap;
      row-gap: 16px;
    }
    /* Room for a note under a thing. */
    :host(.noted) {
      padding-bottom: 24px;
    }
    .node {
      position: relative;
      padding-bottom: 6px;
      border-bottom: 2px solid var(--color-text);
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }
    .node small {
      position: absolute;
      left: 0;
      top: calc(100% + 7px);
      font-size: 12px;
      font-weight: 600;
      color: var(--color-neutral-700);
      letter-spacing: 0;
      white-space: nowrap;
    }
    .edge {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 5px;
      min-width: 96px;
      padding: 0 8px 9px;
    }
    .lb {
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-accent);
      text-align: center;
      white-space: nowrap;
    }
  `,
})
export class GuideFlowComponent {
  path = input.required<readonly FlowStep[]>();
  noted = computed(() => this.path().some((s) => !!s.note));
}
