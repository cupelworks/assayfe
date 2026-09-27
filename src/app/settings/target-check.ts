import { computed, inject, signal } from '@angular/core';
import { SettingsApiService } from '../api/settings-api.service';
import { TargetCheck, TargetSettingsUpdate } from '../api/models';
import { errText, fieldErrors } from '../shared/format';
import { pollWhile } from '../shared/poll';

/** Extra wait on top of the checked settings' own timeout before giving up on a worker. */
const GRACE_MS = 30_000;

/**
 * One "test connection" at a time against the application under test: starts a check
 * (POST /settings/target/checks → 202, "pending"), then polls it every second (the shared
 * `pollWhile`, same helper the run pages use at 15 s) until it's "completed" - or gives up once
 * the checked timeout plus 30 s has passed with no result, which in practice means no worker
 * picked it up. Construct it in a field initializer (injection context: `inject` and
 * `pollWhile`'s effect/DestroyRef need one); polling stops by itself when the page goes away.
 */
export class TargetCheckRunner {
  private api = inject(SettingsApiService);
  check = signal<TargetCheck | null>(null);
  starting = signal(false);
  /** No result within the checked timeout + 30 s. */
  gaveUp = signal(false);
  /** A request that failed outright (not a 422 field problem - those are in `fieldErrors`). */
  error = signal<string | null>(null);
  /** 422 problems from starting a check, keyed by field (`input`, or a settings field). */
  fieldErrors = signal<Record<string, string>>({});
  inFlight = computed(() => {
    const c = this.check();
    return !!c && c.status !== 'completed' && !this.gaveUp() && !this.error();
  });
  busy = computed(() => this.starting() || this.inFlight());
  private deadline = 0;
  private fetching = false;

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
    this.fieldErrors.set({});
    this.starting.set(true);
    this.api.startTargetCheck(input, settings).subscribe({
      next: (c) => {
        this.starting.set(false);
        this.deadline = Date.now() + c.settings.timeout_seconds * 1000 + GRACE_MS;
        this.check.set(c);
      },
      error: (e) => {
        this.starting.set(false);
        const byField = fieldErrors(e);
        if (Object.keys(byField).length) this.fieldErrors.set(byField);
        else this.error.set(errText(e));
      },
    });
  }

  /** Drops a field's 422 message once the user edits that field. */
  clearFieldError(key: string) {
    if (!(key in this.fieldErrors())) return;
    this.fieldErrors.update(({ [key]: _, ...rest }) => rest);
  }

  private tick() {
    if (Date.now() > this.deadline) {
      this.gaveUp.set(true);
      return;
    }
    const c = this.check();
    if (!c || this.fetching) return;
    this.fetching = true;
    this.api.targetCheck(c.id).subscribe({
      next: (next) => {
        this.fetching = false;
        this.check.set(next);
      },
      error: (e) => {
        this.fetching = false;
        this.error.set(errText(e));
      },
    });
  }
}
