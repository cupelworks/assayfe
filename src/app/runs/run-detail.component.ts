import { Component, inject, input, signal, computed, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AssayApiService } from '../api/assay-api.service';
import { CatalogStore } from '../api/catalog.store';
import { Kind, RunDetails } from '../api/models';
import { short, errText } from '../shared/format';
import { RunBodyComponent } from './run-body.component';

@Component({
  selector: 'assay-run-detail', standalone: true, imports: [RouterLink, RunBodyComponent], styleUrls: ['../shared/page.css'],
  template: `
  <div class="crumbs"><a [routerLink]="['/', kind()]">{{ kindLabel() }}s</a><span>/</span><a [routerLink]="['/', kind(), id()]">{{ name() }}</a><span>/</span><a [routerLink]="['/', kind(), id(), 'executions', execId()]">{{ short(execId()) }}</a><span>/</span><span class="cur">{{ short(runId()) }}</span></div>
  <div class="hero"><div><div class="kicker">Test run</div><h1>{{ run()?.name || 'Run ' + short(runId()) }}</h1></div></div>
  @if (err(); as e) { <div class="msg msg-err">{{ e }}</div> }
  <assay-run-body [run]="run()" [content]="run()" heading="Frozen entry" [snapshotAt]="run()?.test_case_snapshot_at?.snapshot_at ?? null" [sourceLink]="run() ? ['/tests', run()!.test_case_id.id] : null" />`,
})
export class RunDetailComponent {
  kind = input.required<Kind>(); id = input.required<string>(); execId = input.required<string>(); runId = input.required<string>();
  api = inject(AssayApiService); store = inject(CatalogStore); short = short;
  run = signal<RunDetails | null>(null); err = signal<string | null>(null);
  kindLabel = computed(() => this.kind() === 'test-sets' ? 'Test set' : 'Test plan');
  name = computed(() => this.store.parent(this.kind(), this.id())?.name ?? short(this.id()));
  constructor() { effect(() => this.api.runDetails(this.kind(), this.id(), this.execId(), this.runId()).subscribe({ next: r => this.run.set(r), error: e => this.err.set(errText(e)) })); }
}
