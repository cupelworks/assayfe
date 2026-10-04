import { Component, inject } from '@angular/core';
import { ASSAY_API_BASE } from '../api/api-base.token';
import { ArrowOutComponent } from '../shared/arrow-out.component';

/**
 * The footer, as the header mirrored: its rule on top, 64 px, on the page grid, in small
 * capitals on one baseline - the copyright under the brand, the API's documentation from column
 * 4 where the work starts (a new tab, with "Run with statistics"'s arrow; its "Opens in a new
 * tab" opens above it, at the bottom of the page), the version at the right.
 */
@Component({
  selector: 'assay-app-footer',
  standalone: true,
  imports: [ArrowOutComponent],
  template: `
    <footer class="foot page-grid small-caps">
      <span class="copy">© 2026 Assay</span>
      <a
        class="api new-tab above"
        [href]="docs"
        target="_blank"
        rel="noopener"
        aria-label="API documentation, opens in a new tab"
        >API documentation <assay-arrow-out
      /></a>
      <span class="version">Version {{ version }}</span>
    </footer>
  `,
  styles: `
    :host {
      display: block;
      margin-top: auto;
    }
    .foot {
      height: 64px;
      align-items: center;
      border-top: 2px solid var(--color-divider);
    }
    .copy {
      grid-column: 1 / 4;
    }
    .api {
      grid-column: 4 / 9;
      justify-self: start;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
      color: var(--color-text);
      text-decoration: none;
    }
    .api:hover {
      color: var(--color-accent);
    }
    .api:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
    .version {
      grid-column: 9 / -1;
      justify-self: end;
      color: var(--color-neutral-600);
    }
    @media (max-width: 960px) {
      .foot {
        height: auto;
        padding-block: 12px;
      }
      .copy,
      .api,
      .version {
        grid-column: 1 / -1;
        justify-self: start;
      }
    }
  `,
})
export class AppFooterComponent {
  docs = inject(ASSAY_API_BASE).replace(/\/$/, '') + '/docs';
  /** The API version this front end is built against. */
  version = '2.1.0';
}
