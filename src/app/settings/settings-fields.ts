import { TargetField } from '../api/models';

/** The Settings page's content, as data, grouped the way the backend groups it. The application
 *  under test's VALUES come from GET /settings/target; what lives here is how each field is
 *  presented (label, kind, hint, unit, options). The judge placeholders and the operations tiles
 *  are still static - no endpoint exposes those groups yet. */

export type SettingKind = 'url' | 'text' | 'select' | 'number' | 'json' | 'headers';

export interface SettingField {
  /** The API's field name (`output_path`) - also what the env var is derived from. */
  key: TargetField;
  label: string;
  kind: SettingKind;
  /** One line, in user terms: what it means and what happens when it's missing or exhausted. */
  hint: string;
  placeholder?: string;
  /** `select` only. */
  options?: string[];
  /** `number` only - shown after the input ("seconds per call"). */
  unit?: string;
  /** `number` only - the on-screen keyboard to offer. Numbers are typed into a plain text input
   *  (a type="number" input rewrites the value mid-typing - "1.0" became "1"); the API enforces
   *  the ranges the hint states. */
  inputMode?: 'decimal' | 'numeric';
  /** Render the value in monospace (a path, a JSON template). */
  mono?: boolean;
}

/** "ASSAY_TARGET_OUTPUT_PATH" - the environment variable a field falls back to while nothing is
 *  saved from the UI. Derived from the API field name, never typed out next to the key. */
export const envVar = (f: SettingField) => `ASSAY_TARGET_${f.key.toUpperCase()}`;

/** Group A - the application under test, editable (since API 0.9.6). Pointing it at a different
 *  application changes what future runs call - every past run keeps the answer it actually
 *  scored (`evaluated_output`). */
export const APPLICATION_FIELDS: SettingField[] = [
  {
    key: 'url',
    label: 'Target URL',
    kind: 'url',
    placeholder: 'https://your-app.example.com/answer',
    hint: 'A run that needs the application under test ends Not Ran when Target URL is empty.',
  },
  {
    key: 'method',
    label: 'Method',
    kind: 'select',
    options: ['POST', 'PUT', 'PATCH'],
    hint: 'Default POST.',
  },
  {
    key: 'headers',
    label: 'Headers',
    kind: 'headers',
    hint:
      'Headers Assay adds to every call to the application under test, for example to authenticate. ' +
      "Don't type a secret here. Write ${NAME} instead, where NAME is an environment variable " +
      'set on the Assay server that holds the secret. Assay keeps only the name and reads the ' +
      "actual value from the server's environment on every call. " +
      'Example: Authorization → Bearer ${ASSAY_TARGET_API_KEY}',
  },
  {
    key: 'body',
    label: 'Request body',
    kind: 'json',
    hint:
      'The JSON body Assay sends to the application under test on every call. ' +
      "Write {{input}} wherever the test's input should go - Assay swaps it for the actual " +
      'input before sending. Example: with the default body and a test whose input is ' +
      '"What is your refund policy?", Assay sends {"input": "What is your refund policy?"}',
    mono: true,
  },
  {
    key: 'output_path',
    label: 'Answer path',
    kind: 'text',
    hint: 'JSONPath to the answer inside the reply from the application under test.',
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
