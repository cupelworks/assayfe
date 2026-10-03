/** A link of the header: where it goes, and its words; `exact` when only that path is it (the
 *  Overview's `/`). */
export interface NavLink {
  path: string;
  label: string;
  exact?: boolean;
}
/** A Reference page: numbered across Reference, with the first words of its own lede. */
export interface ReferencePage extends NavLink {
  no: string;
  blurb: string;
}

/** The work, in the bar and atop the phone's menu. */
export const WORK: NavLink[] = [
  { path: '/', label: 'Overview', exact: true },
  { path: '/datasets', label: 'Datasets' },
  { path: '/tests', label: 'Tests' },
  { path: '/test-sets', label: 'Test sets' },
  { path: '/test-plans', label: 'Test plans' },
];

const GROUPS: { label: string; pages: Omit<ReferencePage, 'no'>[] }[] = [
  {
    label: 'Catalog',
    pages: [
      {
        path: '/test-types',
        label: 'Test types',
        blurb: 'The evaluation strategies a test can be assigned.',
      },
      {
        path: '/statistical-tests',
        label: 'Statistical tests',
        blurb: 'What a batch can ask, how many times it needs, and how to read its answer.',
      },
    ],
  },
  {
    label: 'Guide',
    pages: [
      {
        path: '/charts',
        label: 'Charts',
        blurb: "Each chart shows a result next to the line it's judged against.",
      },
      {
        path: '/guide',
        label: 'Guide',
        blurb: 'The mental model behind datasets, tests, test sets, test plans and runs.',
      },
    ],
  },
];
let no = 0;
/** The guidelines of the whole app, under their pages' own kickers - the catalogue, then the
 *  guides - numbered 01-04 across both. */
export const REFERENCE: { label: string; pages: ReferencePage[] }[] = GROUPS.map((g) => ({
  label: g.label,
  pages: g.pages.map((p) => ({ ...p, no: String(++no).padStart(2, '0') })),
}));

/** The Reference page a URL is on (`/charts#chart-range` is on Charts), if any. */
export const referencePageOf = (url: string): ReferencePage | undefined =>
  REFERENCE.flatMap((g) => g.pages).find((p) => url.split(/[?#]/)[0] === p.path);
