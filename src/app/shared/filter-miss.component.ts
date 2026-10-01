import { Component, computed, input } from '@angular/core';
import { Paged } from './paged';
import { TextFilter } from './text-filter';

/**
 * A list's empty row while its filter is on: the filter only searches the page being shown (the
 * API has no search), so "nothing here" isn't "nothing at all" - say so, as plain text, and point
 * at the pager's Previous / Next. On a single page it just says nothing matches.
 */
@Component({
  selector: 'assay-filter-miss',
  standalone: true,
  template: `@if (pages()) {
      No {{ noun() }} on this page matches "{{ filter().query() }}". The filter only searches the
      page you're on - use Previous or Next to search the other pages, or clear the filter.
    } @else {
      No {{ noun() }} matches "{{ filter().query() }}". Clear the filter to see them all.
    }`,
})
export class FilterMissComponent {
  /** What the list holds, singular: "test", "dataset", "test set". */
  noun = input.required<string>();
  filter = input.required<TextFilter<any>>();
  page = input.required<Paged<any>>();
  /** More than one page, so other pages may hold a match. */
  pages = computed(() => this.page().total() > this.page().limit());
}
