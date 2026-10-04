import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BarMenuComponent } from './bar-menu.component';
import { ThemeSwitchComponent } from './theme-switch.component';
import { AppMenuComponent } from './app-menu.component';
import { AppFooterComponent } from './app-footer.component';
import { MENUS, WORK } from './nav';

/**
 * The app's frame: the header's bar on the pages' 12-column grid - the brand over the sections'
 * rail (1-3), the work from column 4 (where a section's body starts), then the menus, Results and
 * Reference (`<assay-bar-menu>`); Settings and the theme, in small capitals, at the right - every
 * word on one baseline, the page you're on red with a red line on the bar's rule. Below 1220 px,
 * where the menus no longer fit beside Settings, the bar keeps the brand and Menu. Then the page, and the footer (`<assay-app-footer>`), the bar
 * mirrored.
 */
@Component({
  selector: 'assay-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    BarMenuComponent,
    ThemeSwitchComponent,
    AppMenuComponent,
    AppFooterComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrls: ['./bar.css', './shell.component.css'],
})
export class ShellComponent {
  work = WORK;
  menus = MENUS;
}
