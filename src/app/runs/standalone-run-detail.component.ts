import { Component, inject, input, signal, computed, effect } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AssayApiService } from '../api/assay-api.service';
import { StandaloneRunDetails, TestCase } from '../api/models';
import { short, errText } from '../shared/format';
import { RunBodyComponent } from './run-body.component';

@Component({
  selector: 'assay-standalone-run-detail', standalone: true, imports: [RouterLink, RunBodyComponent], styleUrls: ['../shared/page.css'],
  template: `
  <div class="crumbs"><a routerLink="/tests">Tests</a><span>/</span><a [routerLink]="['/tests', id()]">{{ name() }}</a><span>/</span><span class="cur">{{ short(runId()) }}</span></div>
  <div class="hero"><div><div class="kicker">Standalone run</div><h1>{{ name() }}</h1><p class="hero-note" style="margin-top:12px">Ran the live test as it was at execution time — no frozen snapshot.</p></div></div>
  @if (err(); as e) { <div class="msg msg-err">{{ e }}</div> }
  <assay-run-body [run]="run()" [content]="test()" heading="Test (current)" />`,
})
export class StandaloneRunDetailComponent {
  id = input.required<string>(); runId = input.required<string>();
  api = inject(AssayApiService); short = short;
  run = signal<StandaloneRunDetails | null>(null); test = signal<TestCase | null>(null); err = signal<string | null>(null);
  name = computed(() => this.test()?.name || 'Test ' + short(this.id()));
  constructor() { effect(() => forkJoin({ run: this.api.standaloneRun(this.id(), this.runId()), test: this.api.test(this.id()) }).subscribe({ next: r => { this.run.set(r.run); this.test.set(r.test); }, error: e => this.err.set(errText(e)) })); }
}
