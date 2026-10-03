import { Component, computed, input } from '@angular/core';
import { StatusCount } from '../format';
import { StatusMarkComponent, markLabel } from '../status-mark.component';

/**
 * How a test, set or plan stands, under its page's top: its latest verdict or its latest run, as
 * a big word with its mark ("■ Failed") - or, for a run of a set, its counts ("■ 5 Green ■ 4
 * Amber") - then what it means in a sentence, the facts in small (the question, how many times,
 * when) and what to do next (the page's links, projected). With nothing yet, the word is the
 * page's ("Not yet", "Never run") beside a dash.
 */
@Component({
  selector: 'assay-state-block',
  standalone: true,
  imports: [StatusMarkComponent],
  host: { '[class.never]': 'never()' },
  template: `
    <span class="cap">{{ caption() }}</span>
    <span class="big">
      @if (counts()?.length) {
        @for (c of counts(); track c.key) {
          <span class="w"><assay-mark [of]="c.key" size="lg" />{{ c.value }} {{ c.label }}</span>
        }
      } @else if (of(); as s) {
        <span class="w"><assay-mark [of]="s" size="lg" />{{ word() || label() }}</span>
      } @else {
        <span class="w"><i class="dash"></i>{{ word() }}</span>
      }
    </span>
    @if (say(); as s) {
      <p class="say">{{ s }}</p>
    }
    @if (facts(); as f) {
      <p class="facts">{{ f }}</p>
    }
    <div class="acts"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      min-width: 0;
      padding-top: 12px;
      border-top: 1px solid var(--color-divider);
    }
    .cap {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-neutral-600);
    }
    .big {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 32px;
      margin-top: 14px;
      font-size: 44px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1;
    }
    .w {
      display: inline-flex;
      align-items: center;
      gap: 14px;
      font-variant-numeric: tabular-nums;
    }
    :host(.never) .big {
      color: var(--color-neutral-600);
    }
    .dash {
      display: block;
      width: 18px;
      height: 3px;
      background: var(--color-neutral-500);
    }
    .say {
      margin: 12px 0 0;
      font-size: 17px;
      line-height: 1.45;
      color: var(--color-text);
      text-wrap: pretty;
    }
    .facts {
      margin: 6px 0 0;
      max-width: 520px;
      font-size: 13px;
      line-height: 1.5;
      color: var(--color-neutral-600);
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0 24px;
      margin-top: 10px;
    }
    .acts:empty {
      display: none;
    }
    @media (max-width: 960px) {
      .big {
        font-size: 36px;
      }
    }
  `,
})
export class StateBlockComponent {
  /** "Latest verdict", "Latest run". */
  caption = input.required<string>();
  /** The status whose mark and word it shows; null: nothing yet (`word` beside a dash). */
  of = input<string | null>(null);
  /** A run of a set or plan: each status with how many. */
  counts = input<StatusCount[] | null>(null);
  /** The word instead of the status's own - and the one shown with nothing yet. */
  word = input('');
  say = input<string | null>(null);
  facts = input<string | null>(null);
  label = computed(() => markLabel(this.of()));
  never = computed(() => !this.of() && !this.counts()?.length);
}
