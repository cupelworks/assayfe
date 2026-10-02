import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Batch,
  Estimate,
  EstimateRequest,
  StatisticalTest,
  StatisticalTestName,
  StatsScopeRef,
} from '../api/models';
import { StatisticalTestsStore, StatisticsApiService } from '../api/statistics-api.service';
import { DialogComponent } from '../shared/dialog/dialog.component';
import { ChevronComponent } from '../shared/chevron.component';
import { NumberInputDirective, parseDecimal } from '../shared/number';
import { ParamFieldComponent } from './param-field.component';
import { paramRows, paramValues, problems, typedFrom } from './stats-params';
import { ruleText } from './stats-format';

/** What "Run again" starts from: the batch's own test, parameters and size. */
export interface BatchPreset {
  statistical_test: StatisticalTestName;
  parameters: Record<string, number>;
  times: number;
}

/**
 * "Run with statistics": which question, its parameters, how many times - and, before anything is
 * created, what each verdict will take and what it costs, from the API's estimate (asked again,
 * debounced, on every change). A statistical test that can't apply to this scope (no scored check
 * for the t-test, no judge on a recorded answer for judge stability) is shown disabled with the
 * API's own reason. Start creates the batch and hands it to the page, which opens it.
 */
@Component({
  selector: 'assay-run-stats-dialog',
  standalone: true,
  imports: [
    DialogComponent,
    ChevronComponent,
    FormsModule,
    NumberInputDirective,
    ParamFieldComponent,
  ],
  templateUrl: './run-stats-dialog.component.html',
  styleUrls: ['../shared/page.css', './stats-form.css', './run-stats-dialog.component.css'],
})
export class RunStatsDialogComponent {
  scope = input.required<StatsScopeRef>();
  kicker = input('');
  /** What one time runs, for the copy: "test", "set" or "plan". */
  noun = input('set');
  preset = input<BatchPreset | null>(null);
  created = output<Batch>();
  closed = output<void>();

  private api = inject(StatisticsApiService);
  store = inject(StatisticalTestsStore);
  choice = signal<StatisticalTestName>('binomial_gate');
  /** Every parameter as typed, per test (`<test>:<key>`), in the units shown. */
  typed = signal<Record<string, string>>({});
  /** null: the API's default size. */
  timesText = signal<string | null>(null);
  note = signal('');
  adv = signal(false);
  showChecks = signal(false);
  estimate = signal<Estimate | null>(null);
  estimating = signal(false);
  /** Why each test can't be run on this scope - absent while unknown, null when it can. */
  unavailable = signal<Partial<Record<StatisticalTestName, string | null>>>({});
  /** The API's word on the last estimate or start, per field. */
  apiProblems = signal<Record<string, string>>({});
  starting = signal(false);
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Only the newest estimate's answer is shown; older ones may land late. */
  private seq = 0;

  tests = computed(() =>
    this.store.batchTests().map((t) => {
      const reason = this.unavailable()[t.id];
      return { t, off: !!reason, reason: reason ?? null };
    }),
  );
  test = computed(() => this.store.byId().get(this.choice()) ?? null);
  /** The parameters beside the size (the target); the rest fold under Advanced. */
  mainParams = computed(() => this.paramRows().filter((r) => r.p.kind === 'rate'));
  advParams = computed(() => this.paramRows().filter((r) => r.p.kind !== 'rate'));
  private paramRows = computed(() => {
    const t = this.test();
    return t ? paramRows(t, this.typed(), this.apiProblems()) : [];
  });
  /** The parameters as the API takes them, or null while one is invalid. */
  private params = computed(() => {
    const t = this.test();
    return t ? paramValues(t, this.typed()) : null;
  });
  timesIssue = computed(() => {
    const raw = this.timesText();
    if (raw == null) return null;
    const n = parseDecimal(raw);
    if (n == null || !Number.isInteger(n) || n < 1) return 'must be a whole number of times';
    if (n > this.store.maxTimes()) return `at most ${this.store.maxTimes()}`;
    return null;
  });
  /** The size the estimate is asked for: what was typed, or the API's default (undefined). */
  private times = computed(() =>
    this.timesText() == null || this.timesIssue() ? undefined : Number(this.timesText()),
  );
  shownTimes = computed(() => this.timesText() ?? String(this.estimate()?.times ?? ''));
  suggestions = computed(() =>
    (this.estimate()?.suggestions ?? []).map((s) => ({
      ...s,
      on: this.estimate()?.times === s.times && !this.apiProblems()['times'],
    })),
  );
  /** The checks that get no verdict, with why - shown on request. */
  skipped = computed(() =>
    (this.estimate()?.entries ?? []).flatMap((e) =>
      e.checks
        .filter((c) => !c.applies)
        .map((c) => ({ entry: e.name, label: c.label, reason: c.reason })),
    ),
  );
  /** What each verdict will take at this size, in words. */
  takes = computed(() => {
    const e = this.estimate();
    if (!e) return null;
    const r = e.rule;
    const notRan =
      ' A run that is Not Ran doesn’t count: the rule applies to the times that were evaluated.';
    if (r && (e.statistical_test === 'binomial_gate' || e.statistical_test === 'judge_stability')) {
      const gate = e.statistical_test === 'binomial_gate';
      return `${gate ? 'Each check' : 'Each judge check'}: ${ruleText(r, gate ? 'met' : 'in agreement')}${notRan}`;
    }
    return (
      'Each scored check is Passed when its average score is proven on the passing side of its ' +
      'threshold, Failed when proven on the other side, Inconclusive otherwise. Every run still ' +
      `evaluates all ${e.checks_total} checks.`
    );
  });
  /** Why Start is disabled, one phrase each - the dialog's footer lists them. */
  blockers = computed(() => {
    const out: string[] = [];
    const ap = this.apiProblems();
    for (const r of this.paramRows()) if (r.issue) out.push(`${r.p.label}: ${r.issue}`);
    const times = this.timesIssue() ?? ap['times'];
    if (times) out.push(`How many times: ${times}`);
    if (ap['test']) out.push(ap['test']);
    if (ap['note']) out.push(`Note: ${ap['note']}`);
    if (ap['other']) out.push(ap['other']);
    return out;
  });
  primaryLabel = computed(() => {
    if (this.starting()) return 'Starting…';
    const e = this.estimate();
    return e && !this.blockers().length ? `Start ${e.runs_total} runs` : 'Start';
  });
  primaryDisabled = computed(
    () => this.starting() || this.estimating() || !this.estimate() || this.blockers().length > 0,
  );

  constructor() {
    this.store.load();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    // A preset (Run again) starts from the batch's own question, parameters and size.
    effect(() => {
      const p = this.preset();
      const t = this.store.byId().get(p?.statistical_test ?? 'binomial_gate');
      if (!p || !t) return;
      untracked(() => {
        this.choice.set(p.statistical_test);
        this.typed.update((all) => ({ ...all, ...typedFrom(t, p.parameters) }));
        this.timesText.set(String(p.times));
      });
    });
    // Which tests apply here: one estimate each with their defaults, once the catalogue is in.
    effect(() => {
      const tests = this.store.batchTests();
      const scope = this.scope();
      if (!tests.length) return;
      untracked(() => this.checkAvailability(tests, scope));
    });
    // The estimate, asked again 300 ms after the last change.
    effect(() => {
      const req = this.request();
      untracked(() => this.schedule(req));
    });
  }

  private request = computed<EstimateRequest | null>(() => {
    const params = this.params();
    if (!params || !this.test()) return null;
    return {
      ...this.scope(),
      statistical_test: this.choice(),
      parameters: params,
      times: this.times(),
    };
  });

  pick(t: StatisticalTestName) {
    if (this.unavailable()[t]) return;
    this.choice.set(t);
    // Each test has its own floor: the size follows its default again.
    this.timesText.set(null);
  }
  setParam(key: string, text: string) {
    this.typed.update((all) => ({ ...all, [`${this.choice()}:${key}`]: text }));
  }
  setTimes(text: string) {
    this.timesText.set(text);
  }

  private checkAvailability(tests: StatisticalTest[], scope: StatsScopeRef) {
    for (const t of tests) {
      this.api.estimate({ ...scope, statistical_test: t.id }).subscribe({
        next: () => this.unavailable.update((u) => ({ ...u, [t.id]: null })),
        error: (e) => {
          const reason = problems(e)['test'] ?? null;
          this.unavailable.update((u) => ({ ...u, [t.id]: reason }));
          // The chosen test can't run here: the first one that isn't known not to.
          if (reason && this.choice() === t.id) {
            const next = tests.find((x) => x.id !== t.id && !this.unavailable()[x.id]);
            if (next) this.pick(next.id);
          }
        },
      });
    }
  }

  private schedule(req: EstimateRequest | null) {
    clearTimeout(this.timer);
    if (!req) return;
    this.estimating.set(true);
    this.timer = setTimeout(() => this.ask(req), 300);
  }
  private ask(req: EstimateRequest) {
    const n = ++this.seq;
    this.api.estimate(req).subscribe({
      next: (e) => {
        if (n !== this.seq) return;
        this.estimate.set(e);
        this.apiProblems.set({});
        this.estimating.set(false);
      },
      error: (err) => {
        if (n !== this.seq) return;
        const found = problems(err);
        this.apiProblems.set(found);
        // A size the test can't use: show its floor and suggestions from the default estimate.
        if (Object.keys(found).every((k) => k === 'times') && req.times != null) {
          this.api.estimate({ ...req, times: undefined }).subscribe({
            next: (e) => {
              if (n !== this.seq) return;
              this.estimate.set(e);
              this.estimating.set(false);
            },
            error: () => n === this.seq && this.estimating.set(false),
          });
        } else {
          this.estimate.set(null);
          this.estimating.set(false);
        }
      },
    });
  }

  start() {
    const e = this.estimate();
    const params = this.params();
    if (!e || !params || this.primaryDisabled()) return;
    this.starting.set(true);
    const note = this.note().trim();
    this.api
      .createBatch({
        ...this.scope(),
        statistical_test: this.choice(),
        parameters: params,
        times: e.times,
        note: note || null,
      })
      .subscribe({
        next: (b) => {
          this.starting.set(false);
          this.created.emit(b);
        },
        error: (err) => {
          this.starting.set(false);
          this.apiProblems.set(problems(err));
        },
      });
  }
}
