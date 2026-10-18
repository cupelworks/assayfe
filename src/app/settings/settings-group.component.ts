// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsApiService } from '../api/settings-api.service';
import { SettingsSource } from '../api/models';
import { errText, fieldErrors, listed, rel } from '../shared/format';
import { StatusMarkComponent } from '../shared/status-mark.component';
import { GuideSectionComponent } from '../shared/guide/guide-section.component';
import { GuideSection } from '../shared/guide/guide-sections';
import { BannerComponent } from '../shared/work/banner.component';
import { ConfirmDialogComponent } from '../shared/dialog/confirm-dialog.component';
import { ActionRunner } from '../shared/action-runner';
import { NumberInputDirective } from '../shared/number';
import { FieldErrorStore } from '../shared/field-errors';
import { SettingField } from './settings-fields';
import { FieldErrors, HeaderRow, changedFields, emptyHeaderRow, isDirty } from './settings-draft';
import { SettingsCheckRunner } from './settings-check';
import { SettingsContext, SettingsGroupConfig } from './settings-groups';

/** A group's saved settings as the API returns them - its fields plus source/updated_at (and, for
 *  the judge, api_key_variable). */
type Saved = SettingsSource & Record<string, unknown>;
/** The form's copy - every field as text, a "headers" field as rows. */
type Draft = Record<string, any>;

/**
 * One editable settings section of the Settings page, for any group: load
 * (GET /settings/<group>), edit, save only what changed (PATCH), reset to the environment's values
 * (DELETE), and test the connection with the unsaved changes before saving (checks). What differs
 * between groups - title, fields, how the form converts to and from the API, whether the check
 * takes an input, a note - comes from its `config` (settings-groups.ts); field presentation from
 * settings-fields.ts, change detection from settings-draft.ts, the check's polling from
 * settings-check.ts. This component only wires them to the template.
 */
@Component({
  selector: 'assay-settings-group',
  standalone: true,
  imports: [
    FormsModule,
    GuideSectionComponent,
    StatusMarkComponent,
    BannerComponent,
    ConfirmDialogComponent,
    NumberInputDirective,
  ],
  templateUrl: './settings-group.component.html',
  styleUrls: [
    '../shared/guide/head-aside.css',
    '../shared/work/work.css',
    './settings-section.css',
    './settings-group.component.css',
  ],
})
export class SettingsGroupComponent implements OnInit {
  config = input.required<SettingsGroupConfig>();
  /** Its place on the page: its number and title, its link in the head's index. */
  section = input.required<GuideSection>();
  /** What the page knows about the other groups, for this group's `warnings`. */
  context = input<SettingsContext>({ targetUrl: null });
  /** The saved settings, on every load, save and reset - the page's summary strip shows them. */
  loaded = output<Saved>();
  private api = inject(SettingsApiService);

  saved = signal<Saved | null>(null);
  draft = signal<Draft | null>(null);
  loadError = signal<string | null>(null);
  /** Problems found before sending (unparseable JSON, a nameless header) or returned as a 422. */
  errors = new FieldErrorStore();
  confirmReset = signal(false);
  /** Busy flag, the reset dialog's error and the banner by Save - see shared/action-runner.ts. A
   *  failed reset shows inside its confirm dialog; a failed save shows next to Save (and per field). */
  act = new ActionRunner({ inDialog: () => this.confirmReset() });

  checkInput = signal('');
  runner = new SettingsCheckRunner<{ timeout_seconds: number }>(() => ({
    group: this.config().group,
    fields: this.config().draft.fields,
    subject: this.config().check.subject,
  }));

  dirty = computed(() => {
    const d = this.draft();
    const s = this.saved();
    return !!d && !!s && isDirty(this.config().draft, d, s);
  });
  /** "2 unsaved changes" next to Save - the fields that would be sent. A draft that can't be
   *  parsed yet (half-typed JSON) can't be counted, so it just says there are changes. */
  unsavedLabel = computed(() => {
    const d = this.draft();
    const s = this.saved();
    if (!d || !s || !this.dirty()) return null;
    const spec = this.config().draft;
    const { value } = spec.parseDraft(d);
    const n = value ? Object.keys(changedFields(spec.fields, value, s)).length : 0;
    return n === 1 ? '1 unsaved change' : n ? `${n} unsaved changes` : 'Unsaved changes';
  });
  /** Under its title: where its values come from now - "Saved in Assay · 9 h ago". */
  sourceLine = computed(() => {
    const s = this.saved();
    if (!s) return null;
    return s.source === 'database'
      ? `Saved in Assay · ${rel(s.updated_at)}`
      : "From the server's environment";
  });
  /** The fields that differ from what's saved - "Changed" beside each; none while the draft can't
   *  be read yet (half-typed JSON). */
  changed = computed<Record<string, boolean>>(() => {
    const d = this.draft();
    const s = this.saved();
    if (!d || !s || !this.dirty()) return {};
    const spec = this.config().draft;
    const { value } = spec.parseDraft(d);
    if (!value) return {};
    return Object.fromEntries(
      Object.keys(changedFields(spec.fields, value, s)).map((k) => [k, true]),
    );
  });
  /** By Save, which they are: "Timeout and Retries". */
  changedLabels = computed(() =>
    listed(
      this.config()
        .fields.filter((f) => this.changed()[f.key])
        .map((f) => f.label),
    ),
  );
  note = computed(() => {
    const s = this.saved();
    const note = this.config().note;
    return s && note ? note(s) : null;
  });
  /** The reset dialog says what else goes, when there's something unsaved to lose. */
  resetBody = computed(
    () =>
      "Removes the settings saved in Assay. Future runs use the values from the server's " +
      'environment again. Past runs are not affected.' +
      (this.dirty() ? ' Your unsaved changes on this form will be lost too.' : ''),
  );
  /** The group's own warnings for what's typed now (the judge's URL being the application's). */
  warnings = computed<Record<string, string>>(() => {
    const d = this.draft();
    const w = this.config().warnings;
    return d && w ? w(d, this.context()) : {};
  });
  /** What's shown under each field: this form's own errors first, then a check's 422s. */
  shownErrors = computed<FieldErrors>(() => ({
    ...this.runner.fieldErrors.all(),
    ...this.errors.all(),
  }));

  ngOnInit() {
    this.api.read<Saved>(this.config().group).subscribe({
      next: (s) => this.load(s),
      error: (e) => this.loadError.set(errText(e)),
    });
  }

  private load(s: Saved) {
    this.saved.set(s);
    this.loaded.emit(s);
    this.draft.set(this.config().draft.toDraft(s));
    this.errors.reset();
    // The settings fields under any check error were just replaced, so those messages no longer
    // apply - but the test input wasn't touched, so its message stays.
    this.runner.fieldErrors.clearKeys(this.config().draft.fields);
  }
  private clearError(key: string) {
    this.errors.clear(key);
    this.runner.fieldErrors.clear(key);
    this.act.msg.set(null);
  }

  value(key: string): string {
    return this.draft()?.[key] ?? '';
  }
  set(key: string, v: unknown) {
    this.draft.update((d) => d && { ...d, [key]: v == null ? '' : String(v) });
    this.clearError(key);
  }
  rows(key: string): HeaderRow[] {
    return this.draft()?.[key] ?? [];
  }
  private setRows(key: string, rows: HeaderRow[]) {
    this.draft.update((d) => d && { ...d, [key]: rows });
    this.clearError(key);
  }
  setHeader(key: string, i: number, part: keyof HeaderRow, v: string) {
    this.setRows(
      key,
      this.rows(key).map((h, j) => (j === i ? { ...h, [part]: v ?? '' } : h)),
    );
  }
  addHeader(key: string) {
    this.draft.update((d) => d && { ...d, [key]: [...this.rows(key), emptyHeaderRow()] });
  }
  removeHeader(key: string, i: number) {
    this.setRows(
      key,
      this.rows(key).filter((_, j) => j !== i),
    );
  }
  /** A field's example value - fixed, or picked by another field's current value (the judge's
   *  examples follow its provider). */
  placeholderOf(f: SettingField): string {
    const p = f.placeholder;
    if (!p) return '';
    return typeof p === 'string' ? p : (p.values[this.value(p.from)] ?? '');
  }
  envVar = (f: SettingField) => this.config().envPrefix + f.key.toUpperCase();

  /** The draft's changes against what's saved, or null (with the problems shown) if the draft
   *  can't be sent as it is. */
  private pendingChanges() {
    const d = this.draft();
    const s = this.saved();
    if (!d || !s) return null;
    const spec = this.config().draft;
    const { value, errors } = spec.parseDraft(d);
    if (!value) {
      this.errors.set(errors);
      return null;
    }
    return changedFields(spec.fields, value, s);
  }

  save() {
    const changes = this.pendingChanges();
    if (!changes || !Object.keys(changes).length) return;
    const { group, draft } = this.config();
    this.act.run(this.api.update<Saved>(group, changes), {
      ok: () => 'Saved. Applies from the next run.',
      then: (s) => this.load(s),
      onError: (e) => {
        const { byField, other } = fieldErrors(e, draft.fields);
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
    this.act.run(this.api.reset<Saved>(this.config().group), {
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
    const input = this.config().check.needsInput ? this.checkInput().trim() : null;
    this.runner.start(input, Object.keys(changes).length ? changes : null);
  }
  canCheck = computed(
    () => !this.runner.busy() && (!this.config().check.needsInput || !!this.checkInput().trim()),
  );
  /** "2.5 s" - how long the call took. */
  secs = (latency: number) => `${(latency / 1000).toFixed(1)} s`;
  /** API messages read "must be …" - shown under their field, so capitalise the first letter. */
  cap = (m: string) => m.charAt(0).toUpperCase() + m.slice(1);
  controlId = (key: string) => `setting-${this.config().group}-${key}`;
}
