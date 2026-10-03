import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ASSAY_API_BASE } from '../api/api-base.token';
import { ReferenceMenuComponent } from './reference-menu.component';
import { ThemeSwitchComponent } from './theme-switch.component';
import { AppMenuComponent } from './app-menu.component';
import { WORK } from './nav';

/**
 * The app's frame: the header's bar on the pages' 12-column grid - the brand over the sections'
 * rail (1-3), the work from column 4 (where a section's body starts), then Reference; Settings
 * and the theme, in small capitals, at the right - every word on one baseline, the page you're on
 * red with a red line on the bar's rule. Below 960 px the bar keeps the brand and Menu. Then the
 * page, and the footer.
 */
@Component({
  selector: 'assay-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ReferenceMenuComponent,
    ThemeSwitchComponent,
    AppMenuComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./bar.css', './shell.component.css'],
})
export class ShellComponent {
  work = WORK;
  apiBase = inject(ASSAY_API_BASE).replace(/\/$/, '');
}
