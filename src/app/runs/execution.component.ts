import { Component, inject, input, signal, computed, effect, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RunsApiService } from '../api/runs-api.service';
import { CatalogStore } from '../api/catalog.store';
import { Kind, RunMetadata } from '../api/models';
import { rel, absTime, short, countByStatus, statusColor, errText } from '../shared/format';
import { Paged } from '../shared/paged';
import { PagerComponent } from '../shared/pager.component';

@Component({
  selector: 'assay-execution',
  standalone: true,
  imports: [RouterLink, PagerComponent],
  templateUrl: './execution.component.html',
  styleUrls: ['../shared/page.css'],
})
export class ExecutionComponent {
  kind = input.required<Kind>();
  id = input.required<string>();
  execId = input.required<string>();
  api = inject(RunsApiService);
  store = inject(CatalogStore);
  router = inject(Router);
  rel = rel;
  absTime = absTime;
  short = short;
  statusColor = statusColor;
  page = new Paged<RunMetadata>(
    (o, l) => this.api.executionRunsPage(this.kind(), this.id(), this.execId(), o, l),
    25,
    errText,
  );
  runs = this.page.items;
  busy = signal(false);
  msg = signal<{ ok: boolean; text: string } | null>(null);
  kindLabel = computed(() => (this.kind() === 'test-sets' ? 'Test set' : 'Test plan'));
  name = computed(() => this.store.parent(this.kind(), this.id())?.name ?? short(this.id()));
  exec = computed(() =>
    this.store.byParent(this.kind(), this.id()).find((e) => e.id === this.execId()),
  );
  /** Status breakdown of the current page (the API has no aggregate endpoint). */
  statuses = computed(() => countByStatus(this.runs()));
  constructor() {
    effect(() => {
      // This scope's own name (store.parent) - only sets or plans is needed, by kind.
      this.kind() === 'test-sets' ? this.store.loadSets() : this.store.loadPlans();
      this.id();
      this.execId();
      // untracked: see scopes-list.component.ts's identical comment.
      untracked(() => this.page.reset());
    });
    this.store.loadExecutions(); // exec() lookup via store.byParent
  }
  replay() {
    this.busy.set(true);
    this.msg.set(null);
    this.api.replay(this.kind(), this.id(), this.execId()).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.store.load();
        this.router.navigate(['/', this.kind(), this.id(), 'executions', r.id]);
      },
      error: (e) => {
        this.busy.set(false);
        this.msg.set({ ok: false, text: errText(e) });
      },
    });
  }
}
