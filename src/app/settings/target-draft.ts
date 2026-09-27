import { TargetField, TargetMethod, TargetSettings, TargetSettingsUpdate } from '../api/models';

/** Every editable field, in form order. */
export const TARGET_FIELDS: TargetField[] = [
  'url',
  'method',
  'headers',
  'body',
  'output_path',
  'timeout_seconds',
  'max_retries',
];

export interface HeaderRow {
  name: string;
  value: string;
}
/** The form's own copy of the settings: everything as the text the inputs edit, headers as rows.
 *  Converting back (`parseDraft`) is where anything that can't even be sent - JSON that doesn't
 *  parse, a header without a name - is caught; every other rule (URL scheme, ranges, JSONPath,
 *  `{{input}}` in the body) is the API's to enforce, so it isn't duplicated here. */
export interface TargetDraft {
  url: string;
  method: string;
  headers: HeaderRow[];
  body: string;
  output_path: string;
  timeout_seconds: string;
  max_retries: string;
}
export type ScalarDraftField = Exclude<keyof TargetDraft, 'headers'>;
export type FieldErrors = Partial<Record<string, string>>;

const emptyRow = (): HeaderRow => ({ name: '', value: '' });

export const toDraft = (s: TargetSettings): TargetDraft => ({
  url: s.url ?? '',
  method: s.method,
  // No headers still shows one blank row - the field's normal empty state.
  headers: Object.keys(s.headers).length
    ? Object.entries(s.headers).map(([name, value]) => ({ name, value }))
    : [emptyRow()],
  body: JSON.stringify(s.body, null, 2),
  output_path: s.output_path,
  timeout_seconds: String(s.timeout_seconds),
  max_retries: String(s.max_retries),
});

export const addHeaderRow = (d: TargetDraft): TargetDraft => ({
  ...d,
  headers: [...d.headers, emptyRow()],
});
export const removeHeaderRow = (d: TargetDraft, i: number): TargetDraft => ({
  ...d,
  headers: d.headers.filter((_, j) => j !== i),
});
export const setHeaderRow = (
  d: TargetDraft,
  i: number,
  part: keyof HeaderRow,
  v: string,
): TargetDraft => ({
  ...d,
  headers: d.headers.map((h, j) => (j === i ? { ...h, [part]: v } : h)),
});

/** The draft as API values, or the problems that stop it being sent at all. */
export function parseDraft(d: TargetDraft): { value: TargetSettings | null; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const rows = d.headers
    .map((h) => ({ name: h.name.trim(), value: h.value }))
    .filter((h) => h.name || h.value.trim());
  const seen = new Set<string>();
  for (const h of rows) {
    if (!h.name) errors['headers'] = 'every header needs a name';
    else if (seen.has(h.name.toLowerCase())) errors['headers'] = `'${h.name}' appears twice`;
    seen.add(h.name.toLowerCase());
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(d.body);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
      errors['body'] = 'must be a JSON object, like {"input": "{{input}}"}';
    else body = parsed;
  } catch {
    errors['body'] = 'is not valid JSON';
  }

  const num = (key: ScalarDraftField, whole: boolean): number => {
    const raw = d[key].trim();
    const n = Number(raw);
    if (!raw || !Number.isFinite(n)) errors[key] = 'must be a number';
    else if (whole && !Number.isInteger(n)) errors[key] = 'must be a whole number';
    return n;
  };
  const timeout_seconds = num('timeout_seconds', false);
  const max_retries = num('max_retries', true);

  if (Object.keys(errors).length) return { value: null, errors };
  return {
    value: {
      url: d.url.trim() || null,
      method: d.method as TargetMethod,
      headers: Object.fromEntries(rows.map((h) => [h.name, h.value])),
      body,
      output_path: d.output_path.trim(),
      timeout_seconds,
      max_retries,
    },
    errors,
  };
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
 *  carry. `headers` and `body` compare, and are sent, whole: the API replaces them whole. */
export function changedFields(next: TargetSettings, saved: TargetSettings): TargetSettingsUpdate {
  const out: Record<string, unknown> = {};
  for (const k of TARGET_FIELDS) if (stable(next[k]) !== stable(saved[k])) out[k] = next[k];
  return out as TargetSettingsUpdate;
}

/** Whether the form differs from what's saved. A draft that can't be parsed differs by definition
 *  if its text does; otherwise the parsed values are compared, so re-indenting the body JSON
 *  alone doesn't count as a change. */
export function isDirty(d: TargetDraft, saved: TargetSettings): boolean {
  const { value } = parseDraft(d);
  return value
    ? Object.keys(changedFields(value, saved)).length > 0
    : stable(d) !== stable(toDraft(saved));
}
