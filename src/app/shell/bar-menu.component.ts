import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { MenuListComponent } from './menu-list.component';
import { NavMenu, menuPageOf } from './nav';
import { dismissable } from '../shared/dismissable';

/**
 * A menu in the header's bar - Results, Reference: a button that opens a section of its own under
 * the bar - its name and what it holds in the rail (columns 1-3), its pages from column 4
 * (`<assay-menu-list>`). On one of those pages the button says which: the page's name on the bar's
 * baseline, red with the red line on the rule, and the menu's name over it in small red capitals;
 * elsewhere, just the menu's name. It closes on the next page, a click outside it - another menu's
 * button too, so one is open at a time - or Escape (focus back on the button).
 */
@Component({
  selector: 'assay-bar-menu',
  standalone: true,
  imports: [MenuListComponent],
  styleUrls: ['./bar.css'],
  template: `
    <button
      #button
      type="button"
      class="bar-link"
      [class.on]="current()"
      [class.open]="open()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="panelId()"
      (click)="open.set(!open())"
    >
      <span class="rl">
        @if (current(); as page) {
          <span class="rc">{{ menu().label }}</span
          >{{ page.label }}
        } @else {
          {{ menu().label }}
        }
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M1.5 3.5 5 7l3.5-3.5" stroke-width="1.6" /></svg
      ></span>
    </button>
    @if (open()) {
      <nav class="panel" [id]="panelId()" [attr.aria-label]="menu().label">
        <div class="rail">
          <p class="title">{{ menu().label }}</p>
          <p class="what">{{ menu().what }}</p>
        </div>
        <assay-menu-list
          [groups]="menu().groups"
          [across]="menu().across"
          [style.grid-column]="'4 / span ' + menu().cols"
          (picked)="open.set(false)"
        />
      </nav>
    }
  `,
  styles: `
    :host {
      display: flex;
    }
    .rl {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .rc {
      position: absolute;
      left: 0;
      bottom: 100%;
      margin-bottom: -2px;
      font-size: 10.5px;
      font-weight: 400;
      letter-spacing: 0.1em;
      line-height: 1.2;
      text-transform: uppercase;
      color: var(--color-accent);
    }
    svg {
      width: 10px;
      height: 10px;
      transition: transform 0.15s;
    }
    .open svg {
      transform: rotate(180deg);
    }
    /* Open: across the page under the bar, on its 12-column grid, a black rule under it. */
    .panel {
      position: absolute;
      left: 0;
      right: 0;
      top: calc(100% + 2px);
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      column-gap: 24px;
      padding: 40px 40px 48px;
      background: var(--color-bg);
      border-bottom: 2px solid var(--color-text);
      white-space: normal;
    }
    .rail {
      grid-column: 1 / 4;
    }
    .title {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.015em;
      line-height: 1.12;
    }
    .what {
      margin: 10px 0 0;
      max-width: 260px;
      font-size: 13px;
      line-height: 1.5;
      color: var(--color-neutral-600);
    }
  `,
})
export class BarMenuComponent {
  menu = input.required<NavMenu>();
  open = signal(false);
  panelId = computed(() => `${this.menu().label.toLowerCase()}-panel`);
  private button = viewChild.required<ElementRef<HTMLButtonElement>>('button');
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
