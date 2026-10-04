/** A link of the header: where it goes, and its words; `exact` when only that path is it (the
 *  Overview's `/`). */
export interface NavLink {
  path: string;
  label: string;
  exact?: boolean;
}
/** A page of one of the bar's menus: numbered across its menu, with the first words of its own
 *  lede. */
export interface MenuPage extends NavLink {
  no: string;
  blurb: string;
}
/** A menu's pages under a kicker ("Catalog") - or under none, when the menu has one run of them. */
export interface MenuGroup {
  label: string;
  pages: MenuPage[];
}
/**
 * A menu of the bar, beside the work: its name, what it holds (its panel's rail, under the name),
 * its pages, and how its panel lays them out - `across` columns (a group each, or a page each when
 * there's one group with no kicker) over `cols` of the page's grid, from column 4.
 */
export interface NavMenu {
  label: string;
  what: string;
  groups: MenuGroup[];
  across: number;
  cols: number;
}

/** The work, in the bar and atop the phone's menu. */
export const WORK: NavLink[] = [
  { path: '/', label: 'Overview', exact: true },
  { path: '/datasets', label: 'Datasets' },
  { path: '/tests', label: 'Tests' },
  { path: '/test-sets', label: 'Test sets' },
  { path: '/test-plans', label: 'Test plans' },
];

/** A menu's groups, their pages numbered 01, 02… across all of them. */
function numbered(groups: { label: string; pages: Omit<MenuPage, 'no'>[] }[]): MenuGroup[] {
  let no = 0;
  return groups.map((g) => ({
    label: g.label,
    pages: g.pages.map((p) => ({ ...p, no: String(++no).padStart(2, '0') })),
  }));
}

/** What came of running the tests, so it's a click away from any page: every run, every batch,
 *  every comparison - three across. */
export const RESULTS: NavMenu = {
  label: 'Results',
  what: 'What came of running your tests: every run, every batch and its verdict, every comparison.',
  groups: numbered([
    {
      label: '',
      pages: [
        {
          path: '/runs',
          label: 'Runs',
          blurb:
            'Every run started one at a time: a test on its own, or a set or a plan, a test at a time.',
        },
        {
          path: '/statistics/batches',
          label: 'Batches',
          blurb:
            'Every run with statistics: a test, set or plan run many times over, so it gets a verdict.',
        },
        {
          path: '/statistics/comparisons',
          label: 'Comparisons',
          blurb:
            'Two batches of the same test, set or plan - one before a change, one after: better, worse, or as good?',
        },
      ],
    },
  ]),
  across: 3,
  cols: 9,
};

/** The guidelines of the whole app, under their pages' own kickers - the catalogue, then the
 *  guides - numbered 01-04 across both. */
export const REFERENCE: NavMenu = {
  label: 'Reference',
  what: 'What Assay can check and decide, how to read its charts, and how it all works.',
  groups: numbered([
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
  ]),
  across: 2,
  cols: 8,
};

/** The bar's menus, in its order: Results, then Reference. */
export const MENUS: NavMenu[] = [RESULTS, REFERENCE];

/** The page of a menu a URL is on, if any - its path alone (`/charts#chart-range` is on Charts,
 *  `/runs?status=Red` on Runs; a batch's own page on none). */
export const menuPageOf = (menu: NavMenu, url: string): MenuPage | undefined =>
  menu.groups.flatMap((g) => g.pages).find((p) => url.split(/[?#]/)[0] === p.path);
