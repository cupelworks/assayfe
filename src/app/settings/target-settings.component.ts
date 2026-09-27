import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsApiService } from '../api/settings-api.service';
import { TargetCheck, TargetSettingsRead } from '../api/models';
import { errText, fieldErrors } from '../shared/format';
import { RelTimeComponent } from '../shared/rel-time.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { APPLICATION_FIELDS, envVar } from './settings-fields';
import {
  FieldErrors,
  HeaderRow,
  ScalarDraftField,
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
  imports: [FormsModule, RelTimeComponent, ConfirmDialogComponent],
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
  errors = signal<FieldErrors>({});
  saving = signal(false);
  msg = signal<{ ok: boolean; text: string } | null>(null);
  confirmReset = signal(false);
  resetting = signal(false);
  resetError = signal<string | null>(null);

  checkInput = signal('');
  runner = new TargetCheckRunner();

  dirty = computed(() => {
    const d = this.draft();
    const s = this.saved();
    return !!d && !!s && isDirty(d, s);
  });
  /** What's shown under each field: this form's own errors first, then a check's 422s. */
  shownErrors = computed<FieldErrors>(() => ({ ...this.runner.fieldErrors(), ...this.errors() }));

  constructor() {
    this.api.target().subscribe({
      next: (s) => this.load(s),
      error: (e) => this.loadError.set(errText(e)),
    });
  }

  private load(s: TargetSettingsRead) {
    this.saved.set(s);
    this.draft.set(toDraft(s));
    this.errors.set({});
  }
  private clearError(key: string) {
    this.errors.update(({ [key]: _, ...rest }) => rest);
    this.runner.clearFieldError(key);
    this.msg.set(null);
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
    if (!changes) return;
    if (!Object.keys(changes).length) {
      this.load(this.saved()!);
      return;
    }
    this.saving.set(true);
    this.msg.set(null);
    this.api.updateTarget(changes).subscribe({
      next: (s) => {
        this.saving.set(false);
        this.load(s);
        this.msg.set({ ok: true, text: 'Saved. Applies from the next run.' });
      },
      error: (e) => {
        this.saving.set(false);
        const byField = fieldErrors(e);
        if (Object.keys(byField).length) this.errors.set(byField);
        else this.msg.set({ ok: false, text: errText(e) });
      },
    });
  }
  discard() {
    const s = this.saved();
    if (s) this.load(s);
    this.runner.fieldErrors.set({});
    this.msg.set(null);
  }
  reset() {
    this.resetting.set(true);
    this.resetError.set(null);
    this.api.resetTarget().subscribe({
      next: (s) => {
        this.resetting.set(false);
        this.confirmReset.set(false);
        this.load(s);
        this.msg.set({ ok: true, text: "Reset to the server's environment values." });
      },
      error: (e) => {
        this.resetting.set(false);
        this.resetError.set(errText(e));
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
