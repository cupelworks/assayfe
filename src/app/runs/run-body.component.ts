import { Component, inject, input, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  RunDetails,
  StandaloneRunDetails,
  TestTypeAssignment,
  TestTypeResult,
} from '../api/models';
import { rel, absTime, statusColor, statusLabel } from '../shared/format';
import { RelTimeComponent } from '../shared/rel-time.component';
import { TestTypesStore, assignmentFields } from '../api/test-types.store';

/** Status / error / per-type results (left) + frozen or live test content (right). */
@Component({
  selector: 'assay-run-body',
  standalone: true,
  imports: [RouterLink, RelTimeComponent],
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
              @if (s.valueText) {
                <div class="val">{{ s.valueText }}</div>
              }
              @if (s.pct) {
                <div class="track"><div [style.width]="s.pct"></div></div>
              }
              @for (c of s.config; track c.key) {
                <div class="detail muted cfg" [class.clamp]="c.long && !isConfigOpen(c.key)">
                  <span class="strong">{{ c.label }}:</span> {{ c.value }}
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
              @if (s.engineText) {
                <div class="detail small muted">{{ s.engineText }}</div>
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
            <div class="body">{{ r.evaluated_output }}</div>
          </div>
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
   *  value over 140 chars (a rubric, typically) is flagged `long` for the template to clamp. */
  private configFields(
    name: string,
  ): { key: string; label: string; value: string; long: boolean }[] {
    const config = this.content()?.test_type_assignments?.find((a) => a.name === name)?.config;
    const type = this.testTypes.byName().get(name);
    if (!config || !type) return [];
    return assignmentFields(type)
      .filter((f) => config[f.key] != null && config[f.key] !== '')
      .map((f) => ({
        key: `${name}:${f.key}`,
        label: f.label,
        value: config[f.key],
        long: f.kind !== 'numeric' && config[f.key].length > 140,
      }));
  }
  results = computed(() =>
    Object.entries(this.run()?.results ?? {}).map(([name, r]) => ({
      name,
      passed: r.passed,
      valueText: r.score != null ? r.score.toFixed(3) : null,
      pct: this.resultPct(name, r.score),
      detail: r.detail,
      config: this.configFields(name),
      engineText: this.engineText(r),
    })),
  );
  /** "engine: regex · mode=search, timeout_seconds=1" - secondary/technical info per result, only
   *  shown when the backend actually stamped an engine on it (null on legacy results, and on a
   *  type no longer in the catalogue at execution time). */
  private engineText(r: TestTypeResult): string | null {
    if (!r.engine) return null;
    const settings = Object.entries(r.engine_settings ?? {}).map(([k, v]) => `${k}=${v}`);
    return settings.length ? `engine: ${r.engine} · ${settings.join(', ')}` : `engine: ${r.engine}`;
  }
  /** Bar width for a result's score - null (no bar) when there's nothing to show yet (LLM judges
   *  can return no score at all). A threshold-scored type (`comparison` non-null) reports its
   *  score on that type's own native scale, matching its config_fields threshold min/max - not
   *  0-1 (BLEU is 0-100, Cosine Similarity is -1 to 1) - so the bar scales by where the score
   *  falls in that range, not by clamping the raw score itself. A type with no threshold
   *  (Exact Match/Contains/Regex Match) scores a plain 0/1, which is already a 0-1 fraction. */
  private resultPct(name: string, score: number | null): string | null {
    if (score == null) return null;
    const type = this.testTypes.byName().get(name);
    const threshold = type ? assignmentFields(type).find((f) => f.kind === 'numeric') : null;
    const ratio =
      type?.comparison && threshold?.min != null && threshold?.max != null
        ? (score - threshold.min) / (threshold.max - threshold.min)
        : score;
    return Math.min(1, Math.max(0, ratio)) * 100 + '%';
  }
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
