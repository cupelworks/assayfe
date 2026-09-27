import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsApiService } from '../api/settings-api.service';
import { TargetCheck, TargetSettingsRead } from '../api/models';
import { errText, fieldErrors } from '../shared/format';
import { RelTimeComponent } from '../shared/rel-time.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { ActionRunner } from '../shared/action-runner';
import { NumberInputDirective } from '../shared/number';
import { FieldErrorStore } from '../shared/field-errors';
import { APPLICATION_FIELDS, envVar } from './settings-fields';
import {
  FieldErrors,
  HeaderRow,
  ScalarDraftField,
  TARGET_FIELDS,
  TargetDraft,
  addHeaderRow,
  changedFields,
  isDirty,
  parseDraft,
  removeHeaderRow,
  setHeaderRow,
  toDraft,
} from './target-draft';
import { TargetCheckRunner } from './target-check';

/** The Settings page's "Application under test" section: load (GET /settings/target), edit, save
 *  only what changed (PATCH), reset to the environment's values (DELETE), and test the connection
 *  with the unsaved changes before saving (checks). Field presentation comes from
 *  `settings-fields.ts`, draft conversion and change detection from `target-draft.ts`, the
 *  check's polling from `target-check.ts` - this component only wires them to the template. */
@Component({
  selector: 'assay-target-settings',
  standalone: true,
  imports: [FormsModule, RelTimeComponent, ConfirmDialogComponent, NumberInputDirective],
  templateUrl: './target-settings.component.html',
  styleUrls: ['../shared/page.css', './settings-section.css', './target-settings.component.css'],
})
export class TargetSettingsComponent {
  private api = inject(SettingsApiService);
  fields = APPLICATION_FIELDS;
  envVar = envVar;

  saved = signal<TargetSettingsRead | null>(null);
  draft = signal<TargetDraft | null>(null);
  loadError = signal<string | null>(null);
  /** Problems found before sending (unparseable JSON, a nameless header) or returned as a 422. */
  errors = new FieldErrorStore();
  confirmReset = signal(false);
  /** Busy flag, the reset dialog's error and the banner by Save - see shared/action-runner.ts. A
   *  failed reset shows inside its confirm dialog; a failed save shows next to Save (and per field). */
  act = new ActionRunner({ inDialog: () => this.confirmReset() });

  checkInput = signal('');
  runner = new TargetCheckRunner();

  dirty = computed(() => {
    const d = this.draft();
    const s = this.saved();
    return !!d && !!s && isDirty(d, s);
  });
  /** The reset dialog says what else goes, when there's something unsaved to lose. */
  resetBody = computed(
    () =>
      "Removes the settings saved in Assay. Future runs use the values from the server's " +
      'environment again. Past runs are not affected.' +
      (this.dirty() ? ' Your unsaved changes on this form will be lost too.' : ''),
  );
  /** What's shown under each field: this form's own errors first, then a check's 422s. */
  shownErrors = computed<FieldErrors>(() => ({
    ...this.runner.fieldErrors.all(),
    ...this.errors.all(),
  }));

  constructor() {
    this.api.target().subscribe({
      next: (s) => this.load(s),
      error: (e) => this.loadError.set(errText(e)),
    });
  }

  private load(s: TargetSettingsRead) {
    this.saved.set(s);
    this.draft.set(toDraft(s));
    this.errors.reset();
    // The settings fields under any check error were just replaced, so those messages no longer
    // apply - but the test input wasn't touched, so its message stays.
    this.runner.fieldErrors.clearKeys(TARGET_FIELDS);
  }
  private clearError(key: string) {
    this.errors.clear(key);
    this.runner.fieldErrors.clear(key);
    this.act.msg.set(null);
  }

  value(key: ScalarDraftField): string {
    return this.draft()?.[key] ?? '';
  }
  set(key: ScalarDraftField, v: unknown) {
    this.draft.update((d) => d && { ...d, [key]: v == null ? '' : String(v) });
    this.clearError(key);
  }
  setHeader(i: number, part: keyof HeaderRow, v: string) {
    this.draft.update((d) => d && setHeaderRow(d, i, part, v ?? ''));
    this.clearError('headers');
  }
  addHeader() {
    this.draft.update((d) => d && addHeaderRow(d));
  }
  removeHeader(i: number) {
    this.draft.update((d) => d && removeHeaderRow(d, i));
    this.clearError('headers');
  }

  /** The draft's changes against what's saved, or null (with the problems shown) if the draft
   *  can't be sent as it is. */
  private pendingChanges() {
    const d = this.draft();
    const s = this.saved();
    if (!d || !s) return null;
    const { value, errors } = parseDraft(d);
    if (!value) {
      this.errors.set(errors);
      return null;
    }
    return changedFields(value, s);
  }

  save() {
    const changes = this.pendingChanges();
    if (!changes || !Object.keys(changes).length) return;
    this.act.run(this.api.updateTarget(changes), {
      ok: () => 'Saved. Applies from the next run.',
      then: (s) => this.load(s),
      onError: (e) => {
        const { byField, other } = fieldErrors(e, TARGET_FIELDS);
        this.errors.set(byField);
        return other;
      },
    });
  }
  discard() {
    const s = this.saved();
    if (s) this.load(s);
    this.act.msg.set(null);
  }
  reset() {
    this.act.run(this.api.resetTarget(), {
      ok: () => "Reset to the server's environment values.",
      then: (s) => {
        this.confirmReset.set(false);
        this.load(s);
      },
    });
  }

  /** Tests the form as it is - unsaved changes included, never saved by testing. */
  runCheck() {
    const changes = this.pendingChanges();
    if (!changes) return;
    this.runner.start(this.checkInput().trim(), Object.keys(changes).length ? changes : null);
  }
  /** "Answered · HTTP 200 · 312 ms" - only the parts the check actually has. */
  checkSummary(c: TargetCheck): string {
    return [
      c.ok ? 'Answered' : 'Failed',
      c.status_code != null ? `HTTP ${c.status_code}` : null,
      c.latency_ms != null ? `${Math.round(c.latency_ms)} ms` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  /** API messages read "must be …" - shown under their field, so capitalise the first letter. */
  cap = (m: string) => m.charAt(0).toUpperCase() + m.slice(1);
  controlId = (key: string) => `setting-${key}`;
}
