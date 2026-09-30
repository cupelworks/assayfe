import { SettingsGroup } from '../api/settings-api.service';
import { JudgeSettingsRead } from '../api/models';
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
  /** A line under the intro about the saved settings, or null. */
  note?: (saved: any) => string | null;
}

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
      'Sends one request to the application under test with the settings above - including ' +
      "changes you haven't saved, which testing never saves - and shows what comes back.",
    needsInput: true,
    subject: 'the application under test',
  },
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
      'Asks the judge one short fixed question with the settings above - including changes you ' +
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
        'worker. Use Test connection to confirm it is set there.',
};
