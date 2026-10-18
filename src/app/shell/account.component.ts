import { Component, input } from '@angular/core';
import { SIGN_OUT_URL, SignedIn } from './session.service';
import { ThemeSwitchComponent } from './theme-switch.component';

/**
 * The one signed in: You - their whole name and the username
 * their organization gave them; the Theme (`<assay-theme-switch>`), kept on this browser; and
 * Leave - Sign out, in red, through the platform's logout. In the bar's panel, from column 4, a
 * block each under its red kicker on a rule, as a menu's pages are; in the phone's sheet (`stack`)
 * one under the other, under the sheet's own "Signed in" - the kickers go, and the theme stays at
 * the sheet's foot (`theme` false).
 */
@Component({
  selector: 'assay-account',
  standalone: true,
  imports: [ThemeSwitchComponent],
  host: { '[class.stack]': 'stack()' },
  template: `
    <div class="blk you">
      <span class="cap">You</span>
      <span class="name">{{ user().name }}</span>
      <span class="username">{{ user().username }}</span>
    </div>
    @if (theme()) {
      <div class="blk theme">
        <span class="cap">Theme</span>
        <assay-theme-switch />
        <span class="hint">Kept on this browser.</span>
      </div>
    }
    <div class="blk out">
      <span class="cap">Leave</span>
      <a class="btn btn-primary btn-tall" [href]="signOut">Sign out</a>
      <span class="hint">Out of Assay on this browser; signing in again takes you back.</span>
    </div>
  `,
  styles: `
    :host {
      grid-column: 4 / -1;
      display: grid;
      grid-template-columns: repeat(9, minmax(0, 1fr));
      column-gap: 24px;
      align-items: start;
    }
    .blk {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      padding: 12px 0 16px;
      border-top: 1px solid var(--color-divider);
    }
    .you {
      grid-column: 1 / 5;
    }
    .theme {
      grid-column: 5 / 8;
    }
    .out {
      grid-column: 8 / -1;
    }
    .cap {
      margin-bottom: 6px;
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--color-accent);
    }
    .name {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.015em;
      line-height: 1.2;
    }
    .username {
      font-size: 13px;
      color: var(--color-neutral-600);
      overflow-wrap: anywhere;
    }
    .hint {
      font-size: 12px;
      line-height: 1.45;
      color: var(--color-neutral-600);
    }
    /* In the phone's sheet: one block - the name, the username, Sign out under them. */
    :host(.stack) {
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }
    :host(.stack) .cap,
    :host(.stack) .out .hint {
      display: none;
    }
    :host(.stack) .name {
      font-size: 17px;
    }
    :host(.stack) .out {
      padding-top: 6px;
      border-top: 0;
    }
  `,
})
export class AccountComponent {
  user = input.required<SignedIn>();
  /** One under the other: the phone's sheet. */
  stack = input(false);
  /** With the theme to choose - the bar's panel, where the theme moved from the bar. */
  theme = input(true);
  signOut = SIGN_OUT_URL;
}
