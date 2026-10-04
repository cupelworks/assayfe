import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuListComponent } from './menu-list.component';
import { ThemeSwitchComponent } from './theme-switch.component';
import { MENUS, WORK } from './nav';
import { dismissable } from '../shared/dismissable';

/**
 * The header below 1220 px, where the bar keeps only the brand: Menu opens the whole bar as one
 * sheet under it - the work in large type, then each menu's pages under its name, Results then
 * Reference (`<assay-menu-list>`, one column), then Settings and the theme. It closes on the next
 * page, a click outside it, or Escape (focus back on Menu).
 */
@Component({
  selector: 'assay-app-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MenuListComponent, ThemeSwitchComponent],
  template: `
    <button
      #button
      type="button"
      class="menu"
      [attr.aria-expanded]="open()"
      aria-controls="app-menu"
      (click)="open.set(!open())"
    >
      {{ open() ? 'Close' : 'Menu' }}
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
        @if (open()) {
          <path d="M3 3l10 10M13 3 3 13" stroke-width="2" />
        } @else {
          <path d="M1 5h14M1 11h14" stroke-width="2" />
        }
      </svg>
    </button>
    @if (open()) {
      <nav class="sheet" id="app-menu" aria-label="Main">
        <div class="work">
          @for (l of work; track l.path) {
            <a
              [routerLink]="l.path"
              routerLinkActive="on"
              [routerLinkActiveOptions]="{ exact: !!l.exact }"
              ariaCurrentWhenActive="page"
              (click)="open.set(false)"
              >{{ l.label }}</a
            >
          }
        </div>
        @for (m of menus; track m.label) {
          <p class="title">{{ m.label }}</p>
          <assay-menu-list [groups]="m.groups" [stack]="true" (picked)="open.set(false)" />
        }
        <div class="foot">
          <a
            class="settings small-caps"
            routerLink="/settings"
            routerLinkActive="on"
            ariaCurrentWhenActive="page"
            (click)="open.set(false)"
            >Settings</a
          >
          <assay-theme-switch />
        </div>
      </nav>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
    }
    .menu {
      all: unset;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 44px;
      padding-left: 8px;
      font-size: 14px;
      font-weight: 700;
      color: var(--color-text);
      cursor: pointer;
    }
    .menu svg {
      width: 16px;
      height: 16px;
    }
    .sheet {
      position: fixed;
      top: 64px;
      left: 0;
      right: 0;
      bottom: 0;
      overflow-y: auto;
      padding: 4px 16px 32px;
      background: var(--color-bg);
    }
    /* Wider than a phone (961-1219 px), on the page's margins, as the bar over it. */
    @media (min-width: 961px) {
      .sheet {
        padding-inline: 40px;
      }
    }
    .work {
      display: flex;
      flex-direction: column;
    }
    .work a {
      display: flex;
      align-items: center;
      min-height: 52px;
      border-bottom: 1px solid color-mix(in srgb, var(--color-text) 25%, transparent);
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.015em;
      color: var(--color-text);
      text-decoration: none;
    }
    .work a.on {
      color: var(--color-accent);
    }
    .title {
      margin: 32px 0 16px;
      padding-top: 12px;
      border-top: 2px solid var(--color-text);
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.015em;
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 28px;
      border-top: 2px solid var(--color-text);
    }
    .settings {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding-top: 6px;
      color: var(--color-text);
      text-decoration: none;
    }
    .settings.on {
      color: var(--color-accent);
    }
    .menu:focus-visible,
    .work a:focus-visible,
    .settings:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
  `,
})
export class AppMenuComponent {
  work = WORK;
  menus = MENUS;
  open = signal(false);
  private button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

  constructor() {
    dismissable(
      () => this.open(),
      (why) => {
        this.open.set(false);
        if (why === 'escape') this.button().nativeElement.focus();
      },
    );
  }
}
