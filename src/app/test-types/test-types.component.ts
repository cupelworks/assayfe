import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TestTypesStore, CATEGORIES, needsSetup } from '../api/test-types.store';
import { TestCategory, TestType } from '../api/models';
import { RelTimeComponent } from '../shared/rel-time.component';

@Component({
  selector: 'assay-test-types',
  standalone: true,
  imports: [FormsModule, RelTimeComponent],
  templateUrl: './test-types.component.html',
  styleUrls: ['../shared/page.css', './test-types.component.css'],
})
export class TestTypesComponent implements OnInit {
  store = inject(TestTypesStore);
  categories = CATEGORIES;
  needsSetup = needsSetup;
  category = signal<TestCategory | 'all'>('all');
  showInactive = signal(false);
  filter = signal('');
  openId = signal<string | null>(null);

  /** Active-only counts on the category tiles - inactive types don't inflate the headline number. */
  counts = computed(
    () =>
      Object.fromEntries(
        CATEGORIES.map((c) => [
          c.key,
          this.store.byCategory(c.key).filter((t) => t.is_active).length,
        ]),
      ) as Record<TestCategory, number>,
  );
  /** Clicking a tile narrows to just that category; clicking the active one clears back to all. */
  groups = computed(() => {
    const f = this.filter().toLowerCase(),
      cat = this.category(),
      inactive = this.showInactive();
    return CATEGORIES.filter((c) => cat === 'all' || c.key === cat).map((c) => ({
      ...c,
      types: this.store
        .byCategory(c.key)
        .filter(
          (t) =>
            (inactive || t.is_active) &&
            (!f || (t.name + ' ' + t.description + ' ' + t.best_for).toLowerCase().includes(f)),
        ),
    }));
  });
  total = computed(() => this.groups().reduce((n, g) => n + g.types.length, 0));

  ngOnInit() {
    this.store.load();
  }
  toggleCategory(c: TestCategory) {
    this.category.set(this.category() === c ? 'all' : c);
  }
  toggle(t: TestType) {
    this.openId.update((o) => (o === t.id ? null : t.id));
  }
}
