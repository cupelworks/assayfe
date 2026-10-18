// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { parseDecimal } from '../shared/number';

/** Per-field problems, keyed by the API's field name. */
export type FieldErrors = Record<string, string>;

/**
 * How one settings group's form converts between the API's values (`S`) and the form's own copy
 * (`D`, everything as the text the inputs edit). `parseDraft` catches only what can't be sent at
 * all (JSON that doesn't parse, a non-number, …); every other rule is the API's to enforce with
 * a 422, so it isn't duplicated here. One of these per group (target-draft.ts, judge-draft.ts);
 * everything else - change detection, dirty state, the form itself - is shared.
 */
export interface SettingsDraftSpec<S, D> {
  /** The editable fields, in form order - also what a 422's `loc` can point at. */
  fields: readonly string[];
  toDraft(s: S): D;
  parseDraft(d: D): { value: S | null; errors: FieldErrors };
}

/** JSON with object keys sorted - two header sets or bodies that differ only in key order are the
 *  same settings. */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );

/** Only the fields that differ from `saved` - what a save (PATCH) or a check's proposed settings
 *  carry. Objects (headers, body) compare, and are sent, whole: the API replaces them whole. */
export function changedFields<S>(fields: readonly string[], next: S, saved: S): Partial<S> {
  const a = next as Record<string, unknown>;
  const b = saved as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of fields) if (stable(a[k]) !== stable(b[k])) out[k] = a[k];
  return out as Partial<S>;
}

/** Whether the form differs from what's saved. A draft that can't be parsed differs by definition
 *  if its text does; otherwise the parsed values are compared, so re-indenting JSON alone doesn't
 *  count as a change. */
export function isDirty<S, D>(spec: SettingsDraftSpec<S, D>, d: D, saved: S): boolean {
  const { value } = spec.parseDraft(d);
  return value
    ? Object.keys(changedFields(spec.fields, value, saved)).length > 0
    : stable(d) !== stable(spec.toDraft(saved));
}

/** A number field's value, recording "must be a number" / "must be a whole number" in `errors`
 *  when it isn't one (the returned 0 is never sent then - the draft fails to parse). */
export function parseNumberField(
  errors: FieldErrors,
  key: string,
  raw: string,
  whole: boolean,
): number {
  const n = parseDecimal(raw);
  if (n == null) errors[key] = 'must be a number';
  else if (whole && !Number.isInteger(n)) errors[key] = 'must be a whole number';
  return n ?? 0;
}

/** An optional text field: blank means "not set" (null), which the API reads as its default. */
export const blankToNull = (s: string): string | null => s.trim() || null;

/** One header in a "headers" field - the form edits them as rows. */
export interface HeaderRow {
  name: string;
  value: string;
}
export const emptyHeaderRow = (): HeaderRow => ({ name: '', value: '' });
