import { Component, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RunDetails, StandaloneRunDetails, TestTypeAssignment } from '../api/models';
import { rel, absTime, statusColor } from '../shared/format';

/** Status / error / per-type results (left) + frozen or live test content (right). */
@Component({
  selector: 'assay-run-body',
  standalone: true,
  imports: [RouterLink],
  styleUrls: ['../shared/page.css', './run-body.component.css'],
  template: ` @if (run(); as r) {
    <section class="half">
      <div class="cell cell-r col">
        <div>
          <div class="label">Status</div>
          <div class="status-line">
            <span class="dot lg" [style.background]="statusColor(r.status)"></span>{{ r.status }}
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
              @if (s.detail) {
                <div class="detail muted">{{ s.detail }}</div>
              }
            </div>
          } @empty {
            <div class="score muted">
              {{
                r.status === 'NotRan'
                  ? 'Run failed before anything could be evaluated - see error above.'
                  : 'No results yet - run is ' + r.status + '.'
              }}
            </div>
          }
        </div>
      </div>
      <div class="cell col">
        <div class="row-head">
          <h2>{{ heading() }}</h2>
          @if (snapshotAt()) {
            <span class="small" [title]="absTime(snapshotAt())"
              >snapshot {{ rel(snapshotAt()) }}</span
            >
          }
        </div>
        <div class="tags">
          @for (t of content()?.test_type_assignments ?? []; track t.name) {
            <span class="tag tag-outline">{{ t.name }}</span>
          }
        </div>
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
  results = computed(() =>
    Object.entries(this.run()?.results ?? {}).map(([name, r]) => ({
      name,
      passed: r.passed,
      valueText: r.score != null ? r.score.toFixed(3) : null,
      pct: r.score != null ? Math.min(1, Math.max(0, r.score)) * 100 + '%' : null,
      detail: r.detail,
    })),
  );
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
