import { CatalogCellComponent } from './catalog-cell.component';
import { CatalogDetailsComponent } from './catalog-details.component';
import { CatalogFilterComponent } from './catalog-filter.component';
import { CatalogIndexComponent } from './catalog-index.component';
import { CatalogKeyComponent } from './catalog-key.component';
import { CatalogRowComponent } from './catalog-row.component';
import { CatalogTableComponent } from './catalog-table.component';
import { CatalogTagComponent } from './catalog-tag.component';

export type { CatalogColumn } from './catalog-table.component';
export type {
  CatalogIndexGroup,
  CatalogIndexItem,
  CatalogIndexLink,
} from './catalog-index.component';
export type { CatalogKeyItem } from './catalog-key.component';
export type { CatalogTag } from './catalog-tag.component';

/** A catalogue page's pieces (Test types, Statistical tests), for its `imports`: its key, its
 *  index, its filter, its table and rows, cells and details - laid out like the Guide
 *  (`shared/guide`). */
export const CATALOG = [
  CatalogKeyComponent,
  CatalogIndexComponent,
  CatalogFilterComponent,
  CatalogTableComponent,
  CatalogRowComponent,
  CatalogCellComponent,
  CatalogDetailsComponent,
  CatalogTagComponent,
] as const;
