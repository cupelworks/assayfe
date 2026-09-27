import { signal } from '@angular/core';
import { Observable } from 'rxjs';
import { errText } from './format';

export interface ActionMessage {
  ok: boolean;
  text: string;
}

export interface ActionRunnerOptions {
  /** Whether a dialog is open right now - a failed action's error then shows inside it (`err`);
   *  otherwise it shows in the page banner (`msg`). Omit on a page with no dialogs. */
  inDialog?: () => boolean;
  /** What every successful action on the page does, before its own `then` - typically close the
   *  dialog and reload what the action changed. */
  done?: () => void;
}

export interface RunOptions<T> {
  /** Banner text on success. Omit when the success speaks for itself (e.g. it navigates away). */
  ok?: (r: T) => string;
  /** This action's own follow-up after `done` (navigate, reload a specific list, …). */
  then?: (r: T) => void;
  /** Custom error handling: return the text to show (routed like any error), or null when the
   *  handler already showed it itself - e.g. per-field 422 messages. Default: `errText(e)`. */
  onError?: (e: unknown) => string | null;
}

/**
 * The busy flag, dialog error and page banner behind every button that calls the API - the
 * routine each page used to write out by hand (set busy, clear the old error, call, clear busy
 * on both paths, show the result). One instance per page (or per independent section), in a
 * field initializer; templates read `act.busy()` to disable buttons, `act.err()` inside the open
 * dialog, and `act.msg()` for the page banner.
 */
export class ActionRunner {
  busy = signal(false);
  /** The last failure while a dialog was open - shown inside that dialog. */
  err = signal<string | null>(null);
  /** The page banner: a success message, or a failure that happened with no dialog open. */
  msg = signal<ActionMessage | null>(null);

  constructor(private opts: ActionRunnerOptions = {}) {}

  run<T>(req: Observable<T>, o: RunOptions<T> = {}) {
    this.busy.set(true);
    this.err.set(null);
    this.msg.set(null);
    req.subscribe({
      next: (r) => {
        this.busy.set(false);
        this.opts.done?.();
        if (o.ok) this.msg.set({ ok: true, text: o.ok(r) });
        o.then?.(r);
      },
      error: (e) => {
        this.busy.set(false);
        const text = o.onError ? o.onError(e) : errText(e);
        if (text == null) return;
        if (this.opts.inDialog?.()) this.err.set(text);
        else this.msg.set({ ok: false, text });
      },
    });
  }
}
