import { SettingsGroup } from '../api/settings-api.service';
import { JudgeSettingsRead, TargetSettingsRead } from '../api/models';
import { SettingField, JUDGE_SETTING_FIELDS, TARGET_SETTING_FIELDS } from './settings-fields';
import { SettingsDraftSpec } from './settings-draft';
import { TARGET_DRAFT } from './target-draft';
import { JUDGE_DRAFT } from './judge-draft';

/**
 * Everything that differs between two editable settings groups; the rest - loading, saving only
 * what changed, 422s under fields, reset, the test-connection flow - is one shared component
 * (SettingsGroupComponent), because every group has the same endpoints and lifecycle.
 */
export interface SettingsGroupConfig {
  group: SettingsGroup;
  title: string;
  intro: string;
  /** "ASSAY_TARGET_" - a field's fallback variable is this plus its upper-cased key. */
  envPrefix: string;
  fields: SettingField[];
  draft: SettingsDraftSpec<any, any>;
  check: {
    intro: string;
    /** Whether the check sends a test input (target) or asks a fixed question (judge). */
    needsInput: boolean;
    /** What it calls, for the status lines: "Calling the judge…". */
    subject: string;
  };
  /** Mistakes the page can spot on its own while you type, by field - shown like an error but
   *  never blocking Save (the API decides what's valid). Gets the form's values and what the
   *  page knows about the other groups. */
  warnings?: (draft: Record<string, any>, context: SettingsContext) => Record<string, string>;
  /** A line in the Test connection cell about the saved settings, or null. */
  note?: (saved: any) => string | null;
  /** The group's tile in the page's summary strip: the headline value and one line under it. */
  summary: (saved: any) => SettingsSummary;
}

/** What a group's checks may know about the other groups' saved settings. */
export interface SettingsContext {
  /** The application under test's saved URL. */
  targetUrl: string | null;
}

/** Two URLs that call the same place: trimmed, case-insensitive, trailing "/" ignored. */
const sameUrl = (a: string | null | undefined, b: string | null | undefined) => {
  const norm = (u: string) => u.trim().replace(/\/+$/, '').toLowerCase();
  return !!a?.trim() && !!b?.trim() && norm(a) === norm(b);
};

export interface SettingsSummary {
  value: string;
  detail: string;
  /** Render the value in monospace (a URL). */
  mono?: boolean;
}

/** A select field's label for its current value ("Anthropic" for "anthropic"). */
const optionLabel = (fields: SettingField[], key: string, value: string | null) =>
  fields.find((f) => f.key === key)?.options?.find((o) => o.value === (value ?? ''))?.label;

export const TARGET_GROUP: SettingsGroupConfig = {
  group: 'target',
  title: 'Application under test',
  intro:
    'The endpoint Assay calls for an answer when a test has no recorded model output. A change ' +
    'applies to future runs only - every run keeps the answer it actually scored, and a replay ' +
    'of an application-sourced run calls the application under test again with the current values.',
  envPrefix: 'ASSAY_TARGET_',
  fields: TARGET_SETTING_FIELDS,
  draft: TARGET_DRAFT,
  check: {
    intro:
      'Sends one request to the application under test with the settings in the form - including ' +
      "changes you haven't saved, which testing never saves - and shows what comes back.",
    needsInput: true,
    subject: 'the application under test',
  },
  summary: (s: TargetSettingsRead) =>
    s.url
      ? {
          value: s.url.replace(/^https?:\/\//, ''),
          detail: `${s.method} · answer at ${s.output_path}`,
          mono: true,
        }
      : { value: 'Not set', detail: 'Runs that need an answer end Not Ran' },
};

export const JUDGE_GROUP: SettingsGroupConfig = {
  group: 'judge',
  title: 'LLM judge',
  intro:
    'The model Assay asks to grade answers for the LLM-as-judge test types - Correctness, ' +
    "Relevance, Bias, Toxicity, Hallucination. It's Assay's own examiner, separate from the " +
    'application under test. A change applies to future runs only.',
  envPrefix: 'ASSAY_JUDGE_',
  fields: JUDGE_SETTING_FIELDS,
  draft: JUDGE_DRAFT,
  check: {
    intro:
      'Asks the judge one short fixed question with the settings in the form - including changes you ' +
      "haven't saved, which testing never saves - and shows its answer. It runs on the worker, " +
      "so it's also how you find out whether the API key is set there.",
    needsInput: false,
    subject: 'the judge',
  },
  // The API can't know whether the key is set - it's read on the worker, a different process -
  // so the page says where it's read from and points at the check instead of claiming either way.
  note: (s: JudgeSettingsRead) =>
    s.provider == null
      ? 'No judge configured: the judge test types fail in runs with that reason until you ' +
        'choose a provider and model.'
      : `API key: read from ${s.api_key_variable ?? 'the provider’s standard variable'} on the ` +
        'worker (its environment or .env). Use Test connection to confirm it is set there.',
  // The judge pointed at the application under test - a URL pasted into the wrong group.
  warnings: (d, ctx): Record<string, string> =>
    sameUrl(d['url'], ctx.targetUrl)
      ? { url: "This is the application under test's URL (Target URL), not a judge's." }
      : {},
  summary: (s: JudgeSettingsRead) =>
    s.provider == null
      ? { value: 'Not configured', detail: 'Judge test types fail until you choose one' }
      : {
          value: optionLabel(JUDGE_SETTING_FIELDS, 'provider', s.provider) ?? s.provider,
          detail: s.model ?? 'No model set',
        },
};
