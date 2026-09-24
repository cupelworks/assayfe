import { Component, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RunDetails, StandaloneRunDetails, TestTypeAssignment } from '../api/models';
import { rel, statusColor } from '../shared/format';

/** Status / error / scores (left) + frozen or live test content (right). */
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
          <div class="muted">
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
          <div class="label">Scores</div>
          @for (s of scores(); track s.name) {
            <div class="score">
              <div class="strong">{{ s.name }}</div>
              <div class="val">{{ s.value }}</div>
              <div class="track"><div [style.width]="s.pct"></div></div>
            </div>
          } @empty {
            <div class="score muted">
              {{
                r.status === 'Completed'
                  ? 'No scores recorded.'
                  : 'No scores yet - run is ' + r.status + '.'
              }}
            </div>
          }
        </div>
      </div>
      <div class="cell col">
        <div class="row-head">
          <h2>{{ heading() }}</h2>
          @if (snapshotAt()) {
            <span class="small">snapshot {{ rel(snapshotAt()) }}</span>
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
  statusColor = statusColor;
  scores = computed(() =>
    Object.entries(this.run()?.scores ?? {}).map(([name, v]) => ({
      name,
      value: v.toFixed(3),
      pct: Math.min(1, Math.max(0, v)) * 100 + '%',
    })),
  );
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
