import { Component, computed, inject, input } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { BarDropdownComponent } from './bar-dropdown.component';
import { MenuListComponent } from './menu-list.component';
import { NavMenu, menuPageOf } from './nav';

/**
 * A menu of pages in the header's bar - Results, Reference: a `<assay-bar-dropdown>` holding its
 * pages (`<assay-menu-list>`, from column 4). On one of those pages the button says which: the
 * page's name, red with the red line on the rule, and the menu's name over it in small red
 * capitals; elsewhere, just the menu's name. Following a page closes it - the page already open
 * too.
 */
@Component({
  selector: 'assay-bar-menu',
  standalone: true,
  imports: [BarDropdownComponent, MenuListComponent],
  template: `
    <assay-bar-dropdown
      #dropdown
      [label]="current()?.label ?? menu().label"
      [kicker]="current() ? menu().label : null"
      [on]="!!current()"
      [title]="menu().label"
      [what]="menu().what"
      [panelId]="panelId()"
    >
      <assay-menu-list
        [groups]="menu().groups"
        [across]="menu().across"
        [style.grid-column]="'4 / span ' + menu().cols"
        (picked)="dropdown.close()"
      />
    </assay-bar-dropdown>
  `,
  styles: `
    :host {
      display: flex;
    }
  `,
})
export class BarMenuComponent {
  menu = input.required<NavMenu>();
  panelId = computed(() => `${this.menu().label.toLowerCase()}-panel`);
  private router = inject(Router);
  private url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  /** The menu's page you're on, if any. */
  current = computed(() => menuPageOf(this.menu(), this.url()));
}
