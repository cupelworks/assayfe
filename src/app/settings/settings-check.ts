import { computed, inject, signal } from '@angular/core';
import { SettingsApiService, SettingsGroup } from '../api/settings-api.service';
import { SettingsCheck } from '../api/models';
import { errText, fieldErrors } from '../shared/format';
import { pollWhile } from '../shared/poll';
import { FieldErrorStore } from '../shared/field-errors';

/** Extra wait on top of the checked settings' own timeout before giving up. */
const GRACE_MS = 30_000;

/** What a check runner needs to know about its group - read on every use, so the component can
 *  hand it a getter over its `config` input (inputs aren't set yet when field initializers run). */
export interface CheckTarget {
  group: SettingsGroup;
  /** The group's fields - where a 422 on a check's proposed settings can point. */
  fields: readonly string[];
  /** What the check calls, for the status lines: "the application under test", "the judge". */
  subject: string;
}

/**
 * One "test connection" at a time for a settings group: starts a check
 * (POST /settings/<group>/checks → 202, "pending"), then polls it every second (the shared
 * `pollWhile`, the helper the run pages use, here at 1 s) until it's "completed" - or gives up
 * once the checked timeout plus 30 s has passed. Construct it in a field initializer (injection
 * context: `inject` and `pollWhile`'s effect/DestroyRef need one); polling stops by itself when
 * the page goes away.
 *
 * Robustness: a poll response for a check that's no longer current is ignored (a slow request for
 * an old check can't overwrite a new one), and a failed poll doesn't end the check - it keeps
 * polling until the deadline, since one network blip says nothing about the check itself, while
 * `pollError` shows the latest failure right away rather than hiding it behind "Waiting…". Only
 * a 404 (the check is gone) stops it early.
 */
export class SettingsCheckRunner<S extends { timeout_seconds: number }> {
  private api = inject(SettingsApiService);
  check = signal<SettingsCheck<S> | null>(null);
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
   *  ("running") timed out on what it calls; one nobody picked up means no worker. */
  gaveUpMessage = computed(() => {
    if (!this.gaveUp()) return null;
    const pollError = this.pollError();
    if (pollError) return `Couldn't get the result: ${pollError}`;
    if (this.check()?.status !== 'running') return 'No worker answered - is the worker running?';
    const subject = this.target().subject;
    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} didn't answer in time.`;
  });
  private deadline = 0;
  /** The check id whose poll request is in flight, so ticks don't stack requests. */
  private pollingFor: string | null = null;

  constructor(private target: () => CheckTarget) {
    pollWhile(
      () => this.inFlight(),
      () => this.tick(),
      1000,
    );
  }

  /** `input`: the test input, for a group whose check takes one (target); null otherwise. */
  start(input: string | null, settings: Partial<S> | null) {
    const { group, fields } = this.target();
    this.check.set(null);
    this.gaveUp.set(false);
    this.error.set(null);
    this.fieldErrors.reset();
    this.pollError.set(null);
    this.starting.set(true);
    const body = input == null ? { settings } : { input, settings };
    this.api.startCheck<S>(group, body).subscribe({
      next: (c) => {
        this.starting.set(false);
        this.deadline = Date.now() + c.settings.timeout_seconds * 1000 + GRACE_MS;
        this.check.set(c);
      },
      error: (e) => {
        this.starting.set(false);
        const { byField, other } = fieldErrors(e, [...fields, 'input']);
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
    this.api.check<S>(this.target().group, id).subscribe({
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
