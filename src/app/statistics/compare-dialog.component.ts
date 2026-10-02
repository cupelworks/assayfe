import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Batch, BatchSummary, Comparison, StatisticalTestName } from '../api/models';
import { StatisticalTestsStore, StatisticsApiService } from '../api/statistics-api.service';
import { DialogComponent } from '../shared/dialog/dialog.component';
import { ChevronComponent } from '../shared/chevron.component';
import { StatusMarkComponent, markLabel } from '../shared/status-mark.component';
import { absTime, isInFlight } from '../shared/format';
import { ParamFieldComponent } from './param-field.component';
import { paramRows, paramValues, problems } from './stats-params';
import { scopePlace, scopeRef, timesText } from './stats-format';

/**
 * "Compare with…": this batch is B, the change; pick A, the baseline - another finished batch of
 * the same test, set or plan - and how to compare them. The comparison is computed and stored at
 * once, then opened.
 */
@Component({
  selector: 'assay-compare-dialog',
  standalone: true,
  imports: [
    DialogComponent,
    ChevronComponent,
    FormsModule,
    ParamFieldComponent,
    StatusMarkComponent,
  ],
  templateUrl: './compare-dialog.component.html',
  styleUrls: ['../shared/page.css', './stats-form.css'],
})
export class CompareDialogComponent {
  /** B: the batch the dialog was opened from. */
  batch = input.required<Batch>();
  created = output<Comparison>();
  closed = output<void>();
  private api = inject(StatisticsApiService);
  store = inject(StatisticalTestsStore);
  markLabel = markLabel;
  absTime = absTime;
  timesText = timesText;
  others = signal<BatchSummary[] | null>(null);
  baseline = signal<string | null>(null);
  choice = signal<StatisticalTestName>('pass_rates');
  typed = signal<Record<string, string>>({});
  note = signal('');
  adv = signal(false);
  saving = signal(false);
  apiProblems = signal<Record<string, string>>({});

  noun = computed(() => scopePlace(this.batch().scope.kind).noun);
  tests = computed(() =>
    this.store.comparisonTests().map((t) => {
      // Pairing needs entries: a test has only itself.
      const reason =
        t.id === 'paired_entries' && this.batch().scope.kind === 'test'
          ? 'Needs a set or a plan: there are no entries to pair in a single test.'
          : null;
      return { t, off: !!reason, reason };
    }),
  );
  test = computed(() => this.store.byId().get(this.choice()) ?? null);
  private rows = computed(() => {
    const t = this.test();
    return t ? paramRows(t, this.typed(), this.apiProblems()) : [];
  });
  mainParams = computed(() => this.rows().filter((r) => r.p.kind !== 'level'));
  advParams = computed(() => this.rows().filter((r) => r.p.kind === 'level'));
  blockers = computed(() => {
    const out: string[] = [];
    if (this.others()?.length && !this.baseline()) out.push('Choose the batch to compare against');
    for (const r of this.rows()) if (r.issue) out.push(`${r.p.label}: ${r.issue}`);
    const ap = this.apiProblems();
    for (const k of ['test', 'batch_a', 'batch_b', 'note', 'other']) if (ap[k]) out.push(ap[k]);
    return out;
  });

  constructor() {
    this.store.load();
    effect(() => {
      const b = this.batch();
      untracked(() =>
        this.api.batchesPage(scopeRef(b.scope), 0, 50).subscribe({
          next: (p) =>
            this.others.set(p.items.filter((x) => x.id !== b.id && !isInFlight(x.status))),
          error: (e) => this.apiProblems.set(problems(e)),
        }),
      );
    });
  }

  pick(t: StatisticalTestName) {
    this.choice.set(t);
    this.apiProblems.set({});
  }
  setParam(key: string, text: string) {
    this.typed.update((all) => ({ ...all, [`${this.choice()}:${key}`]: text }));
    this.apiProblems.set({});
  }

  compare() {
    const t = this.test();
    const a = this.baseline();
    const params = t ? paramValues(t, this.typed()) : null;
    if (!t || !a || !params || this.blockers().length) return;
    this.saving.set(true);
    this.apiProblems.set({});
    this.api
      .createComparison({
        batch_a: a,
        batch_b: this.batch().id,
        statistical_test: t.id,
        parameters: params,
        note: this.note().trim() || null,
      })
      .subscribe({
        next: (c) => {
          this.saving.set(false);
          this.created.emit(c);
        },
        error: (e) => {
          this.saving.set(false);
          this.apiProblems.set(problems(e));
        },
      });
  }
}
