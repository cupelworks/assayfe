import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { StatusMarkComponent } from '../status-mark.component';
import { FilterChoice, FilterFacet, FilterItem, FilterValue, chosenCount } from './filters';

/** A suggestion under the line, as you type. */
interface Suggestion {
  id: string;
  kind: 'value' | 'item' | 'kind' | 'words';
  /** The label, split around what was typed - the match in bold red. */
  before: string;
  match: string;
  after: string;
  count: string;
  facet?: FilterFacet;
  value?: FilterValue;
  link?: unknown[];
}
interface SuggestionGroup {
  label: string;
  opts: Suggestion[];
}

/** How many of a facet's values its panel shows before "N more - find them by name". */
const FIRST_VALUES = 10;
/** How many suggestions a group offers. */
const PER_GROUP = 5;

let next = 0;

/** "ROUGE-L" around "rou": "", "ROU", "GE-L". */
function split(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q);
  return i < 0
    ? { before: text, match: '', after: '' }
    : {
        before: text.slice(0, i),
        match: text.slice(i, i + q.length),
        after: text.slice(i + q.length),
      };
}

/**
 * The smart filter of a work list: one line for words and filters. What's typed searches the
 * list's words (`query`) and is looked for in the facets' values, the list's things (`items`, to
 * open one) and the facets' names; Enter keeps the words as a token (`words`), so they stay while
 * filters are added. Each chosen filter is a token in the line - × (or Backspace on an empty line)
 * takes it out. Under the line, each facet opens its values with their counts; a facet with many
 * has a line to find one. Beside it: how many are shown, the sort, "Clear all". `compact` (a pick
 * dialog's) keeps only the line.
 *
 * It holds the choice and nothing else: the page applies what it can (see filters.ts).
 */
@Component({
  selector: 'assay-smart-filter',
  standalone: true,
  imports: [StatusMarkComponent],
  host: { '[class.compact]': 'compact()', '(document:click)': 'outside($event)' },
  templateUrl: './smart-filter.component.html',
  styleUrl: './smart-filter.component.css',
})
export class SmartFilterComponent {
  private el = inject(ElementRef<HTMLElement>);
  private router = inject(Router);
  readonly id = `sf${next++}`;

  facets = input<FilterFacet[]>([]);
  /** Things the words can name, to open: "Tests" and the tests. */
  items = input<FilterItem[]>([]);
  itemsLabel = input('Open');
  placeholder = input('');
  /** Over the line, in small capitals: "Filter", "Find a row". */
  caption = input('Filter');
  label = input('Filter');
  /** "62 shown", "3 of 25 shown". */
  shown = input('');
  sortOptions = input<string[]>([]);
  /** Only the line - a pick dialog's. */
  compact = input(false);

  query = model('');
  words = model<string | null>(null);
  chosen = model<FilterChoice>({});
  sort = model('');
  /** A facet's panel was opened - a page may load its counts then. */
  opened = output<string>();

  focused = signal(false);
  active = signal(0);
  openFacet = signal<string | null>(null);
  /** On a phone the facets fold under one "Filters" button. */
  facetsShown = signal(false);
  find = signal('');

  tokens = computed(() => {
    const out: { key: string; facet: string; value: string }[] = [];
    const w = this.words();
    if (w) out.push({ key: '', facet: 'Words', value: `“${w}”` });
    const choice = this.chosen();
    for (const f of this.facets()) {
      const keys = choice[f.key] ?? [];
      if (!keys.length) continue;
      const labels = keys.map((k) => f.values.find((v) => v.key === k)?.label ?? k);
      out.push({ key: f.key, facet: f.label, value: labels.join(' or ') });
    }
    return out;
  });
  chosenTotal = computed(() => chosenCount(this.chosen()));
  anything = computed(() => !!this.query() || !!this.words() || this.chosenTotal() > 0);

  groups = computed<SuggestionGroup[]>(() => {
    const raw = this.query().trim();
    const q = raw.toLowerCase();
    if (!q) return [];
    const groups: SuggestionGroup[] = [];
    const choice = this.chosen();
    for (const f of this.facets()) {
      const opts = f.values
        .filter(
          (v) =>
            v.label.toLowerCase().includes(q) &&
            v.count !== 0 &&
            !(choice[f.key] ?? []).includes(v.key),
        )
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
        .slice(0, PER_GROUP)
        .map((v) => ({
          id: '',
          kind: 'value' as const,
          ...split(v.label, q),
          count: v.count == null ? '' : String(v.count),
          facet: f,
          value: v,
        }));
      if (opts.length) groups.push({ label: f.label, opts });
    }
    const items = this.items()
      .filter((i) => i.label.toLowerCase().includes(q))
      .slice(0, 3)
      .map((i) => ({
        id: '',
        kind: 'item' as const,
        ...split(i.label, q),
        count: 'open →',
        link: i.link,
      }));
    if (items.length) groups.push({ label: this.itemsLabel(), opts: items });
    const kinds = this.compact()
      ? []
      : this.facets()
          .filter((f) => f.label.toLowerCase().includes(q))
          .map((f) => ({
            id: '',
            kind: 'kind' as const,
            ...split(f.label, q),
            count: 'its values ›',
            facet: f,
          }));
    if (kinds.length) groups.push({ label: 'Filter by', opts: kinds });
    groups.push({
      label: 'Words',
      opts: [
        {
          id: '',
          kind: 'words',
          before: 'Look for “',
          match: raw,
          after: '” in the names and the inputs',
          count: 'Enter',
        },
      ],
    });
    // Each option numbered in order, for the keyboard and aria-activedescendant.
    let n = 0;
    for (const g of groups) for (const o of g.opts) o.id = `${this.id}-o${n++}`;
    return groups;
  });
  private options = computed(() => this.groups().flatMap((g) => g.opts));
  popOpen = computed(() => this.focused() && !!this.query().trim());
  activeId = computed(() => (this.popOpen() ? this.options()[this.active()]?.id : undefined));

  type(text: string) {
    this.query.set(text);
    this.active.set(0);
    this.focused.set(true);
    this.openFacet.set(null);
  }

  key(e: KeyboardEvent) {
    const n = this.options().length;
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      this.active.set((this.active() + 1) % n);
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      this.active.set((this.active() - 1 + n) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = this.options()[this.active()];
      if (o) this.choose(o);
    } else if (e.key === 'Escape') {
      this.focused.set(false);
      this.openFacet.set(null);
    } else if (e.key === 'Backspace' && !this.query()) {
      const last = this.tokens().at(-1);
      if (last) this.removeToken(last.key);
    }
  }

  choose(o: Suggestion) {
    if (o.kind === 'value' && o.facet && o.value) this.pick(o.facet, o.value.key);
    else if (o.kind === 'item' && o.link) this.router.navigate(o.link);
    else if (o.kind === 'kind' && o.facet) this.toggleFacet(o.facet.key);
    else if (o.kind === 'words') this.words.set(this.query().trim() || null);
    this.query.set('');
    this.active.set(0);
  }

  removeToken(key: string) {
    if (!key) this.words.set(null);
    else this.chosen.set({ ...this.chosen(), [key]: [] });
  }

  clearAll() {
    this.query.set('');
    this.words.set(null);
    this.chosen.set({});
  }

  isOn(facet: string, value: string) {
    return (this.chosen()[facet] ?? []).includes(value);
  }
  countOf(facet: string) {
    return (this.chosen()[facet] ?? []).length;
  }

  /** Ticks a value - or, in a one-value facet, chooses it instead of the one before. */
  pick(f: FilterFacet, value: string) {
    const keys = this.chosen()[f.key] ?? [];
    const on = keys.includes(value);
    const next = f.single
      ? on
        ? []
        : [value]
      : on
        ? keys.filter((k) => k !== value)
        : [...keys, value];
    this.chosen.set({ ...this.chosen(), [f.key]: next });
  }

  clearFacet(key: string) {
    this.chosen.set({ ...this.chosen(), [key]: [] });
  }

  toggleFacet(key: string) {
    const open = this.openFacet() === key ? null : key;
    this.openFacet.set(open);
    this.find.set('');
    if (open) this.opened.emit(open);
  }

  /** A many-valued facet's values: those the find line names, the first ten. */
  valuesOf(f: FilterFacet) {
    const q = this.find().trim().toLowerCase();
    const found =
      f.many && q ? f.values.filter((v) => v.label.toLowerCase().includes(q)) : f.values;
    return { shown: f.many ? found.slice(0, FIRST_VALUES) : found, all: found.length };
  }
  moreText(f: FilterFacet) {
    const { shown, all } = this.valuesOf(f);
    if (!all) return `No ${f.label.toLowerCase()} by that name`;
    return all > shown.length ? `${all - shown.length} more - find them by name` : '';
  }

  outside(e: Event) {
    if (!this.el.nativeElement.contains(e.target as Node)) {
      this.focused.set(false);
      this.openFacet.set(null);
    }
  }
}
