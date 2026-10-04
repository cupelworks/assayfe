import { Directive, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { CatalogStore } from '../api/catalog.store';
import { MembershipStore } from '../api/membership.store';
import { RunsApiService } from '../api/runs-api.service';
import { Kind, ScopeRead, StatsScopeRef } from '../api/models';
import { ActionRunner } from '../shared/action-runner';
import { counted, errText, short } from '../shared/format';
import { numbered } from '../shared/guide/guide-sections';

/**
 * What a test set's page and a test plan's page share: the thing itself (`meta`, its name), what
 * it can run - live, a replay of an earlier run - and be done to (renamed, deleted), the page's
 * dialogs and banner, and a `version` the tables read again on. Each page adds its own first
 * section (a set's tests, a plan's sets) and what it reads for it (`reload`).
 */
@Directive()
export abstract class ScopePage<D extends string> {
  abstract readonly kind: Kind;
  /** "test set", "test plan". */
  abstract readonly one: string;
  id = input.required<string>();
  protected runsApi = inject(RunsApiService);
  protected membership = inject(MembershipStore);
  protected router = inject(Router);
  store = inject(CatalogStore);

  /** The set or plan, as the API reads it - how it stands, whether it has runs. */
  meta = signal<ScopeRead | null>(null);
  name = computed(() => this.meta()?.name ?? short(this.id()));
  /** Bumped after a run is started here, or what it holds changed: the tables read again. */
  version = signal(0);
  statsScope = computed<StatsScopeRef>(() =>
    this.kind === 'test-sets' ? { test_set_id: this.id() } : { test_plan_id: this.id() },
  );
  dlg = signal<D | null>(null);
  act = new ActionRunner({
    inDialog: () => !!this.dlg(),
    done: () => {
      this.dlg.set(null);
      this.version.update((v) => v + 1);
      this.membership.forget();
      this.loadMeta();
      this.reload();
    },
  });

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        this.loadMeta();
        this.reload();
      });
    });
  }

  /** Reads what the page shows of it - its own first section. */
  abstract reload(): void;
  protected abstract fetchMeta(): Observable<ScopeRead>;
  protected abstract renamed(name: string): Observable<unknown>;
  protected abstract deleted(): Observable<unknown>;

  loadMeta() {
    this.fetchMeta().subscribe({
      next: (m) => this.meta.set(m),
      error: (e) => this.act.msg.set({ ok: false, text: errText(e) }),
    });
  }
  open(d: D) {
    this.act.err.set(null);
    this.dlg.set(d);
  }
  runLive() {
    this.act.run(this.runsApi.runLive(this.kind, this.id()), {
      ok: (r) => `Started a live run: ${counted(r.run_count, 'run')}, one a test.`,
    });
  }
  replay(execId: string) {
    this.act.run(this.runsApi.replay(this.kind, this.id(), execId), {
      ok: (r) => `Started a replay: ${counted(r.run_count, 'run')}, of the same copies.`,
    });
  }
  rename(name: string) {
    this.act.run(this.renamed(name), {
      ok: () => `Renamed to “${name}”.`,
      then: () => {
        this.loadMeta();
        this.store.load();
      },
    });
  }
  remove() {
    this.act.run(this.deleted(), {
      then: () => {
        this.store.load();
        this.router.navigate(['/', this.kind]);
      },
    });
  }
}

/** A set's or a plan's sections. */
export const scopeSections = (first: string, last?: string) =>
  numbered('scope-', last ? [first, 'Verdicts', 'Runs', last] : [first, 'Verdicts', 'Runs']);
