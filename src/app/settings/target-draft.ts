import { TargetMethod, TargetSettings } from '../api/models';
import {
  FieldErrors,
  HeaderRow,
  SettingsDraftSpec,
  blankToNull,
  emptyHeaderRow,
  parseNumberField,
} from './settings-draft';

/** Every editable field of the application-under-test group, in form order. */
export const TARGET_FIELDS = [
  'url',
  'method',
  'headers',
  'body',
  'output_path',
  'timeout_seconds',
  'max_retries',
] as const;

/** The form's copy of the target settings: everything as text, headers as rows. */
export interface TargetDraft {
  url: string;
  method: string;
  headers: HeaderRow[];
  body: string;
  output_path: string;
  timeout_seconds: string;
  max_retries: string;
}

/** How the application-under-test form converts to and from the API - see SettingsDraftSpec.
 *  Caught here: a header without a name or named twice, body JSON that doesn't parse or isn't an
 *  object, a non-number. URL scheme, ranges, JSONPath and `{{input}}` in the body are the API's. */
export const TARGET_DRAFT: SettingsDraftSpec<TargetSettings, TargetDraft> = {
  fields: TARGET_FIELDS,
  toDraft: (s) => ({
    url: s.url ?? '',
    method: s.method,
    // No headers still shows one blank row - the field's normal empty state.
    headers: Object.keys(s.headers).length
      ? Object.entries(s.headers).map(([name, value]) => ({ name, value }))
      : [emptyHeaderRow()],
    body: JSON.stringify(s.body, null, 2),
    output_path: s.output_path,
    timeout_seconds: String(s.timeout_seconds),
    max_retries: String(s.max_retries),
  }),
  parseDraft: (d) => {
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

    const timeout_seconds = parseNumberField(errors, 'timeout_seconds', d.timeout_seconds, false);
    const max_retries = parseNumberField(errors, 'max_retries', d.max_retries, true);

    if (Object.keys(errors).length) return { value: null, errors };
    return {
      value: {
        url: blankToNull(d.url),
        method: d.method as TargetMethod,
        headers: Object.fromEntries(rows.map((h) => [h.name, h.value])),
        body,
        output_path: d.output_path.trim(),
        timeout_seconds,
        max_retries,
      },
      errors,
    };
  },
};
