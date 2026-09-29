import { computed, inject, signal } from '@angular/core';
import { SettingsApiService } from '../api/settings-api.service';
import { TargetCheck, TargetSettingsUpdate } from '../api/models';
import { errText, fieldErrors } from '../shared/format';
import { pollWhile } from '../shared/poll';
import { FieldErrorStore } from '../shared/field-errors';
import { TARGET_FIELDS } from './target-draft';

/** Extra wait on top of the checked settings' own timeout before giving up. */
const GRACE_MS = 30_000;
/** The fields a check's 422 can point at: the proposed settings, plus the test input. */
const CHECK_FIELDS: readonly string[] = [...TARGET_FIELDS, 'input'];

/**
 * One "test connection" at a time against the application under test: starts a check
 * (POST /settings/target/checks → 202, "pending"), then polls it every second (the shared
 * shared `pollWhile`, the same helper the run pages use, here at 1 s) until it's "completed" - or gives up once
 * the checked timeout plus 30 s has passed. Construct it in a field initializer (injection
 * context: `inject` and `pollWhile`'s effect/DestroyRef need one); polling stops by itself when
 * the page goes away.
 *
 * Robustness: a poll response for a check that's no longer current is ignored (a slow request for
 * an old check can't overwrite a new one), and a failed poll doesn't end the check - it keeps
 * polling until the deadline, since one network blip says nothing about the check itself, while
 * `pollError` shows the latest failure right away rather than hiding it behind "Waiting…". Only
 * a 404 (the check is gone) stops it early.
 */
export class TargetCheckRunner {
  private api = inject(SettingsApiService);
  check = signal<TargetCheck | null>(null);
  starting = signal(false);
  /** No result within the checked timeout + 30 s. */
  gaveUp = signal(false);
  /** The check can't go on: starting it failed, or it no longer exists. */
  error = signal<string | null>(null);
  /** 422 problems from starting a check, keyed by field (`input`, or a settings field). */
  fieldErrors = new FieldErrorStore();
  /** The latest poll failure while still polling - cleared by the next successful poll. */
  pollError = signal<string | null>(null);
  inFlight = computed(() => {
    const c = this.check();
    return !!c && c.status !== 'completed' && !this.gaveUp() && !this.error();
  });
  busy = computed(() => this.starting() || this.inFlight());
  /** Why it gave up, in the terms that point at the right thing to fix: a check a worker picked up
   *  ("running") timed out on the application under test; one nobody picked up means no worker. */
  gaveUpMessage = computed(() => {
    if (!this.gaveUp()) return null;
    const pollError = this.pollError();
    if (pollError) return `Couldn't get the result: ${pollError}`;
    return this.check()?.status === 'running'
      ? "The application under test didn't answer in time."
      : 'No worker answered - is the worker running?';
  });
  private deadline = 0;
  /** The check id whose poll request is in flight, so ticks don't stack requests. */
  private pollingFor: string | null = null;

  constructor() {
    pollWhile(
      () => this.inFlight(),
      () => this.tick(),
      1000,
    );
  }

  start(input: string, settings: TargetSettingsUpdate | null) {
    this.check.set(null);
    this.gaveUp.set(false);
    this.error.set(null);
    this.fieldErrors.reset();
    this.pollError.set(null);
    this.starting.set(true);
    this.api.startTargetCheck(input, settings).subscribe({
      next: (c) => {
        this.starting.set(false);
        this.deadline = Date.now() + c.settings.timeout_seconds * 1000 + GRACE_MS;
        this.check.set(c);
      },
      error: (e) => {
        this.starting.set(false);
        const { byField, other } = fieldErrors(e, CHECK_FIELDS);
        this.fieldErrors.set(byField);
        this.error.set(other);
      },
    });
  }

  private tick() {
    const c = this.check();
    if (!c) return;
    if (Date.now() > this.deadline) {
      this.gaveUp.set(true);
      return;
    }
    if (this.pollingFor === c.id) return;
    const id = c.id;
    this.pollingFor = id;
    const settle = () => {
      if (this.pollingFor === id) this.pollingFor = null;
      return this.check()?.id === id;
    };
    this.api.targetCheck(id).subscribe({
      next: (next) => {
        if (!settle()) return;
        this.pollError.set(null);
        this.check.set(next);
      },
      error: (e) => {
        if (!settle()) return;
        if (e?.status === 404) this.error.set(errText(e));
        else this.pollError.set(errText(e));
      },
    });
  }
}
