/**
 * What a list says when its words leave nothing: the filter only searches the page being shown
 * (the API has no search), so "nothing here" isn't "nothing at all" - say so, as plain text, and
 * point at the pager's Previous / Next. On a single page it just says nothing matches.
 */
export function filterMissText(noun: string, words: string, pages: boolean) {
  return pages
    ? `No ${noun} on this page matches "${words}". The filter only searches the page you're on - use Previous or Next to search the other pages, or clear the filter.`
    : `No ${noun} matches "${words}". Clear the filter to see them all.`;
}
