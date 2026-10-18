// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Francesco Campanile
import { JudgeProvider, JudgeSettings } from '../api/models';
import { FieldErrors, SettingsDraftSpec, blankToNull, parseNumberField } from './settings-draft';

/** Every editable field of the LLM-judge group, in form order. `api_key_variable` is read-only
 *  and never sent. */
export const JUDGE_FIELDS = [
  'provider',
  'model',
  'api_key_env',
  'timeout_seconds',
  'max_retries',
  'url',
] as const;

/** The form's copy of the judge settings: everything as text; '' is "not set" (null). */
export interface JudgeDraft {
  provider: string;
  model: string;
  url: string;
  api_key_env: string;
  timeout_seconds: string;
  max_retries: string;
}

/** How the judge form converts to and from the API - see SettingsDraftSpec. Only non-numbers are
 *  caught here; "a model is required when a provider is set", the URL scheme, the variable-name
 *  rule and the ranges come back from the API as 422s, under their fields. */
export const JUDGE_DRAFT: SettingsDraftSpec<JudgeSettings, JudgeDraft> = {
  fields: JUDGE_FIELDS,
  toDraft: (s) => ({
    provider: s.provider ?? '',
    model: s.model ?? '',
    url: s.url ?? '',
    api_key_env: s.api_key_env ?? '',
    timeout_seconds: String(s.timeout_seconds),
    max_retries: String(s.max_retries),
  }),
  parseDraft: (d) => {
    const errors: FieldErrors = {};
    const timeout_seconds = parseNumberField(errors, 'timeout_seconds', d.timeout_seconds, false);
    const max_retries = parseNumberField(errors, 'max_retries', d.max_retries, true);
    if (Object.keys(errors).length) return { value: null, errors };
    return {
      value: {
        provider: (blankToNull(d.provider) as JudgeProvider | null) ?? null,
        model: blankToNull(d.model),
        url: blankToNull(d.url),
        api_key_env: blankToNull(d.api_key_env),
        timeout_seconds,
        max_retries,
      },
      errors,
    };
  },
};
