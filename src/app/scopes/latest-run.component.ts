import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Kind } from '../api/models';
import { rel } from '../shared/format';
import { StateBlockComponent } from '../shared/work/state-block.component';
import { countsSays } from '../shared/work/sentences';
import { ExecutionRow, whatRan } from './executions-table.component';

/**
 * A set's or plan's latest run, at the top of its page: its runs counted by status, big ("■ 5
 * Green ■ 4 Amber"), what that means ("5 runs met every check; 4 met some."), what ran and when,
 * and "Open the run →". With none, "Never run"; while it's read, "…".
 */
@Component({
  selector: 'assay-latest-run',
  standalone: true,
  imports: [RouterLink, StateBlockComponent],
  styleUrls: ['../shared/work/work.css'],
  template: `
    @if (run(); as r) {
      <assay-state-block
        caption="Latest run"
        [counts]="r.counts"
        [word]="r.counts.length ? '' : '…'"
        [say]="say()"
        [facts]="facts()"
      >
        <a class="go" [routerLink]="['/', kind(), id(), 'executions', r.e.id]">Open the run →</a>
      </assay-state-block>
    } @else if (run() === undefined) {
      <assay-state-block caption="Latest run" word="…" />
    } @else {
      <assay-state-block caption="Latest run" word="Never run" [say]="never()" />
    }
  `,
})
export class LatestRunComponent {
  kind = input.required<Kind>();
  id = input.required<string>();
  /** Its newest run outside a batch: undefined while it's read, null with none. */
  run = input<ExecutionRow | null | undefined>(undefined);
  say = computed(() => countsSays(this.run()?.counts ?? []));
  facts = computed(() => {
    const r = this.run();
    return r ? `${whatRan(r.e, this.kind())} · ${rel(r.e.created_at)}` : null;
  });
  never = computed(() =>
    this.kind() === 'test-sets'
      ? 'Run live runs each of its tests once.'
      : 'Run live runs each of its sets’ tests once.',
  );
}
