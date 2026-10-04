import { Component, inject, signal, computed, OnInit } from '@angular/core';
import {
  TestTypesStore,
  CATEGORIES,
  needsSetup,
  costLabel,
  engineSettingsLabel,
  numericFieldHint,
  defaultRubric,
} from '../api/test-types.store';
import { TestType } from '../api/models';
import { RelTimeComponent } from '../shared/rel-time.component';
import { GuideHeadComponent } from '../shared/guide/guide-head.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { numbered } from '../shared/guide/guide-sections';
import { CATALOG, CatalogColumn, CatalogKeyItem, CatalogTag } from '../shared/catalog';
import { TextFilter } from '../shared/text-filter';
import { OpenOne } from '../shared/open-one';
import { counted } from '../shared/format';

/** The categories as the page's sections: numbered 01-03, anchored `category-<key>`. */
const SECTIONS = numbered(
  'category-',
  CATEGORIES.map((c) => ({ id: c.key, label: c.label })),
);
const KEY: CatalogKeyItem[] = [
  { tag: { text: 'fast' }, text: 'relative cost to compute' },
  { tag: { text: 'needs setup', look: 'boxed' }, text: 'requires input before it can be scored' },
  { tag: { text: 'inactive', look: 'boxed' }, text: 'kept for history, not offered' },
];
const COLUMNS: CatalogColumn[] = [
  { label: 'Type', width: 2 },
  { label: 'What it checks', width: 3 },
  { label: 'Best for', width: 2 },
  { label: 'Limitations', width: 2 },
];
/** A type's tags: its cost, then what it needs or is. */
const tagsOf = (t: TestType): CatalogTag[] => [
  { text: costLabel(t) },
  ...(needsSetup(t) ? [{ text: 'needs setup', look: 'boxed' as const }] : []),
  ...(t.is_active ? [] : [{ text: 'inactive', look: 'boxed' as const }]),
];

/**
 * The test types catalogue, laid out like the Guide and Charts (`shared/guide`, `shared/catalog`):
 * a key to the tags, an index of the three categories - a tile shows only its category - and a
 * filter; then a section per category, its types in a ruled table, a row opening for its engine,
 * settings, rubric and configuration.
 */
@Component({
  selector: 'assay-test-types',
  standalone: true,
  imports: [RelTimeComponent, GuideHeadComponent, GuideSectionComponent, CATALOG],
  templateUrl: './test-types.component.html',
  styleUrls: [
    '../shared/guide/guide.css',
    '../shared/catalog/catalog.css',
    './test-types.component.css',
  ],
})
export class TestTypesComponent implements OnInit {
  store = inject(TestTypesStore);
  engineSettingsLabel = engineSettingsLabel;
  numericFieldHint = numericFieldHint;
  defaultRubric = defaultRubric;
  key = KEY;
  columns = COLUMNS;
  category = signal<string | null>(null);
  showInactive = signal(false);
  filter = new TextFilter<TestType>((t) => `${t.name} ${t.description} ${t.best_for} ${t.engine}`);
  open = new OpenOne();

  /** A tile per category, counting active types only - inactive ones don't inflate the number. */
  index = computed(() =>
    CATEGORIES.map((c, i) => ({
      key: c.key,
      no: SECTIONS[i].no,
      label: c.label,
      blurb: c.blurb,
      count: this.store.byCategory(c.key).filter((t) => t.is_active).length,
    })),
  );
  /** The categories shown - only the selected tile's, when one is - with their types that pass
   *  the filter (and the inactive ones, when asked for). */
  groups = computed(() => {
    const only = this.category(),
      inactive = this.showInactive(),
      filtered = !!this.filter.query();
    return CATEGORIES.map((c, i) => ({ c, section: SECTIONS[i] }))
      .filter(({ c }) => !only || c.key === only)
      .map(({ c, section }) => {
        const types = this.filter
          .apply(this.store.byCategory(c.key).filter((t) => inactive || t.is_active))
          .map((t) => ({ t, tags: tagsOf(t) }));
        return {
          key: c.key,
          section,
          label: c.label,
          sub: counted(types.length, 'type'),
          types,
          empty: types.length
            ? null
            : `No ${inactive ? '' : 'active '}types in this category${filtered ? ' match the filter' : ''}.`,
        };
      });
  });
  total = computed(() => this.groups().reduce((n, g) => n + g.types.length, 0));

  ngOnInit() {
    this.store.load();
  }
}
