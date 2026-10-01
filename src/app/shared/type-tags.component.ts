import { Component, computed, input } from '@angular/core';
import { TestTypeAssignment } from '../api/models';
import { typeCounts } from '../api/checks';

/** A test's checks as one tag per type, with a count when the type repeats ("Contains ×2") - on
 *  the tests list, the test page, test set entries and a run's recorded test. Pages that list
 *  each check on its own row (the form, a run's results) show check names instead. */
@Component({
  selector: 'assay-type-tags',
  standalone: true,
  template: `<div class="tags">
    @for (t of types(); track t.name) {
      <span class="tag tag-outline"
        >{{ t.name }}
        @if (t.count > 1) {
          <span class="count">×{{ t.count }}</span>
        }
      </span>
    } @empty {
      @if (empty(); as e) {
        <span class="small">{{ e }}</span>
      }
    }
  </div>`,
  styleUrls: ['./page.css'],
  styles: [
    `
      .count {
        margin-left: 5px;
        opacity: 0.75;
        font-variant-numeric: tabular-nums;
      }
    `,
  ],
})
export class TypeTagsComponent {
  assignments = input<readonly TestTypeAssignment[] | null | undefined>();
  /** Shown when the test has no checks; nothing when null. */
  empty = input<string | null>(null);
  types = computed(() => typeCounts(this.assignments()));
}
