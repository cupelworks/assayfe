import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RunDetails, StandaloneRunDetails, TestTypeResult } from '../api/models';
import { isInFlight, listed, prettyJson } from '../shared/format';
import {
  TestTypesStore,
  assignmentFields,
  engineSettingsLabel,
  isCodeField,
  scoreScale,
} from '../api/test-types.store';
import { checkName, typeCounts, typeTimes } from '../api/checks';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { numbered } from '../shared/guide/guide-sections';
import { CATALOG, CatalogColumn } from '../shared/catalog';
import { StatusMarkComponent } from '../shared/status-mark.component';

/** A line of what a check was run with, or how it ran: "Rubric", "Read from", "Engine". */
interface Line {
  label: string;
  value: string;
  mono: boolean;
}

/**
 * A run's body, under its page's top, as the Guide's sections:
 * 01 Checks - a ruled row per check, not met first: the check and its type, how it went (and its
 * score on its own scale, its threshold in red), why - with what it was run with in sight when it
 * wasn't met, under Details when it was, and how it ran (the judge, the engine) under Details;
 * 02 The answer - what the checks read (text as text, JSON as code), where it was read from, the
 * whole reply folded; 03 The test, as it ran - kept with the run. A run that couldn't run, or
 * hasn't yet, says so in each.
 */
@Component({
  selector: 'assay-run-body',
  standalone: true,
  imports: [RouterLink, GuideSectionComponent, CATALOG, StatusMarkComponent],
  styleUrls: [
    '../shared/guide/head-aside.css',
    '../shared/work/work.css',
    './run-body.component.css',
  ],
  template: `
    @if (run(); as r) {
      <assay-guide-section [section]="sections[0]" [sub]="checksSub()">
        @if (checks().length) {
          <assay-catalog-table label="Its checks" [columns]="columns">
            @for (c of checks(); track c.name) {
              <assay-catalog-row [name]="c.name" [tags]="c.tags" [expandable]="false">
                <assay-catalog-cell caption="How it went">
                  <span class="res"><assay-mark [of]="c.mark" size="md" />{{ c.word }}</span>
                  @if (c.score; as s) {
                    <span class="score">
                      <span class="sv">{{ s.value }}</span>
                      @if (s.needs) {
                        <span class="needs">{{ s.needs }}</span>
                      }
                      @if (s.pct != null) {
                        <span class="sbar" aria-hidden="true"
                          ><i [style.width.%]="s.pct"></i>
                          @if (s.at != null) {
                            <b [style.left.%]="s.at"></b>
                          }
                        </span>
                      }
                    </span>
                  }
                </assay-catalog-cell>
                <assay-catalog-cell caption="Why">
                  @if (c.why) {
                    <p class="why">{{ c.why }}</p>
                  }
                  @if (!c.passed && c.need.length) {
                    <dl class="kv">
                      @for (l of c.need; track l.label) {
                        <dt>{{ l.label }}</dt>
                        <dd [class.mono]="l.mono">{{ l.value }}</dd>
                      }
                    </dl>
                  }
                  @if (c.folded.length) {
                    <button
                      type="button"
                      class="more"
                      [attr.aria-expanded]="isOpen(c.name)"
                      (click)="toggle(c.name)"
                    >
                      {{ isOpen(c.name) ? 'Details ↑' : 'Details ↓' }}
                    </button>
                    @if (isOpen(c.name)) {
                      <dl class="kv">
                        @for (l of c.folded; track l.label) {
                          <dt>{{ l.label }}</dt>
                          <dd [class.mono]="l.mono">{{ l.value }}</dd>
                        }
                      </dl>
                    }
                  }
                </assay-catalog-cell>
              </assay-catalog-row>
            }
          </assay-catalog-table>
        } @else {
          <p class="none-yet">
            <b>{{ noChecks().title }}</b
            ><span>{{ noChecks().text }}</span>
          </p>
        }
      </assay-guide-section>

      <assay-guide-section [section]="sections[1]" [sub]="answerSub()">
        @if (answer(); as a) {
          <div class="ans">
            <span class="cap">{{ a.caption }}</span>
            @if (a.empty) {
              <p class="said empty">An empty answer.</p>
            } @else if (a.json) {
              <pre class="code">{{ a.text }}</pre>
            } @else {
              <p class="said">{{ a.text }}</p>
            }
            @if (a.live) {
              <span class="src"
                >Read from the application's reply at the Answer path in
                <a routerLink="/settings">Settings</a>.{{
                  ownPaths() ? ' A check with its own path reads that part instead.' : ''
                }}</span
              >
            }
          </div>
          @if (replyText(); as reply) {
            <div class="reply">
              <button
                type="button"
                class="more"
                [attr.aria-expanded]="replyOpen()"
                (click)="replyOpen.set(!replyOpen())"
              >
                {{ replyOpen() ? 'The whole reply ↑' : 'The whole reply ↓' }}
              </button>
              @if (replyOpen()) {
                <pre class="code">{{ reply }}</pre>
              }
            </div>
          }
        } @else {
          <p class="none-yet">
            <b>{{ noAnswer().title }}</b
            ><span>{{ noAnswer().text }}</span>
          </p>
        }
      </assay-guide-section>

      <assay-guide-section [section]="sections[2]" [sub]="testSub()">
        <dl class="defs">
          <dt>Input</dt>
          <dd>
            <span class="val">{{ r.input }}</span>
          </dd>
          <dt>Expected output</dt>
          @if (r.expected_output) {
            <dd>
              <span class="val">{{ r.expected_output }}</span>
            </dd>
          } @else {
            <dd class="none">None</dd>
          }
          <dt>Recorded answer</dt>
          @if (r.model_output != null) {
            <dd>
              <span class="val">{{ r.model_output || '(empty)' }}</span>
            </dd>
          } @else {
            <dd class="none">None: each run asks your application.</dd>
          }
          <dt>Checks</dt>
          @if (checkLine().length) {
            <dd>
              <span class="val">
                @for (k of checkLine(); track $index; let last = $last) {
                  {{ k.name }}
                  @if (k.path) {
                    , at <span class="at">{{ k.path }}</span>
                  }
                  @if (k.rubric) {
                    , with its own rubric
                  }
                  @if (!last) {
                    ·
                  }
                }
              </span>
            </dd>
          } @else {
            <dd class="none">None</dd>
          }
        </dl>
        @if (testLink(); as l) {
          <span class="ends"><a class="go" [routerLink]="l">Open the test →</a></span>
        }
      </assay-guide-section>
    }
  `,
})
export class RunBodyComponent {
  run = input.required<RunDetails | StandaloneRunDetails | null>();
  /** Under 03's title: whose test it is - "Kept with the run: editing the test since changes
   *  nothing here", "The set's copy, kept with the run". */
  testSub = input('');
  /** The test it ran, or was copied from - null: none to open. */
  testLink = input<unknown[] | null>(null);
  private types = inject(TestTypesStore);
  sections = numbered('run-', [
    'Checks',
    'The answer',
    { id: 'test', label: 'The test, as it ran' },
  ]);
  columns: CatalogColumn[] = [
    { label: 'Check', width: 2.1 },
    { label: 'How it went', width: 1.4 },
    { label: 'Why', width: 5.5 },
  ];
  /** Which checks' Details are open. */
  private open = signal<Set<string>>(new Set());
  replyOpen = signal(false);
  constructor() {
    this.types.load();
  }
  isOpen(name: string) {
    return this.open().has(name);
  }
  toggle(name: string) {
    this.open.update((s) => {
      const next = new Set(s);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  /** A row per check, needing attention first: one that couldn't run, then not met, then met -
   *  each group in the API's order. */
  checks = computed(() =>
    Object.entries(this.run()?.results ?? {})
      .map(([name, r]) => this.row(name, r))
      .sort((a, b) => a.rank - b.rank),
  );
  /** How many of the run's checks are of each type. */
  private typeCount = computed(
    () => new Map(typeCounts(this.run()?.test_type_assignments).map((t) => [t.name, t.count])),
  );
  private row(name: string, r: TestTypeResult) {
    const errored = !!r.errored;
    const need = this.need(name, r);
    // How it ran: who judged it, what scored it - always folded.
    const how: Line[] = [
      ...(r.judge?.model ? [{ label: 'Judged by', value: r.judge.model, mono: true }] : []),
      ...(r.engine ? [{ label: 'Engine', value: r.engine, mono: false }] : []),
      ...(r.engine && engineSettingsLabel(r.engine_settings)
        ? [
            {
              label: 'Engine settings',
              value: engineSettingsLabel(r.engine_settings)!,
              mono: false,
            },
          ]
        : []),
    ];
    // Its type, always, with how many of the run's checks are of it - "Contains ×2", as a test's
    // checks are counted on its list (results before labels were keyed by the type).
    const type = r.test_type ?? name;
    return {
      name,
      tags: [{ text: typeTimes(type, this.typeCount().get(type) ?? 1) }],
      passed: r.passed,
      rank: errored ? 0 : r.passed ? 2 : 1,
      mark: errored ? 'NotRan' : r.passed ? 'met' : 'unmet',
      word: errored ? "Couldn't run" : r.passed ? 'Met' : 'Not met',
      why: r.detail,
      score: this.score(name, r),
      need,
      // Under Details: what it was run with, when it was met (else it's in sight), then how.
      folded: [...(r.passed ? need : []), ...how],
    };
  }
  /** The assignment a result is for - results are keyed by the check's label. */
  private assignment(name: string) {
    return this.run()?.test_type_assignments?.find((a) => checkName(a) === name);
  }
  /** What a check was run with: its settings (labelled as its type labels them), the rubric a
   *  judge graded with (its own, or the type's default - stamped on the result), and the part of
   *  the reply it read, when its own. Without them a miss is unexplained. */
  private need(name: string, r: TestTypeResult): Line[] {
    const config = this.assignment(name)?.config;
    const type = this.types.byName().get(r.test_type ?? name);
    const fields = (type ? assignmentFields(type) : []).flatMap((f) => {
      const value = f.kind === 'rubric' ? null : config?.[f.key]?.trim() || null;
      return value ? [{ label: f.label, value, mono: isCodeField(f) }] : [];
    });
    const rubric = r.rubric
      ? [
          {
            label: r.rubric.source === 'custom' ? 'Rubric' : 'Default rubric',
            value: r.rubric.text,
            mono: false,
          },
        ]
      : [];
    const path = r.answer_path ? [{ label: 'Read from', value: r.answer_path, mono: true }] : [];
    return [...fields, ...rubric, ...path];
  }
  /** A scored check's score against what it needs: 4 decimals (what the API keeps and quotes),
   *  "needs at least 0.5, of 0 to 1", and its place - and the threshold's - on the type's own
   *  scale. No scale when the result was scored by another engine than the type's now, or the
   *  type gives none: the figure alone, rather than a guessed bar. */
  private score(name: string, r: TestTypeResult) {
    if (r.score == null) return null;
    const type = this.types.byName().get(r.test_type ?? name);
    const scale =
      type?.comparison && (!r.engine || r.engine === type.engine) ? scoreScale(type) : null;
    const field = type ? assignmentFields(type).find((f) => f.kind === 'numeric') : undefined;
    const raw = field ? this.assignment(name)?.config?.[field.key]?.trim() : undefined;
    const threshold = raw ? Number(raw) : null;
    const share = (x: number) =>
      scale ? Math.min(1, Math.max(0, (x - scale.min) / (scale.max - scale.min))) * 100 : null;
    return {
      value: r.score.toFixed(4),
      needs:
        threshold != null && !Number.isNaN(threshold) && type?.comparison
          ? `needs ${type.comparison === 'gte' ? 'at least' : 'at most'} ${threshold}` +
            (scale ? `, of ${scale.min} to ${scale.max}` : '')
          : null,
      pct: share(r.score),
      at: threshold != null && !Number.isNaN(threshold) ? share(threshold) : null,
    };
  }

  checksSub = computed(() =>
    this.checks().some((c) => !c.passed)
      ? 'What each one made of the answer - not met first'
      : 'What each one made of the answer',
  );
  /** Nothing to list, and why. */
  noChecks = computed(() => {
    const r = this.run();
    const names = (r?.test_type_assignments ?? []).map(checkName);
    if (r?.status === 'NotRan')
      return {
        title: 'Nothing was checked.',
        text: names.length
          ? `With no answer, ${listed(names)} had nothing to read - see what went wrong, above.`
          : 'See what went wrong, above.',
      };
    if (isInFlight(r?.status))
      return {
        title: 'Not checked yet.',
        text: 'Each check reads the answer once the run has it.',
      };
    return { title: 'No checks.', text: 'The test had no checks when it ran.' };
  });

  /** Some checks read their own part of the reply. */
  ownPaths = computed(() => this.checks().some((c) => c.need.some((l) => l.label === 'Read from')));
  answerSub = computed(() => {
    const all = this.checks();
    const own = all.filter((c) => c.need.some((l) => l.label === 'Read from')).length;
    if (!own) return 'What the checks read';
    return own === all.length
      ? 'What the checks read - each from its own part of the reply'
      : 'What the checks read - some from their own part of the reply';
  });
  /** The answer the checks read. "" is a real answer (a refusal, a cut-off): said, not hidden. A
   *  JSON object or array is pretty-printed as code. */
  answer = computed(() => {
    const r = this.run();
    const v = r?.evaluated_output;
    if (v == null) return null;
    const live = r?.output_source === 'application';
    const caption = live ? 'From your application' : 'The recorded answer';
    if (v === '') return { caption, live, empty: true, json: false, text: '' };
    const pretty = prettyJson(v);
    return { caption, live, empty: false, json: pretty != null, text: pretty ?? v };
  });
  noAnswer = computed(() => {
    const r = this.run();
    if (r?.status === 'NotRan')
      return { title: 'No answer came back.', text: 'See what went wrong, above.' };
    if (isInFlight(r?.status))
      return { title: 'No answer yet.', text: 'It shows here once the run has it.' };
    return { title: 'No answer kept.', text: 'This run kept no answer.' };
  });
  /** The application's whole reply, folded - null when the run kept none (a recorded answer,
   *  Not Ran, older runs). */
  replyText = computed(() => {
    const reply = this.run()?.application_reply;
    if (reply == null) return null;
    return typeof reply === 'string' ? reply : JSON.stringify(reply, null, 2);
  });
  /** "Contains, at $.stop_reason · ROUGE · Relevance, with its own rubric". */
  checkLine = computed(() =>
    (this.run()?.test_type_assignments ?? []).map((a) => ({
      name: checkName(a),
      path: a.answer_path ?? null,
      rubric: !!a.config?.['rubric']?.trim(),
    })),
  );
}
