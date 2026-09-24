import { Component, inject, input, output, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TestTypesStore, CATEGORIES } from '../api/test-types.store';
import { TestCategory, TestType } from '../api/models';

/**
 * Multi-select over the live test-type catalogue, with smart filtering so a growing
 * catalogue doesn't turn into a wall of checkboxes: inactive types are hidden unless
 * already assigned (they're "kept for history, not offered" - see the catalogue page),
 * a search box narrows by name/description/best-for, category chips narrow to one group,
 * and a toggle hides types that need setup the user hasn't done yet - a reference field
 * unsatisfied by the test's own expected_output, or any other required config_fields
 * entry, which (unlike a reference) has nowhere to be pre-filled before the type is even
 * selected, so it's always treated as outstanding until then. Backed by the shared
 * TestTypesStore.
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
  search = signal('');
  categoryFilter = signal<TestCategory | 'all'>('all');
  onlyCompatible = signal(false);

  /** Does this type still need something the user hasn't provided yet, right now? A required
   *  reference field only counts while hasReference() is false (it's satisfied independently of
   *  which types are selected, via the test's own expected_output field). Any other required
   *  field always counts - Regex Match's pattern, say, only exists once Regex Match itself is
   *  selected, so there's no "already satisfied" state to check for it in advance. Drives both
   *  the per-row tag and the "hide" toggle below. */
  needsAttention(t: TestType) {
    return t.config_fields.some(
      (f) => f.required && (f.kind !== 'reference' || !this.hasReference()),
    );
  }
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
              (!compatOnly || !this.needsAttention(t) || sel.includes(t.name)) &&
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
