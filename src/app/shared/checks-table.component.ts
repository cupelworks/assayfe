import { Component, OnInit, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NumberInputDirective } from './number';
import { ChevronComponent } from './chevron.component';
import { TestCategory, TestType } from '../api/models';
import {
  ANSWER_PATH,
  CATEGORIES,
  TestTypesStore,
  assignmentFields,
  isCodeField,
  numericFieldHint,
} from '../api/test-types.store';
import { CheckDraft, LABEL_MAX, duplicateLabels, effectiveLabels, newCheck } from '../api/checks';

/**
 * A test's checks as one table - Type | Name | Settings | Remove - with checks of the same type
 * grouped together and "+ Add another <type>" under each group, and "+ Add a test type" below,
 * which opens the catalogue in place: a search, the categories with their counts on the left,
 * and the types with their description and tags on the right, in a fixed-height list that
 * scrolls however long the catalogue gets. Used by the test form and the dataset batch.
 *
 * Each row: the check's name (empty = the name the API will give it, shown as the example -
 * `effectiveLabels`); its type's settings, one field per non-reference config field, rendered by
 * kind (numbers through the shared `assayNumber` input, a JSONPath on one line, everything else
 * a box that grows with its text), each with the API's placeholder and hint; and under them a
 * collapsed "Advanced" with the check's answer path. A type with no settings says so on the
 * field line, Advanced under it. Every cell starts below the same label line, so a row's name,
 * fields and Remove share one baseline.
 */
@Component({
  selector: 'assay-checks-table',
  standalone: true,
  imports: [FormsModule, RouterLink, NumberInputDirective, ChevronComponent],
  templateUrl: './checks-table.component.html',
  styleUrls: ['./page.css', './checks-table.component.css'],
})
export class ChecksTableComponent implements OnInit {
  checks = model.required<CheckDraft[]>();
  /** Whether the item has an expected output, for types that compare against it; null when
   *  every item brings its own (the dataset batch's rows), so it's never "needed". */
  hasReference = input<boolean | null>(false);
  hint = input("how the output is evaluated; a test with none can't be run");

  store = inject(TestTypesStore);
  categories = CATEGORIES;
  answerPath = ANSWER_PATH;
  labelMax = LABEL_MAX;
  isCode = isCodeField;
  numericFieldHint = numericFieldHint;

  pickerOpen = signal(false);
  search = signal('');
  category = signal<TestCategory | null>(null);
  hideSetup = signal(false);
  /** Checks whose Advanced is open, by key. */
  private advanced = signal<ReadonlySet<number>>(new Set());

  ngOnInit() {
    this.store.load();
    // A check that already reads its own path opens with Advanced open - never hidden.
    this.advanced.set(
      new Set(
        this.checks()
          .filter((c) => c.answerPath.trim())
          .map((c) => c.key),
      ),
    );
  }

  /** Rows grouped by type, groups in the order their type first appears. */
  groups = computed(() => {
    const checks = this.checks();
    const labels = effectiveLabels(checks);
    const dups = duplicateLabels(checks);
    const byName = this.store.byName();
    const order: string[] = [];
    for (const c of checks) if (!order.includes(c.type)) order.push(c.type);
    return order.map((type) => {
      const t = byName.get(type);
      return {
        type,
        known: !!t,
        rows: checks
          .map((c, i) => ({ c, label: labels[i] }))
          .filter(({ c }) => c.type === type)
          .map(({ c, label }) => ({
            check: c,
            label,
            dup: dups.has(label.toLowerCase()),
            fields: t ? assignmentFields(t) : [],
            comparison: t?.comparison ?? null,
          })),
      };
    });
  });

  // - editing -
  private patch(key: number, p: Partial<CheckDraft>) {
    this.checks.update((cs) => cs.map((c) => (c.key === key ? { ...c, ...p } : c)));
  }
  setLabel(c: CheckDraft, v: string) {
    this.patch(c.key, { label: v ?? '' });
  }
  /** v is a number (or null) from the numeric input, a string from the others - stored as text. */
  setConfig(c: CheckDraft, field: string, v: string | number | null) {
    this.patch(c.key, { config: { ...c.config, [field]: v == null ? '' : String(v) } });
  }
  setPath(c: CheckDraft, v: string) {
    this.patch(c.key, { answerPath: v ?? '' });
  }
  remove(c: CheckDraft) {
    this.checks.update((cs) => cs.filter((x) => x.key !== c.key));
  }
  add(type: string) {
    this.checks.update((cs) => [...cs, newCheck(type)]);
    this.pickerOpen.set(false);
    this.search.set('');
  }
  isAdvancedOpen(c: CheckDraft) {
    return this.advanced().has(c.key);
  }
  toggleAdvanced(c: CheckDraft) {
    const next = new Set(this.advanced());
    next.has(c.key) ? next.delete(c.key) : next.add(c.key);
    this.advanced.set(next);
  }
  /** A box's height in lines, from what it holds - or its example when empty - up to eight. */
  rows(value: string | undefined, placeholder: string | null | undefined, fieldCount: number) {
    const text = value || placeholder || '';
    const perLine = fieldCount > 1 ? 34 : 70;
    const lines = text
      .split('\n')
      .reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
    return Math.min(8, Math.max(1, lines));
  }

  // - the type picker -
  /** Does this type still need something the user hasn't given? A required reference field
   *  only while the item has no expected output; any other required field always - it can only
   *  be filled once the check exists. Drives the "needs setup" tag and the hide toggle. */
  needsAttention(t: TestType) {
    return t.config_fields.some(
      (f) => f.required && (f.kind !== 'reference' || this.hasReference() === false),
    );
  }
  inTest(name: string) {
    return this.checks().filter((c) => c.type === name).length;
  }
  /** The catalogue as the search and the toggle leave it - inactive types only when the test
   *  already has one ("kept for history, not offered"). */
  private matches = computed(() => {
    const q = this.search().trim().toLowerCase();
    const hide = this.hideSetup();
    const used = new Set(this.checks().map((c) => c.type));
    return (t: TestType) =>
      (t.is_active || used.has(t.name)) &&
      (!hide || !this.needsAttention(t)) &&
      (!q || `${t.name} ${t.description} ${t.best_for}`.toLowerCase().includes(q));
  });
  /** "All" plus each category, with how many types match in it. */
  categoryTabs = computed(() => {
    const ok = this.matches();
    const counts = CATEGORIES.map((c) => this.store.byCategory(c.key).filter(ok).length);
    return [
      { key: null, label: 'All', count: counts.reduce((a, b) => a + b, 0) },
      ...CATEGORIES.map((c, i) => ({ key: c.key, label: c.label, count: counts[i] })),
    ];
  });
  sections = computed(() => {
    const ok = this.matches();
    const cat = this.category();
    return CATEGORIES.filter((c) => !cat || c.key === cat)
      .map((c) => ({ ...c, items: this.store.byCategory(c.key).filter(ok) }))
      .filter((g) => g.items.length);
  });
}
