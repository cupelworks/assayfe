// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { dismissable } from '../shared/dismissable';

/**
 * What opens from the header's bar - Results, Reference, the one signed in: a button with a
 * chevron that opens a section of its own under the bar, on the page's 12 columns - its title and
 * what it holds in the rail (columns 1-3), then what's given (`<ng-content>`, placed from column 4
 * by what it is). The button's words are `label`; `kicker` puts small red capitals over them and
 * `on` the red line on the bar's rule - a menu on one of its pages ("RESULTS" over "Batches");
 * `caps` sets it in the small capitals of the bar's right side. It closes on the next page, a click
 * outside it - another's button too, so one is open at a time - Escape (focus back on the button),
 * or `close()`.
 */
@Component({
  selector: 'assay-bar-dropdown',
  standalone: true,
  styleUrls: ['./bar.css'],
  template: `
    <button
      #button
      type="button"
      class="bar-link"
      [class.small-caps]="caps()"
      [class.on]="on()"
      [class.open]="open()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="panelId()"
      [attr.aria-label]="ariaLabel()"
      (click)="open.set(!open())"
    >
      <span class="rl">
        @if (kicker(); as k) {
          <span class="rc">{{ k }}</span>
        }
        {{ label() }}
        <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M1.5 3.5 5 7l3.5-3.5" stroke-width="1.6" /></svg
      ></span>
    </button>
    @if (open()) {
      <div
        class="panel"
        [id]="panelId()"
        [attr.role]="nav() ? 'navigation' : 'region'"
        [attr.aria-label]="title()"
      >
        <div class="rail">
          <p class="title">{{ title() }}</p>
          <p class="what">{{ what() }}</p>
        </div>
        <ng-content />
      </div>
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
export class BarDropdownComponent {
  label = input.required<string>();
  kicker = input<string | null>(null);
  on = input(false);
  caps = input(false);
  /** What a screen reader hears for the button, when its words aren't enough. */
  ariaLabel = input<string | null>(null);
  title = input.required<string>();
  what = input('');
  panelId = input.required<string>();
  /** Its section lists pages to go to (a navigation landmark), or holds something else. */
  nav = input(true);
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

  close() {
    this.open.set(false);
  }
}
