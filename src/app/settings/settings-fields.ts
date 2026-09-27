/** The Settings page's content, as data: what the backend's config exposes today (per its
 *  config.py, relayed by the BE), grouped the way the BE grouped it. Nothing here is fetched -
 *  there is no settings endpoint yet, every value is an `ASSAY_*` environment variable read once
 *  at process start - so these are the documented DEFAULTS, shown as such, until the API exposes
 *  live values. When it does, `SettingField.default` is the only thing the page should stop
 *  trusting; the descriptors themselves (kind, hint, unit, options) stay. */

export type SettingKind = 'url' | 'text' | 'select' | 'number' | 'json' | 'headers';

export interface SettingField {
  /** The backend's own name (`target_url`) - also what the env var is derived from. */
  key: string;
  label: string;
  kind: SettingKind;
  /** The backend's default, as text - '' when unset. */
  default: string;
  /** One line, in user terms: what it means and what happens when it's missing or exhausted. */
  hint: string;
  placeholder?: string;
  /** `select` only. */
  options?: string[];
  /** `number` only - shown after the input ("seconds per call"). */
  unit?: string;
  min?: number;
  /** Render the value in monospace (a path, a JSON template). */
  mono?: boolean;
}

/** "ASSAY_TARGET_URL" - every setting is read from an environment variable named after its key,
 *  so the name is derived, never typed out next to the key it repeats. */
export const envVar = (f: SettingField) => `ASSAY_${f.key.toUpperCase()}`;

/** Group A - the application under test. Planned to become editable; env-only today. Global:
 *  one Assay deployment tests one application. A change applies to future runs only - every run
 *  keeps the answer it actually scored (`evaluated_output`). */
export const APPLICATION_FIELDS: SettingField[] = [
  {
    key: 'target_url',
    label: 'Target URL',
    kind: 'url',
    default: '',
    placeholder: 'Not configured',
    hint: 'Unset today. A run that needs the application ends Not Ran with "no application configured".',
  },
  {
    key: 'target_method',
    label: 'Method',
    kind: 'select',
    default: 'POST',
    options: ['POST', 'GET', 'PUT', 'PATCH'],
    hint: 'Stored upper-cased. Default POST.',
  },
  {
    key: 'target_headers',
    label: 'Headers',
    kind: 'headers',
    default: '',
    hint: 'None today. A value may name an environment variable as ${NAME} - the secret stays in the environment, only its name is stored here.',
  },
  {
    key: 'target_body',
    label: 'Request body',
    kind: 'json',
    default: '{"input": "{{input}}"}',
    hint: "JSON sent to the application. Any string value may contain {{input}}, replaced by the test's input.",
    mono: true,
  },
  {
    key: 'target_output_path',
    label: 'Answer path',
    kind: 'text',
    default: '$.output',
    hint: "JSONPath to the answer inside the application's reply.",
    mono: true,
  },
  {
    key: 'target_timeout_seconds',
    label: 'Timeout',
    kind: 'number',
    default: '60',
    min: 1,
    unit: 'seconds per call',
    hint: 'Must be greater than 0.',
  },
  {
    key: 'target_max_retries',
    label: 'Retries',
    kind: 'number',
    default: '2',
    min: 0,
    unit: 'after the first call',
    hint: 'Only on connection errors, timeouts, 5xx and 429; 0 means a single call. Exhausting them is the "application answered HTTP 503 after 3 attempt(s)" a Not Ran run reports.',
  },
];

/** Group B - the LLM judge (provider, model, key). Not built yet (evaluators phase 7): a
 *  placeholder per future field, no controls. */
export const JUDGE_PLACEHOLDERS: { label: string; note: string }[] = [
  { label: 'Provider', note: 'Set in phase 7' },
  { label: 'Model', note: 'Set in phase 7' },
  { label: 'API key', note: 'Shown as configured / not configured, never the key' },
];

export interface ReadOnlySetting {
  label: string;
  value: string;
  hint: string;
  mono?: boolean;
}

/** Group D - operations. Deployment-level, restart-required, shown so an operator can confirm
 *  what is running and never edited here. The three connection strings can embed credentials,
 *  so they're shown only as "Configured" - by construction, not by remembering to redact. */
export const OPERATIONS: ReadOnlySetting[] = [
  { label: 'API address', value: '127.0.0.1:8000', hint: 'host · port', mono: true },
  {
    label: 'Allowed origins',
    value: 'http://localhost:4200',
    hint: 'CORS - the front-ends this API answers',
    mono: true,
  },
  { label: 'Logging', value: 'INFO · text', hint: 'level · format (text or json)', mono: true },
  {
    label: 'Worker DB pool',
    value: '10 + 10 overflow',
    hint: 'connections the worker may hold',
    mono: true,
  },
  {
    label: 'Reconciliation scan',
    value: 'every 60 min',
    hint: 're-publishes Pending runs older than 15 min',
    mono: true,
  },
  ...['Database', 'Message broker', 'Result backend'].map((label) => ({
    label,
    value: 'Configured',
    hint: 'connection URL not shown',
  })),
];
