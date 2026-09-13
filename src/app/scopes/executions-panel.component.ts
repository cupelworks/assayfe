import { Component, inject, input, output, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AssayApiService } from '../api/assay-api.service';
import { ExecutionMetadata, Kind } from '../api/models';
import { rel, short, errText } from '../shared/format';
import { Paged } from '../shared/paged';
import { PagerComponent } from '../shared/pager.component';

@Component({
  selector: 'assay-executions-panel',
  standalone: true,
  imports: [RouterLink, PagerComponent],
  styleUrls: ['../shared/page.css'],
  template: `
    <div class="row-head" style="margin-bottom:8px">
      <h2>Executions</h2>
      <span class="small">{{ page.total() }} total</span>
    </div>
    <p class="hero-note" style="margin-bottom:20px">
      Live fans out over the current scope. Replay re-runs exactly the frozen entries a past
      execution used.
    </p>
    @for (e of page.items(); track e.id) {
      <div class="exec">
        <div class="exec-main">
          <div class="exec-top">
            <span
              class="tag"
              [class.tag-outline]="e.replayed_execution_id"
              [class.tag-accent]="!e.replayed_execution_id"
              >{{ e.replayed_execution_id ? 'Replay' : 'Live' }}</span
            ><span class="muted">{{ rel(e.created_at) }}</span>
          </div>
          <a class="plain strong" [routerLink]="['/', kind(), id(), 'executions', e.id]"
            >{{ e.run_count }} runs · <span class="muted">{{ short(e.id) }}</span> →</a
          >
          @if (e.replayed_execution_id) {
            <div class="small">replayed {{ short(e.replayed_execution_id.id) }}</div>
          }
        </div>
        <button
          class="btn btn-ghost btn-sm"
          style="align-self:start"
          (click)="replay.emit(e.id)"
          [disabled]="busy()"
        >
          Replay
        </button>
      </div>
    } @empty {
      @if (!page.loading()) {
        <div class="exec empty">Never executed.</div>
      }
    }
    <assay-pager
      [total]="page.total()"
      [offset]="page.offset()"
      [limit]="page.limit()"
      (offsetChange)="page.go($event)"
      (limitChange)="page.size($event)"
    />
  `,
})
export class ExecutionsPanelComponent {
  kind = input.required<Kind>();
  id = input.required<string>();
  busy = input(false);
  /** Bump to force a reload after run live / replay. */
  version = input(0);
  replay = output<string>();
  private api = inject(AssayApiService);
  rel = rel;
  short = short;
  page = new Paged<ExecutionMetadata>(
    (o, l) => this.api.executionsPage(this.kind(), this.id(), o, l),
    10,
    errText,
  );
  constructor() {
    effect(() => {
      this.kind();
      this.id();
      this.version();
      this.page.reload();
    });
  }
}
