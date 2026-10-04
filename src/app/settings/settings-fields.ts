/** The Settings page's content, as data, grouped the way the backend groups it. Each editable
 *  group's VALUES come from GET /settings/<group>; what lives here is how each field is presented
 *  (label, kind, hint, unit, options). The operations tiles are static - no endpoint exposes
 *  that group. */

export type SettingKind = 'url' | 'text' | 'select' | 'number' | 'json' | 'headers';

export interface SettingField {
  /** The API's field name (`output_path`) - also what the env var is derived from. */
  key: string;
  label: string;
  kind: SettingKind;
  /** One line, in user terms: what it means and what happens when it's missing or exhausted. */
  hint: string;
  /** An example value for the empty input - or one per value of another field (the judge's
   *  examples depend on its provider): `{ from: 'provider', values: { anthropic: '…' } }`. */
  placeholder?: string | { from: string; values: Record<string, string> };
  /** `select` only. `value: ''` is "not set" (null). */
  options?: { value: string; label: string }[];
  /** `number` only - shown after the input ("seconds per call"). */
  unit?: string;
  /** `number` only - the on-screen keyboard the shared `assayNumber` input offers (see
   *  shared/number.ts for why numbers are typed as text); the API enforces the ranges the hint
   *  states. */
  inputMode?: 'decimal' | 'numeric';
  /** Render the value in monospace (a path, a JSON template). */
  mono?: boolean;
  /** Spans both columns of the form's grid (a URL, the headers, a JSON body); other fields pair
   *  up two per row, so a group's field order is also its layout. */
  wide?: boolean;
  /** Marked "optional" next to its label - empty is a valid choice with a default behind it
   *  (the judge's endpoint: empty = the provider's own). */
  optional?: boolean;
}

/** Group A - the application under test, editable (since API 0.9.6). Pointing it at a different
 *  application changes what future runs call - every past run keeps the answer it actually
 *  scored (`evaluated_output`). */
export const TARGET_SETTING_FIELDS: SettingField[] = [
  {
    key: 'url',
    label: 'Target URL',
    kind: 'url',
    wide: true,
    placeholder: 'https://your-app.example.com/answer',
    hint: 'A run that needs the application under test ends Not Ran when Target URL is empty.',
  },
  {
    key: 'method',
    label: 'Method',
    kind: 'select',
    options: ['POST', 'PUT', 'PATCH'].map((m) => ({ value: m, label: m })),
    hint: 'Default POST.',
  },
  {
    key: 'output_path',
    label: 'Answer path',
    kind: 'text',
    hint: 'JSONPath to the answer inside the reply from the application under test.',
    mono: true,
  },
  {
    key: 'headers',
    label: 'Headers',
    kind: 'headers',
    wide: true,
    hint:
      'Headers Assay adds to every call to the application under test, for example to authenticate. ' +
      "Don't type a secret here. Write ${NAME} instead, where NAME is an environment variable " +
      'set on the Assay server that holds the secret. Assay keeps only the name and reads the ' +
      "actual value from the server's environment (or its .env file) on every call. " +
      'Example: Authorization → Bearer ${ASSAY_TARGET_API_KEY}',
  },
  {
    key: 'body',
    label: 'Request body',
    kind: 'json',
    wide: true,
    hint:
      'The JSON body Assay sends to the application under test on every call. ' +
      "Write {{input}} wherever the test's input should go - Assay swaps it for the actual " +
      'input before sending. Example: with the default body and a test whose input is ' +
      '"What is your refund policy?", Assay sends {"input": "What is your refund policy?"}',
    mono: true,
  },
  {
    key: 'timeout_seconds',
    label: 'Timeout',
    kind: 'number',
    inputMode: 'decimal',
    unit: 'seconds per call',
    hint: 'More than 0, up to 600.',
  },
  {
    key: 'max_retries',
    label: 'Retries',
    kind: 'number',
    inputMode: 'numeric',
    unit: 'after the first call',
    hint: '0 to 10. Only on connection errors, timeouts, 5xx and 429; 0 means a single call. Exhausting them is the "application under test answered HTTP 503 after 3 attempt(s)" a Not Ran run reports.',
  },
];

/** Group B - the LLM judge: the model Assay asks to grade answers for the LLM-as-judge types
 *  (phase 7). The API key is never entered here: the worker reads it from an environment
 *  variable - see the group's note in settings-groups.ts. Hints are the backend's wording. */
export const JUDGE_SETTING_FIELDS: SettingField[] = [
  {
    key: 'provider',
    label: 'Provider',
    kind: 'select',
    options: [
      { value: '', label: 'None' },
      { value: 'anthropic', label: 'Anthropic' },
      { value: 'openai', label: 'OpenAI' },
    ],
    hint: 'None: no judge - judge checks are not met in runs, with "No judge configured" as the reason.',
  },
  {
    key: 'model',
    label: 'Model',
    kind: 'text',
    mono: true,
    placeholder: {
      from: 'provider',
      values: { anthropic: 'claude-sonnet-5-5', openai: 'gpt-4o-mini' },
    },
    hint:
      "The provider's model name, e.g. claude-sonnet-5-5, or claude-haiku-4-5-20251001 for a " +
      'cheaper judge. Temperature is always 0.',
  },
  {
    key: 'url',
    label: 'URL (endpoint)',
    kind: 'url',
    optional: true,
    placeholder: {
      from: 'provider',
      values: {
        anthropic: 'https://api.anthropic.com/v1/messages',
        openai: 'https://api.openai.com/v1/chat/completions',
      },
    },
    hint:
      "Leave empty for the provider's own API. Otherwise the full endpoint, used exactly as " +
      'written - e.g. http://localhost:11434/v1/chat/completions for Ollama (provider OpenAI), ' +
      "https://openrouter.ai/api/v1/chat/completions for OpenRouter. Not your application's URL.",
  },
  {
    key: 'api_key_env',
    label: 'API key variable',
    kind: 'text',
    mono: true,
    placeholder: {
      from: 'provider',
      values: { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY' },
    },
    hint: 'The name of the environment variable holding the key on the worker - never the key itself.',
  },
  {
    key: 'timeout_seconds',
    label: 'Timeout',
    kind: 'number',
    inputMode: 'decimal',
    unit: 'seconds per call',
    hint: 'More than 0, up to 600.',
  },
  {
    key: 'max_retries',
    label: 'Retries',
    kind: 'number',
    inputMode: 'numeric',
    unit: 'after the first call',
    hint: '0 to 10. 0 means a single call.',
  },
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
  { label: 'API address', value: '127.0.0.1:8000', hint: 'Host · port', mono: true },
  {
    label: 'Allowed origins',
    value: 'http://localhost:4200',
    hint: 'CORS - the front-ends this API answers',
    mono: true,
  },
  { label: 'Logging', value: 'INFO · text', hint: 'Level · format (text or json)', mono: true },
  {
    label: 'Worker DB pool',
    value: '10 + 10 overflow',
    hint: 'Connections the worker may hold',
    mono: true,
  },
  {
    label: 'Reconciliation scan',
    value: 'every 60 min',
    hint: 'Re-publishes Pending runs older than 15 min',
    mono: true,
  },
  {
    label: 'Database',
    value: 'Configured',
    hint: 'Where Assay keeps everything - datasets, tests, runs and their results',
  },
  {
    label: 'Message broker',
    value: 'Configured',
    hint: 'The queue that hands runs and connection tests to the workers',
  },
  {
    label: 'Result backend',
    value: 'Configured',
    hint: "Where the workers note whether each job finished or failed - a run's results go to the database",
  },
];
