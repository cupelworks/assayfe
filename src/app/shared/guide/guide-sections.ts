/** A section of a guide page (the Guide, Charts): its two-digit number, its label - the contents
 *  link and the section's title - and its element id, which a link's fragment lands on. */
export interface GuideSection {
  no: string;
  label: string;
  id: string;
}

/**
 * A guide's sections numbered in order - 01, 02, … Each one's element id is the prefix and its own
 * id (`chart-range`), or, given only its label, the prefix and its number (`guide-05`).
 */
export const numbered = (
  prefix: string,
  items: readonly (string | { id: string; label: string })[],
): GuideSection[] =>
  items.map((item, i) => {
    const no = String(i + 1).padStart(2, '0');
    return typeof item === 'string'
      ? { no, label: item, id: prefix + no }
      : { no, label: item.label, id: prefix + item.id };
  });
