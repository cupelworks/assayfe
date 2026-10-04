import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import {
  CheaperOption,
  CheckRef,
  CheckTarget,
  Estimate,
  EstimateRequest,
  OutcomeSplit,
  StatisticalEngine,
  StatisticalTest,
  StatisticalTestName,
  StatsScopeKind,
  StatsScopeRef,
} from '../api/models';
import { StatisticalTestsStore, StatisticsApiService } from '../api/statistics-api.service';
import { TestsApiService } from '../api/tests-api.service';
import { RunsApiService } from '../api/runs-api.service';
import { TestSetsApiService } from '../api/test-sets-api.service';
import { TestPlansApiService } from '../api/test-plans-api.service';
import { errText } from '../shared/format';
import { StatusMarkComponent } from '../shared/status-mark.component';
import { StatusLineComponent, StatusTone } from '../shared/status-line.component';
import { StatusTallyComponent, TallyPart } from '../shared/status-tally.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { GuideSection, numbered } from '../shared/guide/guide-sections';
import { BannerComponent } from '../shared/work/banner.component';
import { DockComponent } from '../shared/dock.component';
import { NumberInputDirective, parseDecimal } from '../shared/number';
import { ParamFieldComponent } from './param-field.component';
import { OddsChartComponent } from './charts/odds-chart.component';
import { ParamRow, paramRows, paramValues, problems, typedFrom } from './stats-params';
import {
  OUTLOOK,
  chanceText,
  firstClause,
  inTen,
  often,
  oneIn,
  pct,
  ruleText,
  scopeCrumbs,
  scopePlace,
  scopeRef,
  sizeWhat,
} from './stats-format';

/** What "Run again" starts from: the batch's own test, parameters, size, targets and left-out
 *  checks. */
interface BatchPreset {
  statistical_test: StatisticalTestName;
  parameters: Record<string, number>;
  times: number;
  targets?: CheckTarget[];
  leave_out?: CheckRef[];
}

/** A batch run until there's an answer, by its fixed question's engine - for "Run again…". */
const SEQUENTIAL: Partial<Record<StatisticalEngine, StatisticalEngine>> = {
  sequential_gate: 'binomial_gate',
  sequential_judge_stability: 'judge_stability',
  sequential_t: 'one_sample_t',
};
/** The engines step 1 offers as questions. */
const QUESTIONS: StatisticalEngine[] = ['binomial_gate', 'one_sample_t', 'judge_stability'];
/** A check's key on this page: its entry and its label. */
const keyOf = (r: CheckRef) => `${r.entry_id ?? ''}|${r.label}`;
/** The targets a check can be given besides the batch's. */
const TARGETS = [0.8, 0.9, 0.95, 0.99];
const OUTLOOK_MARK: Record<string, string> = {
  likely_pass: 'pass',
  likely_fail: 'fail',
  too_close: 'inconclusive',
  unknown: 'none',
};

/**
 * "Run with statistics", a page of its own (`/tests/:id/run-with-statistics`, the same under
 * `/test-sets` and `/test-plans`; `?from=<batch id>` starts from that batch, for "Run again…"):
 * which question and its parameters, then - from the API's estimate, asked again (debounced) on
 * every change, creating nothing - what Assay has already seen of each check and how it looks
 * against its target, whether the goal (a 90% chance that every check gets an answer) can be
 * reached and what would bring it closer, a trial first when a check has never run, the sizes with
 * their chance of an answer and their cost against the odds' curve, and how the batch would most
 * likely end. A check can be given its own target or left out of the batch; both go with every
 * estimate and with Start. Start and Cancel stay in a bar at the bottom of the window. The page
 * computes no odds: every chance, size and sentence is the API's.
 */
@Component({
  selector: 'assay-run-stats',
  standalone: true,
  imports: [
    FormsModule,
    NumberInputDirective,
    OddsChartComponent,
    ParamFieldComponent,
    StatusMarkComponent,
    StatusLineComponent,
    StatusTallyComponent,
    GuideHeadComponent,
    GuideSectionComponent,
    BannerComponent,
    DockComponent,
  ],
  templateUrl: './run-stats.component.html',
  styleUrls: [
    '../shared/guide/guide.css',
    '../shared/guide/head-aside.css',
    '../shared/work/work.css',
    './run-stats.component.css',
  ],
})
export class RunStatsComponent {
  /** From the route: the scope's id, its kind (the route's data) and the batch to start from. */
  id = input.required<string>();
  scopeKind = input.required<StatsScopeKind>();
  from = input<string | undefined>();

  private router = inject(Router);
  private title = inject(Title);
  private testsApi = inject(TestsApiService);
  private setsApi = inject(TestSetsApiService);
  private plansApi = inject(TestPlansApiService);
  private runsApi = inject(RunsApiService);
  scope = computed(() => scopeRef({ kind: this.scopeKind(), id: this.id(), name: '' }));
  place = computed(() => scopePlace(this.scopeKind()));
  /** What one time runs, for the copy: "test", "set" or "plan". */
  noun = computed(() => this.place().noun);
  scopeName = signal('');
  /** The pages above it: the scope's list, then the scope by its name. */
  crumbs = computed(() =>
    this.scopeName()
      ? scopeCrumbs({ kind: this.scopeKind(), id: this.id(), name: this.scopeName() })
      : [{ label: this.place().label, link: this.place().list }],
  );
  /** What it does - and, once estimated, the goal. */
  lede = computed(() => {
    const g = this.estimate()?.goal;
    return (
      `One run tells you little about an application that answers differently every time. This ` +
      `runs the ${this.noun()} many times and lets statistics decide, check by check` +
      (g != null ? ` - the goal: a ${chanceText(g)} chance that every check gets an answer` : '') +
      '. Nothing is created until you start it.'
    );
  });
  /** The scope's page: Cancel and the crumbs go back to it. */
  back = computed(() => [this.place().list, this.id()]);
  loadError = signal<string | null>(null);
  /** The batch "Run again…" came from, as the choices it starts with. */
  private preset = signal<BatchPreset | null>(null);

  private api = inject(StatisticsApiService);
  store = inject(StatisticalTestsStore);
  /** The test picked; '' until one is - then the catalogue's first that can run here. */
  private picked = signal<StatisticalTestName>('');
  /** The questions step 1 asks, at a fixed size. The trial is offered on its own when it's worth
   *  it, and "until there's an answer" (the sequential engines) will be a size, not a question. */
  private questionTests = computed(() =>
    this.store.batchTests().filter((t) => QUESTIONS.includes(t.engine)),
  );
  choice = computed(() => {
    const list = this.questionTests();
    const can = (id: string) => !this.unavailable()[id];
    if (this.picked() && can(this.picked())) return this.picked();
    return list.find((t) => can(t.id))?.id ?? '';
  });
  /** Every parameter as typed, per test (`<test>:<key>`), in the units shown. */
  typed = signal<Record<string, string>>({});
  /** null: the API's default size. */
  timesText = signal<string | null>(null);
  /** Checks with their own target, and the checks the batch leaves out. */
  targets = signal<CheckTarget[]>([]);
  leaveOut = signal<CheckRef[]>([]);
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

  /** Side by side, each with one line: its question, or why it can't be asked here - the API's
   *  sentence to its first clause, whole on hover. */
  questions = computed(() =>
    this.questionTests().map((t) => {
      const reason = this.unavailable()[t.id] ?? null;
      const full = reason ?? t.question;
      return { t, off: !!reason, line: firstClause(full), full };
    }),
  );
  test = computed(() => this.store.byId().get(this.choice()) ?? null);
  /** The target and how sure, side by side; what only sizes the suggestion folds under Advanced. */
  mainParams = computed(() => this.paramRows().filter((r) => r.p.kind !== 'share'));
  advParams = computed(() => this.paramRows().filter((r) => r.p.kind === 'share'));
  private paramRows = computed(() => {
    const t = this.test();
    return t ? paramRows(t, this.typed(), this.apiProblems()) : [];
  });
  /** The parameters as the API takes them, or null while one is invalid. */
  private params = computed(() => {
    const t = this.test();
    return t ? paramValues(t, this.typed()) : null;
  });
  /** A test with a target per check (the gate, judge stability) - not the t-test, whose checks
   *  each keep their own threshold. */
  hasTargetParam = computed(() => !!this.test()?.parameters.some((p) => p.key === 'target'));
  /** What a parameter's value means, in words: "At least 9 times in 10 - for every check.",
   *  "Wrong at most 1 time in 20." - the API's hint for the rest. */
  paramHint(r: ParamRow): string | null {
    const v = this.params()?.[r.p.key];
    if (v == null) return null;
    if (r.p.kind === 'level') return `Wrong at most 1 time in ${oneIn(v)}.`;
    if (r.p.kind !== 'rate') return null;
    const judge = this.test()?.engine === 'judge_stability';
    const own = this.showTargets() ? ', unless a check has its own target below' : '';
    return `${judge ? 'Agrees with itself at least' : 'At least'} ${often(v)} - for every ${judge ? 'judge ' : ''}check${own}.`;
  }
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
  /** "Another size", as typed - its own field, so a suggestion picked doesn't fill it. */
  customText = signal('');
  customShown = computed(() => this.customText() || (this.otherSize() ? this.shownTimes() : ''));
  /** The goal, as the rows and the chart say it: "90%". */
  goalText = computed(() => chanceText(this.estimate()?.goal ?? 0.9));

  /** A check's name where it's shown: its label, with its entry's name when the scope has
   *  several. */
  private names = computed(() => {
    const e = this.estimate();
    const many = (e?.entries.length ?? 0) > 1;
    const entries = new Map((e?.entries ?? []).map((en) => [en.entry_id ?? '', en.name]));
    return (r: CheckRef) => (many ? `${r.label} (${entries.get(r.entry_id ?? '')})` : r.label);
  });

  /** What Assay has seen of each check that gets a verdict, or that's left out of this batch. */
  seen = computed(() => {
    const e = this.estimate();
    if (!e) return [];
    const many = e.entries.length > 1;
    const driving = e.driving_check ? keyOf(e.driving_check) : null;
    const own = new Set(this.targets().map(keyOf));
    const batchTarget = this.params()?.['target'];
    return e.entries.flatMap((en) =>
      en.checks
        .filter((c) => c.applies || c.left_out)
        .map((c) => {
          const ref: CheckRef = { entry_id: en.entry_id, label: c.label };
          const key = keyOf(ref);
          const h = c.history;
          const out = !!c.left_out;
          const certain = c.outlook === 'certain';
          const target = c.target ?? null;
          return {
            key,
            ref,
            label: c.label,
            where: many ? `${en.name} · ${c.test_type}` : c.test_type,
            included: !out,
            // A check left out keeps its history (faded); without one, nothing - not "No runs yet".
            seen: !h
              ? out
                ? ''
                : 'No runs yet'
              : h.mean != null
                ? `${runs(h.runs)} · average ${Number(h.mean.toPrecision(3))}`
                : `${runs(h.runs)} · ${h.passed} passed`,
            // The target this check is held to, and the others it could be given.
            target,
            own: own.has(key),
            options: [...new Set([...TARGETS, ...(own.has(key) && target != null ? [target] : [])])]
              .filter((t) => t !== batchTarget)
              .sort((a, b) => a - b)
              .map((t) => ({ value: String(t), text: inTen(t) })),
            batchText: batchTarget != null ? `The batch's: ${inTen(batchTarget)}` : '',
            mark: out
              ? null
              : certain
                ? c.certain_result === 'pass'
                  ? 'pass'
                  : c.certain_result === 'fail'
                    ? 'fail'
                    : 'none'
                : (OUTLOOK_MARK[c.outlook ?? ''] ?? 'none'),
            word: out ? 'Left out of this batch' : c.outlook ? OUTLOOK[c.outlook] : '',
            line: out ? 'No verdict this time; its history stays.' : (c.outlook_reason ?? ''),
            drives: !out && key === driving,
            size: out
              ? ''
              : c.size_needed != null
                ? String(c.size_needed)
                : c.best_chance != null
                  ? 'Out of reach'
                  : '?',
            sizeCap: out
              ? ''
              : c.size_needed != null
                ? 'times'
                : c.best_chance != null
                  ? `at best ${chanceText(c.best_chance)}`
                  : 'unknown',
          };
        }),
    );
  });
  /** Step 2's lead, as the canvas has it: what the table says about the checks as a whole. */
  seenLead = computed(() => {
    const e = this.estimate();
    if (this.allCertain()) return 'Nothing here can vary';
    if (e?.goal_reachable == null && e?.trial) return 'No history yet';
    return 'Each check against its target';
  });
  /** When nothing can vary, the box's line: why one run is enough. */
  onceLine = computed(
    () =>
      `${this.noun() === 'test' ? 'The answer is recorded and its checks are fixed' : 'The answers are recorded and the checks are fixed'}, so a single run says it all.`,
  );
  /** The API's warnings - less the two the "Every run gives the same result" box already says. */
  warnings = computed(() => {
    const said = this.allCertain() ? ['recorded_answers', 'nothing_can_vary'] : [];
    return (this.estimate()?.warnings ?? []).filter((w) => !said.includes(w.code));
  });
  /** Whether the rows show a target: a test with one, from an API that sends it. */
  showTargets = computed(
    () => !!this.hasTargetParam() && this.seen().some((r) => r.target != null),
  );
  /** Every check that gets a verdict is certain: no curve to draw, nothing to make cheaper. */
  allCertain = computed(() => {
    const e = this.estimate();
    const rows = (e?.entries ?? []).flatMap((en) => en.checks.filter((c) => c.applies));
    return rows.length > 0 && rows.every((c) => c.outlook === 'certain');
  });

  /** The goal, out of reach or within it - or unknown, without history. */
  goal = computed(() => {
    const e = this.estimate();
    if (!e || e.goal == null) return null;
    if (e.goal_reachable === false)
      return { out: true, best: chanceText(e.best_chance ?? 0), text: e.odds_summary ?? '' };
    if (e.goal_reachable) return { out: false, best: '', text: e.odds_summary ?? '' };
    return {
      out: false,
      best: '',
      text: "Assay hasn't seen these checks run yet, so it can't tell how likely an answer is at any size.",
    };
  });

  /** How the goal stands, beside the title - as the Overview's "Ready to run". */
  standing = computed<{ tone: StatusTone; title: string; text: string } | null>(() => {
    const e = this.estimate();
    if (!e) return null;
    if (this.allCertain())
      return {
        tone: 'unknown',
        title: 'Nothing can vary',
        text: 'Every run gives the same result',
      };
    if (e.goal == null) return null;
    if (e.goal_reachable === false)
      return {
        tone: 'warn',
        title: 'The goal is out of reach',
        text: `${chanceText(e.best_chance ?? 0)} at best, whatever the size`,
      };
    if (e.goal_reachable)
      return { tone: 'ok', title: 'The goal is within reach', text: e.odds_summary ?? '' };
    return {
      tone: 'unknown',
      title: "Can't tell yet",
      text: e.trial ? 'No runs to plan from: try them first' : 'No runs to plan from yet',
    };
  });
  /** Its steps, numbered as they show: the question; once estimated, what Assay has seen, then
   *  one run instead (nothing can vary), a trial first (no history), what reaches the goal for
   *  less (or brings it closer), how many times, how it would end; a note. */
  sections = computed<GuideSection[]>(() => {
    const e = this.estimate();
    return numbered('rws-', [
      { id: 'question', label: 'The question' },
      ...(e && this.seen().length ? [{ id: 'seen', label: 'What Assay has seen' }] : []),
      ...(e && this.allCertain() ? [{ id: 'once', label: 'Once is enough' }] : []),
      ...(this.trial() ? [{ id: 'trial', label: 'Try them first' }] : []),
      ...(this.cheaper().length
        ? [
            {
              id: 'cheaper',
              label: e?.goal_reachable ? 'Reach it for less' : 'Get closer to the goal',
            },
          ]
        : []),
      ...(e ? [{ id: 'sizes', label: 'How many times' }] : []),
      ...(this.outcome() ? [{ id: 'outcome', label: 'What will probably happen' }] : []),
      { id: 'note', label: 'A note' },
    ]);
  });
  /** A step by its name, for the template. */
  sec = computed(
    () =>
      Object.fromEntries(this.sections().map((x) => [x.id.slice(4), x])) as Record<
        string,
        GuideSection
      >,
  );

  /** What would bring the goal closer: the checks' own options and the batch's, the ones that
   *  reach it first. */
  cheaper = computed(() => {
    const e = this.estimate();
    if (!e || this.allCertain()) return [];
    const name = this.names();
    const batchTarget = this.params()?.['target'];
    const sure = this.params()?.['confidence'];
    const options = [
      ...e.entries.flatMap((en) => en.checks.flatMap((c) => c.cheaper ?? [])),
      ...(e.cheaper ?? []),
    ];
    return options
      .map((o) => {
        const many = (o.checks ?? []).map(name);
        const one = o.check ? name(o.check) : '';
        const saved = o.judge_calls_saved_per_time ?? 0;
        const title =
          o.kind === 'lower_target'
            ? `${one} at ${inTen(o.target ?? 0)}`
            : o.kind === 'less_sure'
              ? `${pct(o.confidence)} sure`
              : `Leave ${one || listed(many)} out`;
        const line =
          o.kind === 'lower_target'
            ? `Its own target, for ${one} only; the other checks keep ${batchTarget != null ? inTen(batchTarget) : 'the batch’s'}.`
            : o.kind === 'less_sure'
              ? `Every check: wrong at most 1 time in ${oneIn(o.confidence ?? 0)}${sure != null ? `, not 1 in ${oneIn(sure)}` : ''}.`
              : one
                ? saved
                  ? `No verdict and no judge calls for ${one} in this batch.`
                  : `No verdict for ${one} in this batch: its runs skip it.`
                : `Only the other checks get a verdict${saved ? `; ${saved} fewer judge call${saved === 1 ? '' : 's'} each time` : ''}.`;
        // What it costs at the size that reaches the goal: the judge calls it saves are gone.
        const app = o.times * e.calls.application.per_time;
        const judge = o.times * Math.max(0, e.calls.judge.per_time - saved);
        const calls =
          (app ? `${app.toLocaleString('en-US')} application calls` : 'No application calls') +
          (judge ? `, ${judge.toLocaleString('en-US')} judge calls` : ', no judge calls');
        return {
          o,
          title,
          line,
          // How it's said in the step's lead when it's the one that reaches the goal.
          doing:
            o.kind === 'lower_target'
              ? `${one} at ${inTen(o.target ?? 0)}`
              : o.kind === 'less_sure'
                ? `Being ${pct(o.confidence)} sure`
                : `Leaving ${one || listed(many)} out`,
          reach: o.reaches_goal,
          fig: o.reaches_goal ? String(o.times) : chanceText(o.best_chance ?? o.chance),
          cap: o.reaches_goal ? 'times' : 'at best',
          // What it gets: the goal - and its calls - or not at any size.
          gets: o.reaches_goal
            ? `Reaches ${this.goalText()}`
            : `No size reaches ${this.goalText()}`,
          note: o.reaches_goal ? calls : '',
        };
      })
      .sort((a, b) =>
        a.reach !== b.reach
          ? a.reach
            ? -1
            : 1
          : a.reach
            ? a.o.times - b.o.times
            : (b.o.best_chance ?? b.o.chance) - (a.o.best_chance ?? a.o.chance),
      );
  });

  /** Under its title: which of them reaches the goal - for fewer runs, when it's in reach. */
  cheaperSub = computed(
    () => this.cheaperLead() + (this.estimate()?.goal_reachable ? ' with fewer runs' : ''),
  );
  /** The options in one line: which of them reaches the goal. */
  cheaperLead = computed(() => {
    const all = this.cheaper();
    const reach = all.filter((c) => c.reach);
    const goal = this.goalText();
    if (!reach.length) return `None of these reaches ${goal} on its own`;
    if (reach.length === all.length && all.length > 1) return `Each of these reaches ${goal}`;
    if (reach.length === 1)
      return `${all.length > 1 ? 'Only ' + lower(reach[0].doing) : reach[0].doing} reaches ${goal}`;
    return `${reach.length} of these reach ${goal}`;
  });

  /** Running until there's an answer, when the API offers it - not for checks that can't vary. */
  until = computed(() => {
    const e = this.estimate();
    return e?.until_answer && !this.allCertain() ? e.until_answer : null;
  });
  /** "Until there's an answer" picked (true), a fixed size (false), or neither yet (null). */
  private untilPicked = signal<boolean | null>(null);
  /** Whether the batch runs until there's an answer: picked, or - with no size asked for - the
   *  default when no fixed size reaches the goal, as the canvas recommends. */
  untilOn = computed(() => {
    if (!this.until() || this.apiProblems()['times']) return false;
    const picked = this.untilPicked();
    return picked ?? (this.timesText() == null && this.estimate()?.goal_reachable === false);
  });
  /** The sizes worth offering, each with its chance of an answer and what it costs - and, when
   *  it's offered, "until there's an answer" last. */
  sizes = computed(() => {
    const e = this.estimate();
    if (!e) return [];
    const bad = !!this.apiProblems()['times'];
    const u = this.until();
    const until = this.untilOn();
    const per = e.calls;
    const fixed = e.suggestions.map((s) => ({
      key: String(s.times),
      until: false,
      times: s.times,
      title: `${s.times} times`,
      what: sizeWhat(s, !!u),
      chance: s.chance != null ? chanceText(s.chance) : '?',
      chanceCap: s.chance != null ? 'chance of an answer' : 'unknown yet',
      app: (s.times * per.application.per_time).toLocaleString('en-US'),
      judge: (s.times * per.judge.per_time).toLocaleString('en-US'),
      on: !until && e.times === s.times && !bad,
    }));
    if (!u) return fixed;
    const upTo = (perTime: number) =>
      perTime ? `up to ${(u.max_times * perTime).toLocaleString('en-US')}` : '0';
    return [
      ...fixed,
      {
        key: 'until',
        until: true,
        times: u.max_times,
        title: 'Until there’s an answer',
        what:
          e.goal_reachable === false
            ? 'recommended · stops once every check has one'
            : 'stops once every check has one',
        chance: chanceText(u.chance_by_max),
        chanceCap: 'by its limit',
        app: upTo(per.application.per_time),
        judge: upTo(per.judge.per_time),
        on: until,
      },
    ];
  });
  /** How "until there's an answer" goes, under it when it's picked: its waves, then the API's
   *  sentence. */
  untilText = computed(() => {
    const u = this.until();
    if (!u) return '';
    const waves =
      u.looks.length > 1
        ? `Runs in waves - ${u.first_wave} times first, then ${u.wave_size} at a time - and stops at the first wave that gives every check an answer.`
        : `Runs ${u.first_wave} times and stops there.`;
    return `${waves} ${u.summary}`;
  });
  /** A size typed by hand, not one of the suggestions. */
  otherSize = computed(() => {
    const e = this.estimate();
    return !!e && !this.untilOn() && !e.suggestions.some((s) => s.times === e.times);
  });
  /** The suggestion the estimate is for, when it's one. */
  private pickedSize = computed(() => {
    const e = this.estimate();
    return e?.suggestions.find((s) => s.times === e.times) ?? null;
  });
  /** A trial to run first, offered when a check has never run: what it runs and costs. */
  trial = computed(() => {
    const e = this.estimate();
    const t = e?.trial;
    if (!e || !t) return null;
    const fresh = e.entries.every((en) => en.checks.every((c) => !c.applies || !c.history));
    return {
      t,
      lead: fresh ? 'Recommended: no history yet' : 'Recommended: some checks have never run',
      title: `Run the ${this.noun()} ${t.times} times to learn, with no verdict`,
      facts:
        `${t.application_calls.toLocaleString('en-US')} application calls · ` +
        `${t.judge_calls.toLocaleString('en-US')} judge calls`,
    };
  });
  /** Why there's no curve, when there isn't one. */
  noChart = computed(() => {
    const e = this.estimate();
    if (!e || e.goal == null || this.chart()) return '';
    if (this.allCertain())
      return "Certain at any size: nothing here can vary, so there's no curve to draw.";
    if (e.goal_reachable == null)
      return e.trial
        ? 'No history yet: run the trial first, and the chance of an answer is drawn here.'
        : 'No history yet: the chance of an answer is drawn here once these checks have run.';
    return '';
  });
  /** The odds' chart, when there's a curve to draw. */
  chart = computed(() => {
    const e = this.estimate();
    if (!e?.odds?.length || e.goal_reachable == null || this.allCertain()) return null;
    const p = this.pickedSize();
    return {
      odds: e.odds,
      goal: e.goal ?? 0.9,
      picked: p?.chance != null ? { times: p.times, chance: p.chance } : null,
      best:
        e.goal_reachable === false && e.best_times != null && e.best_chance != null
          ? { times: e.best_times, chance: e.best_chance }
          : null,
      app: e.calls.application.per_time,
      judge: e.calls.judge.per_time,
    };
  });
  /** How the batch would most likely end at the picked size - or, until there's an answer, where
   *  it would most likely stop and how, with the suggested fixed size's ending beside it. */
  outcome = computed(() => {
    const e = this.estimate();
    if (!e || e.goal == null) return null;
    const p = this.pickedSize();
    const u = this.until();
    const left = this.leftLine();
    if (this.untilOn() && u) {
      const alt = p?.outcome
        ? this.verdicts(
            p.outcome,
            p.likely_undecided,
            `At the suggested fixed size, ${p.times} times, it would most likely say`,
          )
        : null;
      const o = u.outcome;
      if (!o) return { text: u.summary + left, parts: [] as TallyPart[], alt: null };
      const stops =
        u.usual_times != null
          ? `it most likely stops by ${u.usual_times} times with every check answered`
          : `it most likely runs to its limit of ${u.max_times} times`;
      const undecided = !this.manyChecks()
        ? 'it ends Inconclusive'
        : u.likely_undecided
          ? `the checks still undecided, most likely ${this.names()(u.likely_undecided)}, end Inconclusive`
          : 'the checks still undecided end Inconclusive';
      return {
        text:
          `If the checks keep behaving as before, ${stops} - Passed ${chanceText(o.passed)}, ` +
          `Failed ${chanceText(o.failed)}. If it reaches its limit first, ${undecided} ` +
          `(${chanceText(o.inconclusive)}).${left}`,
        parts: this.tally(o),
        alt,
      };
    }
    if (e.goal_reachable == null && !p?.outcome)
      return {
        text: e.trial
          ? `Unknown until these checks have run. The trial’s ${e.trial.times} runs tell this page how they behave; they give no verdict.`
          : "Unknown until these checks have run: Assay hasn't seen them yet.",
        parts: [] as TallyPart[],
        alt: null,
      };
    if (!p)
      return {
        text: 'Pick one of the sizes above to see how the batch would most likely end.',
        parts: [] as TallyPart[],
        alt: null,
      };
    if (!p.outcome)
      return {
        text: "Every check will get an answer; which one, Assay can't tell until it has run.",
        parts: [] as TallyPart[],
        alt: null,
      };
    const v = this.verdicts(
      p.outcome,
      p.likely_undecided,
      'If the checks keep behaving as before, this batch will most likely say',
    );
    return { text: v.text + left, parts: v.parts, alt: null };
  });
  /** More than one check gets a verdict: only then is naming the likely undecided one news. */
  private manyChecks = computed(
    () =>
      (this.estimate()?.entries ?? []).flatMap((en) => en.checks.filter((c) => c.applies)).length >
      1,
  );
  /** "Contains and ROUGE get no verdict." after the outcome, when checks are left out. */
  private leftLine = computed(() => {
    const out = this.leaveOut().map(this.names());
    return out.length ? ` ${listed(out)} get${out.length === 1 ? 's' : ''} no verdict.` : '';
  });
  /** The endings as a tally's rows, as the Overview's summaries: each verdict's mark, a bar for
   *  its chance, the chance - only the sure one when one is sure. */
  private tally(o: OutcomeSplit, sure = false): TallyPart[] {
    const rows = [
      { key: 'Passed', v: o.passed },
      { key: 'Inconclusive', v: o.inconclusive },
      { key: 'Failed', v: o.failed },
    ]
      .filter((x) => !sure || x.v >= 1)
      .map((x) => ({ key: x.key, count: Math.round(x.v * 1000), figure: chanceText(x.v) }));
    return [{ label: '', rows }];
  }
  /** A fixed size's ending in words, after `lead`: "…most likely say Failed (99%). Otherwise
   *  Inconclusive (1%). Passed is very unlikely. If it ends Inconclusive, Contains is the check
   *  most likely left undecided." - "certainly" when one verdict is sure. */
  private verdicts(o: OutcomeSplit, likelyUndecided: CheckRef | null | undefined, lead: string) {
    const parts = [
      { word: 'Passed', v: o.passed },
      { word: 'Inconclusive', v: o.inconclusive },
      { word: 'Failed', v: o.failed },
    ];
    const [first, ...rest] = [...parts].sort((a, b) => b.v - a.v);
    if (first.v >= 1)
      return {
        text: `This batch will say ${first.word} - certainly.${this.allCertain() ? ' One run would say the same.' : ''}`,
        parts: this.tally(o, true),
      };
    const said = (x: (typeof parts)[number]) => `${x.word} (${chanceText(x.v)})`;
    const likely = rest.filter((x) => x.v >= 0.005);
    const unlikely = rest.filter((x) => x.v < 0.005).map((x) => x.word);
    const otherwise = likely.length
      ? ` Otherwise ${said(likely[0])}${likely[1] ? `${likely[1].v <= 0.05 ? ' or, rarely, ' : ' or '}${said(likely[1])}` : ''}.`
      : '';
    const never = unlikely.length
      ? ` ${listed(unlikely)} ${unlikely.length === 1 ? 'is' : 'are'} very unlikely.`
      : '';
    const undecided =
      likelyUndecided && o.inconclusive >= 0.005 && this.manyChecks()
        ? ` If it ends Inconclusive, ${this.names()(likelyUndecided)} is the check most likely left undecided.`
        : '';
    return {
      text: `${lead} ${said(first)}.${otherwise}${never}${undecided}`,
      parts: this.tally(o),
    };
  }
  /** The outcome step's lead: the size it's for. */
  outLead = computed(() => {
    const e = this.estimate();
    return this.untilOn() ? 'Until there’s an answer' : e ? `At ${e.times} times` : '';
  });
  /** The checks that get no verdict for another reason than being left out, with why. */
  skipped = computed(() =>
    (this.estimate()?.entries ?? []).flatMap((e) =>
      e.checks
        .filter((c) => !c.applies && !c.left_out)
        .map((c) => ({ entry: e.name, label: c.label, reason: c.reason })),
    ),
  );
  /** What each verdict will take at this size, in words. */
  takes = computed(() => {
    const e = this.estimate();
    if (!e || this.untilOn()) return null;
    const r = e.rule;
    const notRan =
      ' A run that is Not Ran doesn’t count: the rule applies to the times that were evaluated.';
    if (r && (e.engine === 'binomial_gate' || e.engine === 'judge_stability')) {
      const gate = e.engine === 'binomial_gate';
      const own = this.targets().length ? ' at the batch’s target' : '';
      return `${gate ? 'Each check' : 'Each judge check'}${own}: ${ruleText(r, gate ? 'met' : 'in agreement')}${notRan}`;
    }
    const sure = this.params()?.['confidence'];
    return (
      'Each scored check is Passed when its average score is on the passing side of its threshold' +
      `${sure != null ? ` (${pct(sure)} sure)` : ''}, Failed when it’s on the other side, and ` +
      `Inconclusive when the runs can’t tell. Every run still evaluates all ${e.checks_total} checks.`
    );
  });
  /** What the picked size costs, in one line - the bar's, beside Start: "286 times × 2 entries ·
   *  572 application calls · no judge calls". */
  cost = computed(() => {
    const e = this.estimate();
    if (!e) return '';
    const per = e.runs_per_time;
    const u = this.until();
    if (this.untilOn() && u) {
      const app = u.max_times * e.calls.application.per_time;
      const judge = u.max_times * e.calls.judge.per_time;
      return (
        `Until there’s an answer · at most ${u.max_times} times${per > 1 ? ` × ${per} entries` : ''} · ` +
        `up to ${app.toLocaleString('en-US')} application calls · ` +
        (judge ? `up to ${judge.toLocaleString('en-US')} judge calls` : 'no judge calls')
      );
    }
    const judge = e.calls.judge.total;
    return (
      `${e.times} times${per > 1 ? ` × ${per} entries` : ''} · ` +
      `${e.calls.application.total.toLocaleString('en-US')} application calls · ` +
      (judge ? `${judge.toLocaleString('en-US')} judge calls` : 'no judge calls')
    );
  });
  /** Why Start is disabled, one phrase each - the bar lists them. */
  blockers = computed(() => {
    const out: string[] = [];
    const ap = this.apiProblems();
    for (const r of this.paramRows()) if (r.issue) out.push(`${r.p.label}: ${r.issue}`);
    const times = this.timesIssue() ?? ap['times'];
    if (times) out.push(`How many times: ${times}`);
    if (ap['test']) out.push(ap['test']);
    if (ap['targets']) out.push(`Targets: ${ap['targets']}`);
    if (ap['leave_out']) out.push(`Left out: ${ap['leave_out']}`);
    if (ap['note']) out.push(`Note: ${ap['note']}`);
    if (ap['other']) out.push(ap['other']);
    return out;
  });
  primaryLabel = computed(() => {
    if (this.starting()) return 'Starting…';
    const e = this.estimate();
    if (this.trial()) return 'Start without a trial';
    if (this.untilOn()) return 'Start - until there’s an answer';
    return e && !this.blockers().length
      ? `Start ${e.runs_total.toLocaleString('en-US')} runs`
      : 'Start';
  });
  /** The bar's line, its size in bold: "286 times × 2 entries · 572 application calls · …". */
  costParts = computed(() => {
    const [head, ...rest] = this.cost().split(' · ');
    return { head, rest: rest.join(' · ') };
  });
  /** Start steps back - outlined - while a step to take first is the one to do: a trial, or one
   *  run when nothing can vary. */
  startQuiet = computed(() => !!this.trial() || this.allCertain());
  /** What's left to fix, as the bar says it: each a sentence. */
  fixes = computed(() => this.blockers().map((b) => b.charAt(0).toUpperCase() + b.slice(1)));
  primaryDisabled = computed(
    () => this.starting() || this.estimating() || !this.estimate() || this.blockers().length > 0,
  );

  constructor() {
    this.store.load();
    // The page opens in a tab of its own: the tab says which test it's for, so it can be told
    // from the one it came from; leaving (Start goes to the batch) gives the app's title back.
    const appTitle = this.title.getTitle();
    effect(() => {
      const name = this.scopeName();
      this.title.setTitle(name ? `Run with statistics · ${name}` : 'Run with statistics');
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      this.title.setTitle(appTitle);
    });
    effect(() => {
      const kind = this.scopeKind();
      const id = this.id();
      untracked(() => this.loadScope(kind, id));
    });
    // "Run again…": the batch's own choices - only a batch of this scope's.
    effect(() => {
      const from = this.from();
      const id = this.id();
      if (!from) return;
      untracked(() =>
        this.api.batch(from, false).subscribe({
          next: (b) =>
            b.scope.id === id &&
            this.preset.set({
              statistical_test: b.statistical_test,
              parameters: b.parameters,
              times: b.progress.times_requested,
              targets: b.targets,
              leave_out: b.leave_out,
            }),
        }),
      );
    });
    // A preset (Run again) starts from the batch's own question, parameters, size, targets and
    // left-out checks.
    effect(() => {
      const p = this.preset();
      const t = p ? this.store.byId().get(p.statistical_test) : undefined;
      // After a trial, the batch it was for: the default question and size.
      if (!p || !t || t.engine === 'trial') return;
      // Until there's an answer: its fixed question, with "until there's an answer" picked.
      const fixed = SEQUENTIAL[t.engine];
      const q = fixed ? this.store.batchTests().find((x) => x.engine === fixed) : t;
      if (!q) return;
      untracked(() => {
        this.picked.set(q.id);
        this.typed.update((all) => ({ ...all, ...typedFrom(q, p.parameters) }));
        this.timesText.set(fixed ? null : String(p.times));
        this.untilPicked.set(fixed ? true : null);
        this.targets.set(p.targets ?? []);
        this.leaveOut.set(p.leave_out ?? []);
      });
    });
    // Which tests apply here: one estimate each with their defaults, once the catalogue is in.
    effect(() => {
      const tests = this.questionTests();
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
      ...(this.hasTargetParam() && this.targets().length ? { targets: this.targets() } : {}),
      ...(this.leaveOut().length ? { leave_out: this.leaveOut() } : {}),
    };
  });

  pick(t: StatisticalTestName) {
    if (this.unavailable()[t]) return;
    this.picked.set(t);
    // Each test has its own floor and its own kind of target: the size follows its default again.
    this.timesText.set(null);
    this.targets.set([]);
  }
  setParam(key: string, text: string) {
    this.typed.update((all) => ({ ...all, [`${this.choice()}:${key}`]: text }));
  }
  setTimes(text: string | null) {
    this.timesText.set(text);
  }
  /** One of the suggested sizes. */
  pickSize(times: number) {
    this.untilPicked.set(false);
    this.customText.set('');
    this.timesText.set(String(times));
  }
  /** "Another size", typed; empty goes back to the default. */
  /** Run until there's an answer: the fixed size goes back to the default, for the chart. */
  pickUntil() {
    this.untilPicked.set(true);
    this.customText.set('');
    this.timesText.set(null);
  }
  typeTimes(text: string) {
    this.untilPicked.set(text.trim() ? false : null);
    this.customText.set(text);
    this.timesText.set(text.trim() ? text : null);
  }
  /** Keep a check in the batch, or leave it out; the size then follows the new default. */
  include(ref: CheckRef, keep: boolean) {
    this.leaveOut.update((all) =>
      keep ? all.filter((r) => keyOf(r) !== keyOf(ref)) : [...all, { ...ref }],
    );
    this.backToDefault();
  }
  /** A check's own target ('' for the batch's). */
  setTarget(ref: CheckRef, value: string) {
    this.targets.update((all) => {
      const rest = all.filter((t) => keyOf(t) !== keyOf(ref));
      return value ? [...rest, { ...ref, target: Number(value) }] : rest;
    });
    this.backToDefault();
  }
  /** Take one of the options that bring the goal closer. */
  use(o: CheaperOption) {
    if (o.kind === 'lower_target' && o.check && o.target != null)
      this.setTarget(o.check, String(o.target));
    else if (o.kind === 'leave_out')
      for (const r of o.check ? [o.check] : (o.checks ?? [])) this.include(r, false);
    else if (o.kind === 'less_sure' && o.confidence != null)
      this.setParam('confidence', String(Math.round(o.confidence * 1000) / 10));
    this.backToDefault();
  }
  /** After a change to what's asked, the size is the new default again. */
  private backToDefault() {
    this.untilPicked.set(null);
    this.timesText.set(null);
    this.customText.set('');
  }

  private loadScope(kind: StatsScopeKind, id: string) {
    const name: Observable<string> =
      kind === 'test'
        ? this.testsApi.test(id).pipe(map((t) => t.name ?? ''))
        : (kind === 'test_set' ? this.setsApi.testSet(id) : this.plansApi.testPlan(id)).pipe(
            map((s) => s.name),
          );
    name.subscribe({
      next: (n) => this.scopeName.set(n),
      error: (e) => this.loadError.set(errText(e)),
    });
  }

  private checkAvailability(tests: StatisticalTest[], scope: StatsScopeRef) {
    for (const t of tests) {
      this.api.estimate({ ...scope, statistical_test: t.id }).subscribe({
        next: () => this.unavailable.update((u) => ({ ...u, [t.id]: null })),
        // The reason it can't run here; the choice then moves to one that can.
        error: (e) =>
          this.unavailable.update((u) => ({ ...u, [t.id]: problems(e)['test'] ?? null })),
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
    const req = this.request();
    if (!e || !req || this.primaryDisabled()) return;
    const u = this.until();
    this.create(
      this.untilOn() && u
        ? { ...req, statistical_test: u.statistical_test, times: u.max_times }
        : { ...req, times: e.times },
    );
  }
  /** Cancel closes the tab the page opened in, back to the page it came from. A tab the browser
   *  won't let a page close (one with its own history) goes to the scope's page instead. */
  cancel() {
    window.close();
    if (!window.closed) this.router.navigate(this.back());
  }
  /** On to what was started, in this tab: in place of the form, so Back skips it, and from the
   *  top - the form was left scrolled to its bottom bar. */
  private leaveFor(link: unknown[]) {
    this.router.navigate(link, { replaceUrl: true }).then(() => window.scrollTo(0, 0));
  }
  /** Run it once instead, when nothing can vary: a standalone run of the test, or a live run of
   *  the set or plan - then its page, in this tab (Back skips the form, as after Start). */
  runOnce() {
    if (this.starting()) return;
    this.starting.set(true);
    const id = this.id();
    const kind = this.scopeKind();
    const open = (link: unknown[]) => this.leaveFor(link);
    const fail = (err: unknown) => {
      this.starting.set(false);
      this.apiProblems.set(problems(err));
    };
    if (kind === 'test') {
      this.runsApi.runStandalone(id).subscribe({
        next: (r) => open(['/tests', id, 'runs', r.id]),
        error: fail,
      });
      return;
    }
    const k = kind === 'test_set' ? 'test-sets' : 'test-plans';
    this.runsApi.runLive(k, id).subscribe({
      next: (x) => open(['/', k, id, 'executions', x.id]),
      error: fail,
    });
  }
  /** The trial first: its own test and size, the same checks left out. */
  runTrial() {
    const t = this.estimate()?.trial;
    if (!t || this.starting()) return;
    this.create({
      ...this.scope(),
      statistical_test: t.statistical_test,
      times: t.times,
      ...(this.leaveOut().length ? { leave_out: this.leaveOut() } : {}),
    });
  }
  private create(req: EstimateRequest) {
    this.starting.set(true);
    const note = this.note().trim();
    this.api.createBatch({ ...req, note: note || null }).subscribe({
      // The batch's page shows it running; Back from there skips this page.
      next: (b) => this.leaveFor(['/statistics/batches', b.id]),
      error: (err) => {
        this.starting.set(false);
        this.apiProblems.set(problems(err));
      },
    });
  }
}

/** "A and B", "A, B and C". */
function listed(xs: string[]): string {
  return xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
}
/** "Leaving X out" → "leaving X out", for after "Only". */
const lower = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
/** "1 run", "40 runs". */
const runs = (n: number) => `${n} run${n === 1 ? '' : 's'}`;
