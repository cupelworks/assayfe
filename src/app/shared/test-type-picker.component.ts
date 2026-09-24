import { Component, inject, input, output, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TestTypesStore, CATEGORIES, needsReference } from '../api/test-types.store';
import { TestCategory } from '../api/models';

/**
 * Multi-select over the live test-type catalogue, with smart filtering so a growing
 * catalogue doesn't turn into a wall of checkboxes: inactive types are hidden unless
 * already assigned (they're "kept for history, not offered" - see the catalogue page),
 * a search box narrows by name/description/best-for, category chips narrow to one group,
 * and - surfaced only when it would actually do something - a toggle hides types that
 * need a reference output the test doesn't have yet. Backed by the shared TestTypesStore.
 */
@Component({
  selector: 'assay-test-type-picker',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './test-type-picker.component.html',
  styleUrls: ['./page.css', './test-type-picker.component.css'],
})
export class TestTypePickerComponent implements OnInit {
  selected = input.required<string[]>();
  hasReference = input(false);
  selectedChange = output<string[]>();

  store = inject(TestTypesStore);
  categories = CATEGORIES;
  needsReference = needsReference;
  search = signal('');
  categoryFilter = signal<TestCategory | 'all'>('all');
  onlyCompatible = signal(false);

  groups = computed(() => {
    const f = this.search().trim().toLowerCase();
    const cat = this.categoryFilter();
    const compatOnly = this.onlyCompatible();
    const sel = this.selected();
    return CATEGORIES.filter((c) => cat === 'all' || c.key === cat)
      .map((c) => ({
        ...c,
        items: this.store
          .byCategory(c.key)
          .filter(
            (t) =>
              (t.is_active || sel.includes(t.name)) &&
              (!compatOnly || !needsReference(t) || this.hasReference() || sel.includes(t.name)) &&
              (!f || (t.name + ' ' + t.description + ' ' + t.best_for).toLowerCase().includes(f)),
          ),
      }))
      .filter((g) => g.items.length);
  });
  /** Assigned names the catalogue no longer recognises (renamed/removed on the server) - kept removable rather than silently dropped. */
  unknown = computed(() => this.selected().filter((n) => !this.store.byName().has(n)));

  ngOnInit() {
    this.store.load();
  }

  toggleCategory(c: TestCategory) {
    this.categoryFilter.set(this.categoryFilter() === c ? 'all' : c);
  }
  toggle(name: string) {
    const s = this.selected();
    this.selectedChange.emit(s.includes(name) ? s.filter((x) => x !== name) : [...s, name]);
  }
  remove(name: string) {
    this.selectedChange.emit(this.selected().filter((x) => x !== name));
  }
}
