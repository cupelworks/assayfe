import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { TestTypeAssignment } from '../api/models';
import { TestTypesStore, assignmentFields, isCodeField } from '../api/test-types.store';
import { checkName } from '../api/checks';

/** How many checks show before "Show all N checks". */
const FIRST = 5;

/**
 * A test's checks, read-only, on the test page - the form's table without inputs: Type | Name |
 * Settings, checks of a type grouped under it. Each check's settings on one line ("Required
 * substring: 4471 · …", code values in monospace, an unset rubric as "Default rubric", a type
 * with none as "No settings"), cut with "…" when long - the full text on hover - and a
 * "reads $.x" mark when it reads its own path. A test with many checks shows the first five and
 * "Show all N checks", so the page never turns into a wall of rows.
 */
@Component({
  selector: 'assay-checks-view',
  standalone: true,
  templateUrl: './checks-view.component.html',
  styleUrls: ['./page.css', './checks-view.component.css'],
})
export class ChecksViewComponent implements OnInit {
  assignments = input<readonly TestTypeAssignment[] | null | undefined>();
  /** Shown when the test has no checks. */
  empty = input<string>('');
  private store = inject(TestTypesStore);
  expanded = signal(false);
  first = FIRST;

  ngOnInit() {
    this.store.load();
  }

  private rows = computed(() => {
    const byName = this.store.byName();
    const list = this.assignments() ?? [];
    const order: string[] = [];
    for (const a of list) if (!order.includes(a.name)) order.push(a.name);
    // Grouped by type, in the order types first appear; each row knows if it starts its group.
    return order.flatMap((type) =>
      list
        .filter((a) => a.name === type)
        .map((a, i) => ({
          key: checkName(a),
          type,
          first: i === 0,
          name: checkName(a),
          settings: this.settingsOf(a, byName.get(type)),
          path: a.answer_path?.trim() || null,
        })),
    );
  });
  total = computed(() => this.rows().length);
  /** The rows shown: all, or the first few - never cutting a group's type label off its rows. */
  shown = computed(() => {
    const rows = this.rows();
    if (this.expanded() || rows.length <= FIRST) return rows;
    return rows.slice(0, FIRST);
  });

  /** One line of "Label: value" parts, by the type's own field labels. */
  private settingsOf(
    a: TestTypeAssignment,
    t: ReturnType<TestTypesStore['byName']> extends Map<string, infer T> ? T | undefined : never,
  ): { label: string; value: string; mono: boolean }[] | string {
    const config = a.config ?? {};
    if (!t) {
      const raw = Object.entries(config);
      return raw.length
        ? raw.map(([k, v]) => ({ label: k, value: v, mono: false }))
        : 'Not in the catalogue';
    }
    const fields = assignmentFields(t);
    if (!fields.length) return 'No settings';
    const parts = fields
      .map((f) => {
        const v = config[f.key]?.trim();
        if (v) return { label: f.label, value: v, mono: isCodeField(f) };
        return f.kind === 'rubric' ? { label: 'Default rubric', value: '', mono: false } : null;
      })
      .filter((p): p is { label: string; value: string; mono: boolean } => !!p);
    return parts.length ? parts : 'Defaults';
  }
  /** The settings as plain text, for the hover title on a line cut short. */
  titleOf(s: { label: string; value: string }[] | string) {
    return typeof s === 'string'
      ? s
      : s.map((p) => (p.value ? `${p.label}: ${p.value}` : p.label)).join(' · ');
  }
  isText(s: unknown): s is string {
    return typeof s === 'string';
  }
}
