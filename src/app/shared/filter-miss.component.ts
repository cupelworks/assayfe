import { Component, computed, input } from '@angular/core';
import { Paged } from './paged';
import { TextFilter } from './text-filter';

/**
 * A list's empty row while its filter is on: the filter only searches the page being shown (the
 * API has no search), so "nothing here" isn't "nothing at all" - say so, with Previous / Next
 * right in the sentence to search the other pages, or clear the filter. On a single page it just
 * says nothing matches.
 */
@Component({
  selector: 'assay-filter-miss',
  standalone: true,
  template: `No {{ noun() }} {{ pages() ? 'on this page ' : '' }}matches "{{ filter().query() }}".
    @if (pages()) {
      The filter only searches the page you're on - use
      @if (hasPrev()) {
        <button type="button" class="go" (click)="prev()">Previous</button>
      }
      @if (hasPrev() && hasNext()) {
        or
      }
      @if (hasNext()) {
        <button type="button" class="go" (click)="next()">Next</button>
      }
      to search the other pages, or clear the filter.
    } @else {
      Clear the filter to see them all.
    }`,
  styles: [
    `
      .go {
        all: unset;
        cursor: pointer;
        font-weight: 800;
        color: var(--color-accent);
      }
      .go:hover {
        text-decoration: underline;
      }
      .go:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
      }
    `,
  ],
})
export class FilterMissComponent {
  /** What the list holds, singular: "test", "dataset", "test set". */
  noun = input.required<string>();
  filter = input.required<TextFilter<any>>();
  page = input.required<Paged<any>>();
  hasPrev = computed(() => this.page().offset() > 0);
  hasNext = computed(() => this.page().offset() + this.page().limit() < this.page().total());
  /** More than one page, so other pages may hold a match. */
  pages = computed(() => this.hasPrev() || this.hasNext());
  prev() {
    const p = this.page();
    p.go(Math.max(0, p.offset() - p.limit()));
  }
  next() {
    const p = this.page();
    p.go(p.offset() + p.limit());
  }
}
