import { Component, inject, input, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  RunDetails,
  StandaloneRunDetails,
  TestTypeAssignment,
  TestTypeResult,
} from '../api/models';
import { rel, absTime, statusColor, statusLabel, prettyJson } from '../shared/format';
import { RelTimeComponent } from '../shared/rel-time.component';
import { ChevronComponent } from '../shared/chevron.component';
import { TestTypesStore, assignmentFields, engineSettingsLabel } from '../api/test-types.store';

/** Status / error / per-type results (left) + frozen or live test content (right). */
@Component({
  selector: 'assay-run-body',
  standalone: true,
  imports: [RouterLink, RelTimeComponent, ChevronComponent],
  styleUrls: ['../shared/page.css', './run-body.component.css'],
  template: ` @if (run(); as r) {
    <section class="half">
      <div class="cell cell-r col">
        <div>
          <div class="label">Status</div>
          <div class="status-line">
            <span class="dot lg" [style.background]="statusColor(r.status)"></span
            >{{ statusLabel(r.status) }}
          </div>
          <div
            class="muted"
            [title]="
              absTime(r.created_at) + (r.executed_at ? ' · executed ' + absTime(r.executed_at) : '')
            "
          >
            {{
              r.executed_at
                ? 'created ' + rel(r.created_at) + ' · executed ' + rel(r.executed_at)
                : 'created ' + rel(r.created_at) + ' · not executed yet'
            }}
          </div>
        </div>
        @if (r.error) {
          <pre class="error">{{ r.error }}</pre>
        }
        <div>
          <div class="row-head" style="margin-bottom: 12px">
            <div class="label">Results</div>
            @if (resultsSummary(); as summary) {
              <span class="small muted">{{ summary }}</span>
            }
          </div>
          @for (s of results(); track s.name) {
            <div class="score">
              <div class="strong">
                <span
                  class="dot"
                  [style.background]="
                    s.passed ? 'var(--color-status-green)' : 'var(--color-accent)'
                  "
                ></span>
                {{ s.name }}
              </div>
              @if (s.answerPath) {
                <div class="detail small muted">
                  read from <span class="mono">{{ s.answerPath }}</span>
                </div>
              }
              @if (s.valueText) {
                <div class="val">{{ s.valueText }}</div>
              }
              @if (s.pct) {
                <div class="track"><div [style.width]="s.pct"></div></div>
              }
              @for (c of s.config; track c.key) {
                <div class="detail muted cfg" [class.clamp]="c.long && !isConfigOpen(c.key)">
                  <span class="strong">{{ c.label }}:</span>
                  <span [class.mono]="c.mono">{{ c.value }}</span>
                </div>
                @if (c.long) {
                  <button type="button" class="more small" (click)="toggleConfig(c.key)">
                    {{ isConfigOpen(c.key) ? 'Less ↑' : 'More ↓' }}
                  </button>
                }
              }
              @if (s.detail) {
                <div class="detail muted">{{ s.detail }}</div>
              }
              @if (s.engine) {
                <div class="detail small muted">
                  <span class="strong">Engine:</span> {{ s.engine }}
                </div>
              }
              @if (s.engineSettings) {
                <div class="detail small muted">
                  <span class="strong">Engine settings:</span> {{ s.engineSettings }}
                </div>
              }
            </div>
          } @empty {
            <div class="score muted">
              {{
                r.status === 'NotRan'
                  ? 'Run failed before anything could be evaluated - see error above.'
                  : 'No results yet - run is ' + statusLabel(r.status) + '.'
              }}
            </div>
          }
        </div>
      </div>
      <div class="cell col">
        <div class="row-head">
          <h2>{{ heading() }}</h2>
          @if (snapshotAt()) {
            <span class="small">snapshot <assay-rel-time [iso]="snapshotAt()" /></span>
          }
        </div>
        <div class="tags">
          @for (t of content()?.test_type_assignments ?? []; track t.name) {
            <span class="tag tag-outline">{{ t.name }}</span>
          }
        </div>
        @if (r.evaluated_output != null) {
          <div class="field-ro">
            <div class="label">
              Evaluated output
              <span
                class="tag"
                [class.tag-accent]="r.output_source === 'application'"
                [class.tag-outline]="r.output_source !== 'application'"
                >{{ r.output_source === 'application' ? 'From application' : 'Recorded' }}</span
              >
            </div>
            @if (evaluated(); as ev) {
              @if (ev.empty) {
                <div class="body muted">(empty answer)</div>
              } @else {
                <div class="body" [class.mono]="ev.json">{{ ev.text }}</div>
              }
            }
            @if (r.output_source === 'application') {
              <div class="small source-note">
                Read from the application's reply at the Answer path in
                <a routerLink="/settings" class="plain">Settings</a>.
              </div>
            }
          </div>
        }
        @if (replyText(); as reply) {
          <details class="field-ro reply" (toggle)="replyOpen.set($any($event.target).open)">
            <summary class="label">
              Full application reply <assay-chevron [open]="replyOpen()" />
            </summary>
            <div class="body mono">{{ reply }}</div>
          </details>
        }
        @for (f of fields(); track f[0]) {
          <div class="field-ro">
            <div class="label">{{ f[0] }}</div>
            <div class="body">{{ f[1] }}</div>
          </div>
        }
        @if (sourceLink(); as l) {
          <a class="plain small" [routerLink]="l">Open originating test →</a>
        }
      </div>
    </section>
  }`,
})
export class RunBodyComponent {
  run = input.required<RunDetails | StandaloneRunDetails | null>();
  content = input<{
    input?: string;
    expected_output?: string | null;
    model_output?: string | null;
    test_type_assignments?: TestTypeAssignment[];
  } | null>(null);
  heading = input('Frozen entry');
  snapshotAt = input<string | null>(null);
  sourceLink = input<any[] | null>(null);
  rel = rel;
  absTime = absTime;
  statusColor = statusColor;
  statusLabel = statusLabel;
  private testTypes = inject(TestTypesStore);
  /** Which long config values (keyed "<type name>:<field key>") are expanded past their clamp -
   *  a rubric can run to a full paragraph, so it starts collapsed like a test type card's "More". */
  private openConfigKeys = signal<Set<string>>(new Set());
  constructor() {
    this.testTypes.load();
  }
  isConfigOpen(key: string) {
    return this.openConfigKeys().has(key);
  }
  toggleConfig(key: string) {
    this.openConfigKeys.update((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  /** The config the type was actually run with (e.g. "Minimum score to pass: 0.75") - without it
   *  a failed score like BERTScore 0.56 is unexplained, since the pass/fail line alone doesn't say
   *  what it needed to clear. One entry per field, labeled via the matching TestType's
   *  config_fields (assignmentFields excludes "reference", which never appears here); a non-numeric
   *  value over 140 chars (a rubric, typically) is flagged `long` for the template to clamp.
   *  A judge's rubric comes only from the result's own `rubric` stamp - what it actually graded
   *  with - as "Rubric" (its own, which replaced the default) or "Default rubric", never from the
   *  config's rubric field. No stamp means the judge wasn't asked (`detail` says why), so no
   *  rubric is shown - there are no pre-stamp results to cover, this version ships fresh. */
  private configFields(
    name: string,
    result: TestTypeResult,
  ): { key: string; label: string; value: string; long: boolean; mono: boolean }[] {
    const config = this.content()?.test_type_assignments?.find((a) => a.name === name)?.config;
    const type = this.testTypes.byName().get(name);
    const fields = type ? assignmentFields(type) : [];
    const valueOf = (key: string) => config?.[key]?.trim() || null;
    const rows = fields.flatMap((f) => {
      const value = f.kind === 'rubric' ? null : valueOf(f.key);
      return value
        ? [
            {
              key: `${name}:${f.key}`,
              label: f.label,
              value,
              long: f.kind !== 'numeric' && value.length > 140,
              mono: f.kind === 'json' || f.kind === 'jsonpath',
            },
          ]
        : [];
    });
    const rubric = result.rubric;
    if (rubric) {
      rows.push({
        key: `${name}:rubric`,
        label: rubric.source === 'custom' ? 'Rubric' : 'Default rubric',
        value: rubric.text,
        long: rubric.text.length > 140,
        mono: false,
      });
    }
    return rows;
  }
  results = computed(() =>
    Object.entries(this.run()?.results ?? {}).map(([name, r]) => ({
      name,
      passed: r.passed,
      // 4 decimals - the precision the backend keeps and quotes in a miss's detail ("0.3704 is
      // below the threshold 0.5"), so the number beside the bar matches it.
      valueText: r.score != null ? r.score.toFixed(4) : null,
      pct: this.resultPct(name, r),
      detail: r.detail,
      config: this.configFields(name, r),
      // What scored it, as stamped on the result at execution time - null on legacy results and
      // on a type that wasn't in the catalogue when the run executed, so both rows then hide.
      answerPath: r.answer_path ?? null,
      engine: r.engine ?? null,
      engineSettings: r.engine ? engineSettingsLabel(r.engine_settings) : null,
    })),
  );
  /** Bar width for a result's score - null (no bar) when there's no score: LLM judges and the
   *  deterministic types (every type on the exact_match / contains / regex engines, negated variants included) return `score: null` by contract, so
   *  they get the pass/fail dot only. A threshold-scored type (`comparison` non-null) reports its
   *  score on that type's own native scale, matching its config_fields threshold min/max - not
   *  0-1 (BLEU is 0-100, Cosine Similarity is -1 to 1) - so the bar scales by where the score
   *  falls in that range, not by clamping the raw score itself. The range is the catalogue's,
   *  but the score is the stamped engine's - so when the result names an engine that isn't the
   *  type's current one (the catalogue changed since the run), the range can't be trusted and
   *  there's no bar. Same when no range is known at all (type gone from the catalogue, a score
   *  the contract says the type shouldn't have, a degenerate min = max): the value still shows,
   *  the bar doesn't, rather than guessing a scale. */
  private resultPct(name: string, r: TestTypeResult): string | null {
    if (r.score == null) return null;
    const type = this.testTypes.byName().get(name);
    if (!type?.comparison || (r.engine && r.engine !== type.engine)) return null;
    const threshold = assignmentFields(type).find((f) => f.kind === 'numeric');
    if (threshold?.min == null || threshold?.max == null || threshold.max <= threshold.min)
      return null;
    const ratio = (r.score - threshold.min) / (threshold.max - threshold.min);
    return Math.min(1, Math.max(0, ratio)) * 100 + '%';
  }
  /** How to show the answer the checks judged. `""` is a real, scored answer (an application that
   *  refused or was cut off) - shown as "(empty answer)", since it's why most checks failed,
   *  rather than as a blank that looks like a rendering bug; null (not evaluated) hides the block
   *  in the template. A JSON object/array - a structured reply, or the whole reply read at "$" -
   *  is pretty-printed in monospace; anything else is shown as-is. An answer from the application
   *  also gets a one-line note that it was read at Settings' Answer path - without the path itself,
   *  since the run doesn't record which one was in effect and Settings may have changed since. */
  evaluated = computed(() => {
    const v = this.run()?.evaluated_output;
    if (v == null) return null;
    if (v === '') return { empty: true, text: '', json: false };
    const pretty = prettyJson(v);
    return { empty: false, text: pretty ?? v, json: pretty != null };
  });
  /** The application's whole reply, indented, for the collapsed "Full application reply" -
   *  secondary to Evaluated output (the answer the checks judged), so it starts closed; null when
   *  the run kept none (a recorded answer, NotRan, older runs). */
  /** Mirrors the reply <details>' own open state, for its chevron. */
  replyOpen = signal(false);
  replyText = computed(() => {
    const reply = this.run()?.application_reply;
    if (reply == null) return null;
    return typeof reply === 'string' ? reply : JSON.stringify(reply, null, 2);
  });
  /** "2 of 3 test types passed" - a headline the per-type dots+labels otherwise make the reader
   *  count out themselves. Null (hidden) while there's nothing to summarize yet. */
  resultsSummary = computed(() => {
    const r = this.results();
    if (!r.length) return null;
    const passed = r.filter((x) => x.passed).length;
    return `${passed} of ${r.length} test type${r.length === 1 ? '' : 's'} passed`;
  });
  fields = computed(() => {
    const c = this.content();
    return c
      ? ([
          ['Input', c.input],
          ['Expected output', c.expected_output],
          ['Model output', c.model_output],
        ].filter((f) => f[1]) as [string, string][])
      : [];
  });
}
