import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  effect,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin, map, catchError, of } from 'rxjs';
import { RunsApiService } from '../api/runs-api.service';
import { ExecutionMetadata, Kind } from '../api/models';
import { short, countByStatus, errText, isInFlight } from '../shared/format';
import { Paged } from '../shared/paged';
import { PagerComponent } from '../shared/pager.component';
import { RelTimeComponent } from '../shared/rel-time.component';
import { CopyButtonComponent } from '../shared/copy-button.component';
import { pollWhile } from '../shared/poll';

type StatusCount = { key: string; label: string; color: string; value: number };

@Component({
  selector: 'assay-executions-panel',
  standalone: true,
  imports: [RouterLink, PagerComponent, RelTimeComponent, CopyButtonComponent],
  styleUrls: ['../shared/page.css', './executions-panel.component.css'],
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
            ><span class="muted"><assay-rel-time [iso]="e.created_at" /></span>
          </div>
          <a class="plain strong" [routerLink]="['/', kind(), id(), 'executions', e.id]"
            >{{ e.run_count }} run{{ e.run_count === 1 ? '' : 's' }} →</a
          >
          @if (statusByExec()[e.id]; as statuses) {
            @if (statuses.length) {
              <div class="status-summary">
                @for (s of statuses; track s.key) {
                  <span class="chip"
                    ><span class="dot" [style.background]="s.color"></span>{{ s.value }}
                    {{ s.label }}</span
                  >
                }
              </div>
            }
          }
          <div class="small">
            <assay-copy-button [value]="e.id" [label]="short(e.id)" />
            @if (e.replayed_execution_id; as r) {
              · replayed
              <a class="plain" [routerLink]="['/', kind(), id(), 'executions', r.id]">{{
                short(r.id)
              }}</a>
            }
          </div>
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
  private api = inject(RunsApiService);
  short = short;
  page = new Paged<ExecutionMetadata>(
    // A statistics batch's executions are on its own page - dozens of them would bury these.
    // Five a page, as the statistics list beside them.
    (o, l) => this.api.executionsPage(this.kind(), this.id(), o, l, 'none'),
    5,
    errText,
  );
  /** Status breakdown per visible execution (e.g. "3 Green · 1 Pending") - one extra
   *  GET .../test-runs call per row (run_count as the limit, so every run's status is counted,
   *  not just the first page), since ExecutionMetadata carries no aggregate itself. */
  statusByExec = signal<Record<string, StatusCount[]>>({});
  /** True while any visible execution's breakdown still has a Pending/Running run - drives the
   *  poll below. */
  hasInFlight = computed(() =>
    Object.values(this.statusByExec()).some((statuses) =>
      statuses.some((s) => isInFlight(s.key) && s.value > 0),
    ),
  );
  constructor() {
    // Polls while a run is in flight, stops once nothing's left to wait for - see shared/poll.ts.
    // Reloading the execution page also re-triggers the statusByExec effect below, so one poll
    // refreshes both the run counts and their breakdowns. Skips a tick while the previous reload
    // is still in flight.
    pollWhile(
      () => this.hasInFlight(),
      () => {
        if (!this.page.loading()) this.page.reload();
      },
    );
    effect(() => {
      this.kind();
      this.id();
      this.version();
      // untracked: see scopes-list.component.ts's identical comment. Here it "only" caused a
      // duplicate fetch per pager interaction (reload() doesn't reset offset), not a silent
      // Next-button revert - but still a real, needless extra request every time.
      untracked(() => this.page.reload());
    });
    // Re-fetches each execution's status breakdown whenever the list changes (each poll tick
    // too); onCleanup drops the previous batch so a slow one can't overwrite a newer one.
    effect((onCleanup) => {
      const items = this.page.items();
      if (!items.length) {
        this.statusByExec.set({});
        return;
      }
      const sub = forkJoin(items.map((e) => this.loadStatusRow(e))).subscribe((rows) =>
        this.statusByExec.set(Object.fromEntries(rows)),
      );
      onCleanup(() => sub.unsubscribe());
    });
  }
  private loadStatusRow(e: ExecutionMetadata): Observable<[string, StatusCount[]]> {
    return this.api.executionRunsPage(this.kind(), this.id(), e.id, 0, e.run_count || 1).pipe(
      map(
        (p) => [e.id, countByStatus(p.items).filter((s) => s.value > 0)] as [string, StatusCount[]],
      ),
      catchError(() => of([e.id, []] as [string, StatusCount[]])),
    );
  }
}
