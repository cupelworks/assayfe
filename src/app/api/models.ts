// Mirrors components.schemas in Assay's OpenAPI (v0.10.0).
export interface Ref {
  id: string;
}
export interface Page<T> {
  total: number;
  offset: number;
  limit: number;
  items: T[];
}
/** Pending/Running are lifecycle only. The terminal values are an outcome roll-up of every
 *  assigned test type's own pass/fail (see TestTypeResult), not just "did it finish": Green
 *  (every type passed), Amber (some passed, some didn't), Red (every type was evaluated and
 *  none passed), NotRan (nothing could be attempted at all - a model-call/infra failure, the
 *  only status `error` is ever set for). NotRan is the wire value (matches the API's enum
 *  exactly, no space) - it displays as "Not Ran" via format.ts's statusLabel(), never shown to
 *  the user as the raw key. */
export type TestStatus = 'Pending' | 'Running' | 'Green' | 'Amber' | 'Red' | 'NotRan';
/** One assigned test type's outcome within a run's `results`. `passed` is always present.
 *  `score` is populated for nlp_metric types (on the type's own native scale - see its
 *  config_fields threshold min/max), sometimes for llm_as_judge, and by contract null for
 *  deterministic types, which are pass/fail only. `detail` carries a judge's rationale, or this
 *  specific type's own error message if only it failed to evaluate while the rest of the run's
 *  other types proceeded normally. */
export interface TestTypeResult {
  passed: boolean;
  score: number | null;
  detail: string | null;
  /** The part of the reply this check read; null = the default answer. */
  answer_path?: string | null;
  /** Which evaluator engine produced this result, as the type's catalogue row named it at
   *  execution time - recorded on the run so a later catalogue change can't reinterpret an old
   *  result. Null only when the type wasn't in the catalogue at all when the run executed (then
   *  `detail` says so), and on results written before this field existed (legacy runs). */
  engine?: string | null;
  /** That engine's settings for this type, exactly as the catalogue row held them at execution
   *  time. Null in the same two cases as `engine`. */
  engine_settings?: Record<string, unknown> | null;
  /** A judge's rubric as it graded with it - its own (`custom`, which replaced the default) or
   *  the type's `default`. Null for other types, for a judge that couldn't be asked (`detail`
   *  says why) and on results written before this field existed. */
  rubric?: JudgeRubric | null;
  /** The model that gave a judge's verdict, recorded at execution time. Null for other types,
   *  for a judge that couldn't be asked, and on older results. */
  judge?: { provider: JudgeProvider; model: string } | null;
}
export interface JudgeRubric {
  /** Trimmed, exactly as the judge received it. */
  text: string;
  source: 'custom' | 'default';
}

// Datasets
export interface DataSetMetadata {
  id: string;
  name: string;
  created_at: string;
}
export interface DataSetRowSchema {
  prompt: string;
  expected_output: string;
  model_output: string;
}
export interface DataSetRow {
  id: string;
  row_info: DataSetRowSchema;
}
export interface DataSetRowPage extends Page<DataSetRow> {
  id: string;
}
export interface DataRowInfo {
  n: number;
  ids: string[];
}
export interface DataSetInfo {
  id: string;
  name: string;
}
export interface DataSetImportResult {
  dataset: DataSetInfo;
  loaded: DataRowInfo;
  path?: string;
}
export interface DataSetDeletedData {
  dataset: DataSetInfo;
  deleted: DataRowInfo;
}
export interface DataSetMutationResult {
  dataset: DataSetInfo;
  deleted?: DataRowInfo;
  updated?: DataRowInfo;
}

// Tests
/** Per-field config values for one assigned test type, keyed by the type's config_fields[].key.
 *  Never carries a `reference`-kind field - that always resolves from the test case's own
 *  expected_output instead (see TestType.config_fields). Null when the type has no non-reference
 *  fields, or none were filled in. */
export interface TestTypeAssignment {
  name: string;
  config?: Record<string, string> | null;
  /** Which part of the application's reply this check reads, as a JSONPath (e.g. "$.stop_reason",
   *  or "$" for the whole reply); null = the default answer (`evaluated_output`). The API replaces
   *  the assignment list whole on PATCH and reads a missing key as null, so a form must always
   *  send it back - see `buildAssignments`. */
  answer_path?: string | null;
}
export interface TestCaseBody {
  name?: string;
  input: string;
  expected_output?: string | null;
  model_output?: string | null;
  test_type_assignments?: TestTypeAssignment[];
}
export interface TestCase extends TestCaseBody {
  id: string;
}
export interface TestCasePage {
  total: number;
  offset: number;
  limit: number;
  test_cases: TestCase[];
}
export type ModifyTestCase = Partial<TestCaseBody>;

// Test sets / plans
export interface ScopeMetadata {
  id: string;
  name: string;
  created_at: string;
  /** Test sets only - current entry count. */
  entry_count?: number;
  /** Test plans only - current linked-set count. */
  linked_set_count?: number;
}
export interface TestSetEntry extends TestCaseBody {
  id: string;
  test_case_id: Ref;
}
export interface TestPlanEntry {
  id: string;
  test_set: ScopeMetadata;
}

// Runs
export interface ExecutionMetadata {
  id: string;
  created_at: string;
  run_count: number;
  replayed_execution_id: Ref | null;
  test_set_id?: Ref;
  test_plan_id?: Ref;
}
export interface RunMetadata {
  id: string;
  created_at: string;
  status: TestStatus;
  test_set_entry_id?: Ref;
  test_case_id?: Ref;
}
/** The lifecycle/outcome fields every run-detail response carries regardless of origin - factored
 *  out once RunDetails and StandaloneRunDetails were about to duplicate a fifth field
 *  (evaluated_output/output_source, on top of the existing executed_at/error/results). */
export interface RunOutcome {
  executed_at: string | null;
  /** The application's whole parsed reply - null for a recorded answer, for NotRan, and on runs
   *  from before it was kept. Any JSON value. */
  application_reply?: unknown;
  /** Set only when status is NotRan - a run-level failure, mutually exclusive with results.
   *  Since 0.9.5 also covers the application-under-test being unreachable (e.g. "application
   *  answered HTTP 503 after 3 attempt(s)"), not just a model-call failure. */
  error: string | null;
  /** Per-assigned-type outcomes, keyed by type name. Populated once status is Green/Amber/Red;
   *  null while Pending/Running, and for NotRan (see error instead). A single type can still fail
   *  on its own (e.g. an invalid regex config) without failing the run - that shows up here as
   *  `passed: false, score: null` with the reason in `detail`, same shape as any other result. */
  results: Record<string, TestTypeResult> | null;
  /** The exact text every assigned type was actually scored against - not necessarily the
   *  content's own model_output (see output_source). Null while Pending/Running, on NotRan, and
   *  on runs executed before this field existed (legacy). */
  evaluated_output: string | null;
  /** Where evaluated_output came from: 'recorded' - the content already had a model_output and
   *  the run scored that as-is; 'application' - the content had none, so the worker called the
   *  application under test and scored its live reply (in which case the content's own
   *  model_output is null - evaluated_output is the only place the answer appears). Null
   *  whenever evaluated_output is. */
  output_source: 'recorded' | 'application' | null;
}
export interface RunDetails extends RunMetadata, TestCaseBody, RunOutcome {
  test_case_id: Ref;
  test_set_id?: Ref | null;
  test_plan_id?: Ref;
  test_case_snapshot_at?: { snapshot_at: string };
}
export interface StandaloneRun {
  id: string;
  created_at: string;
  status: TestStatus;
  test_case_id: Ref;
}
/** Since 0.9.5: carries a frozen copy of the test as it was when the run was created (taken at
 *  creation time - test_case_snapshot_at equals created_at - and never touched by later edits to
 *  the live test), same shape as RunDetails. Always present, no pre-existing-run null case - the
 *  backend backfilled/recreated its data rather than leaving old rows without one. */
export interface StandaloneRunDetails extends StandaloneRun, TestCaseBody, RunOutcome {
  test_case_snapshot_at: { snapshot_at: string };
}
export type RunOrigin = 'Standalone' | 'TestSet' | 'TestPlan';
/** A row from GET /runs - every run in the system, regardless of origin. Only the ID field(s) `origin` implies are non-null. */
export interface AnyRunMetadata {
  id: string;
  status: TestStatus;
  created_at: string;
  origin: RunOrigin;
  test_case_id?: Ref | null;
  test_set_entry_id?: Ref | null;
  test_set_execution_id?: Ref | null;
  test_plan_execution_id?: Ref | null;
  /** The test set this run belongs to - set only when origin is TestSet. */
  test_set_id?: Ref | null;
  /** The test plan this run belongs to - set only when origin is TestPlan. */
  test_plan_id?: Ref | null;
}
export type ExecutionOrigin = 'TestSet' | 'TestPlan';
/** A row from GET /runs/executions - every test-set/test-plan execution, no standalone runs (they have no execution wrapper). Only the ID field(s) `origin` implies are non-null. */
export interface AnyExecutionMetadata {
  id: string;
  created_at: string;
  origin: ExecutionOrigin;
  run_count: number;
  test_set_id?: Ref | null;
  replayed_test_set_execution_id?: Ref | null;
  test_plan_id?: Ref | null;
  replayed_test_plan_execution_id?: Ref | null;
}

// Test types catalogue
export type TestCategory = 'deterministic' | 'nlp_metric' | 'llm_as_judge';
/** reference: reserved - always resolves from the test case's expected_output, never stored in
 *  an assignment's config. multiline: freeform text, no format validation (e.g. a regex pattern
 *  or a substring - stored as given). rubric: freeform text injected into the LLM-as-judge
 *  prompt at evaluation time. numeric: a number, stored as a plain string like every other kind -
 *  the API does NOT validate its format or range (a non-numeric or out-of-range value is accepted
 *  silently), so the FE owns that check entirely. Closed set - extend only when a type needs a
 *  shape none of these cover (e.g. enum/select). */
/** "json": JSON text (a document or a single value - strings in double quotes). "jsonpath": a
 *  JSONPath expression like $.status. Both are checked on save by the API (422) and in the form. */
export type ConfigFieldKind =
  | 'reference'
  | 'multiline'
  | 'rubric'
  | 'numeric'
  | 'json'
  | 'jsonpath'
  /** A regular expression - compiled by the API on save (a 422 with the reason if it isn't). */
  | 'regex'
  /** A JSON Schema written as JSON - checked by the API on save to be a valid schema. */
  | 'json_schema';
export interface ConfigFieldDescriptor {
  key: string;
  label: string;
  kind: ConfigFieldKind;
  required: boolean;
  /** Inclusive bounds for a "numeric" field - null for every other kind. Enforced by the API when
   *  a type is assigned (a 422); the FE mirrors them so the form says so before saving. */
  min?: number | null;
  max?: number | null;
  /** A "numeric" field that must be a whole number (Word Count Limit's max/min); false otherwise. */
  integer?: boolean;
  /** An example value for the empty input, or null. */
  placeholder?: string | null;
  /** A one-line note shown under the field, or null. */
  hint?: string | null;
}
export interface TestType {
  id: string;
  name: string;
  category: TestCategory;
  description: string;
  is_active: boolean;
  created_at: string;
  best_for: string;
  cost: string;
  limitations: string;
  config_fields: ConfigFieldDescriptor[];
  /** Read-only. Which evaluator engine scores this type in the worker (e.g. `exact_match`,
   *  `rouge`, `llm_judge`) - several types can share one engine and differ only in
   *  `engine_settings`. */
  engine: string;
  /** Read-only. That engine's parameters for this type - shape depends on the engine (e.g.
   *  `{variant: "rougeL"}` for ROUGE). `{}` for an engine that takes nothing. */
  engine_settings: Record<string, unknown>;
  /** Which way a threshold-scored type passes - `gte` (score >= threshold, higher is better) or
   *  `lte` (score <= threshold, lower is better). Null for a type with no threshold field at all
   *  (deterministic checks, LLM judges) - every metric type is `gte` today, `lte` exists for a
   *  future lower-is-better metric. Read-only, set by the backend, never user-editable. */
  comparison: 'gte' | 'lte' | null;
}

export type Kind = 'test-sets' | 'test-plans';

// Settings - one shape per group (/settings/<group>): the application under test (since 0.9.6)
// and the LLM judge (phase 7). Every group reads, saves, resets and checks the same way.

/** Where a group's values come from. "environment": nothing saved from the UI, values come from
 *  the group's ASSAY_<GROUP>_* variables / defaults (`updated_at` null). "database": saved from
 *  the UI - the saved group wins as a whole until reset. */
export interface SettingsSource {
  source: 'database' | 'environment';
  updated_at: string | null;
}
/** One test call with a group's settings, run on a worker: one attempt, no retries, never saved.
 *  `ok`/`status_code`/`latency_ms`/`answer`/`error` are null until `completed` (and
 *  `status_code`/`latency_ms` stay null when nothing came back). Same shape for every group. */
export interface SettingsCheck<S> {
  id: string;
  status: 'pending' | 'running' | 'completed';
  created_at: string;
  completed_at: string | null;
  /** The settings actually checked - the saved ones with the proposed changes applied. */
  settings: S;
  ok: boolean | null;
  status_code: number | null;
  latency_ms: number | null;
  answer: string | null;
  error: string | null;
}

export type TargetMethod = 'POST' | 'PUT' | 'PATCH';
/** The seven fields that say how Assay calls the application under test. Header values come back
 *  exactly as stored - a `${NAME}` reference is never expanded, so no secret is ever returned. */
export interface TargetSettings {
  url: string | null;
  method: TargetMethod;
  headers: Record<string, string>;
  /** A JSON object with `{{input}}` in at least one string value. */
  body: Record<string, unknown>;
  output_path: string;
  timeout_seconds: number;
  max_retries: number;
}
export type TargetField = keyof TargetSettings;
export interface TargetSettingsRead extends TargetSettings, SettingsSource {}
/** Any subset of the seven fields. `url: null` unsets it; `headers` and `body` replace whole. */
export type TargetSettingsUpdate = Partial<TargetSettings>;
export type TargetCheck = SettingsCheck<TargetSettings>;

export type JudgeProvider = 'anthropic' | 'openai';
/** The model Assay asks to grade answers for the LLM-as-judge types. The API key itself is never
 *  stored, sent or returned: the worker reads it from an environment variable. */
export interface JudgeSettings {
  /** null = no judge configured - judge checks in runs then fail with that reason. */
  provider: JudgeProvider | null;
  /** Required (non-blank) when a provider is set. */
  model: string | null;
  /** The whole endpoint, called exactly as written - nothing appended; null = the provider's
   *  own endpoint. */
  url: string | null;
  /** The name of the env var holding the key on the worker; null = the provider's standard one. */
  api_key_env: string | null;
  timeout_seconds: number;
  max_retries: number;
}
export type JudgeField = keyof JudgeSettings;
export interface JudgeSettingsRead extends JudgeSettings, SettingsSource {
  /** Read-only: the variable the worker actually reads the key from (e.g. ANTHROPIC_API_KEY);
   *  null when no provider is set. Whether it's set can only be known on the worker - see the
   *  check. */
  api_key_variable: string | null;
  /** Read-only: the URL the worker will actually call - `url` as written, else the provider's
   *  own endpoint; null when no provider is set. */
  endpoint: string | null;
}
export type JudgeSettingsUpdate = Partial<JudgeSettings>;
export type JudgeCheck = SettingsCheck<JudgeSettings>;

// Worker health - GET /health/worker: the broker and the workers, as seen from the API. Always 200
// (the API is up); takes about a second, so it's fetched on demand, never per request.
export type WorkerHealthStatus = 'ready' | 'outdated' | 'no_worker' | 'broker_unreachable';
export interface WorkerHealthWorker {
  name: string;
  /** The Assay version it runs; null = too old to report one. */
  version: string | null;
  /** Opaque hash of its code at start-up - compared by the API, never shown or parsed here. */
  code_fingerprint: string | null;
  /** Same code as the API. */
  current_code: boolean;
  /** Kinds of job (task names) it doesn't know; [] when fine. */
  missing_tasks: string[];
  /** One sentence to show as sent; null when the worker is fine. */
  problem: string | null;
}
export interface WorkerHealth {
  status: WorkerHealthStatus;
  broker: { reachable: boolean; error: string | null };
  /** Empty for no_worker and broker_unreachable. */
  workers: WorkerHealthWorker[];
  /** The API's own version and fingerprint - the reference the workers are compared with. */
  version: string;
  code_fingerprint: string;
  checked_at: string;
}
