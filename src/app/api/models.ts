// Mirrors components.schemas in Assay's OpenAPI (v0.11.0).
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
/** One check's result, keyed in a run's `results` by the check's label. */
export interface TestTypeResult {
  /** The catalogue type that ran - look the type up by this, never by the result's key (a
   *  label). Null only on results written before labels existed. */
  test_type?: string | null;
  passed: boolean;
  /** True when the check itself couldn't run (a judge timeout, no judge chosen, an engine not
   *  installed): `detail` says why, and it's an error, not a check that wasn't met. False on
   *  results from before the flag existed. */
  errored?: boolean;
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
  /** The catalogue type it runs. A test can hold the same type more than once. */
  name: string;
  /** The check's own name - unique within the test, ignoring letter case, at most 100
   *  characters. Null or blank → the API names it: the type's name, numbered past every name in
   *  use ("Contains", "Contains 2", …). A form must send back the names it was given, so a check
   *  keeps its identity (and its results stay comparable) across edits - see checks.ts. Always
   *  set in responses, which list assignments sorted by it, ignoring case. */
  label?: string | null;
  config?: Record<string, string> | null;
  /** Which part of the application's reply this check reads, as a JSONPath (e.g. "$.stop_reason",
   *  or "$" for the whole reply); null = the default answer (`evaluated_output`). The API replaces
   *  the assignment list whole on PATCH and reads a missing key as null, so a form must always
   *  send it back - see `toAssignments` in checks.ts. */
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
  /** The statistics batch that made it, and which time of the batch it was (from 1); null
   *  outside a batch. */
  batch_id?: string | null;
  batch_index?: number | null;
  replayed_execution_id: Ref | null;
  test_set_id?: Ref;
  test_plan_id?: Ref;
}
export interface RunMetadata {
  id: string;
  created_at: string;
  status: TestStatus;
  /** The statistics batch that made it, and which time of the batch it was (from 1); null
   *  outside a batch. */
  batch_id?: string | null;
  batch_index?: number | null;
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
  /** The statistics batch that made it, and which time of the batch it was (from 1); null
   *  outside a batch. */
  batch_id?: string | null;
  batch_index?: number | null;
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
  /** The statistics batch that made it, and which time of the batch it was (from 1); null
   *  outside a batch. */
  batch_id?: string | null;
  batch_index?: number | null;
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
  /** The statistics batch that made it, and which time of the batch it was (from 1); null
   *  outside a batch. */
  batch_id?: string | null;
  batch_index?: number | null;
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

// Statistics - "Run with statistics": a test, set or plan run many times as one batch, and a
// statistical test's verdict per check over those runs (see docs/statistics in the API repo).
/** The arithmetic in code a statistical test runs - a fixed set. Branch on this, never on a
 *  test's id: the catalogue is a table, and several tests can share one engine. */
export type StatisticalEngine =
  | 'binomial_gate'
  | 'one_sample_t'
  | 'judge_stability'
  | 'pass_rates'
  | 'no_worse'
  | 'mean_scores'
  | 'score_ranks'
  | 'paired_entries';
/** A catalogue row's id (`GET /statistics/tests`): what to send as `statistical_test`. */
export type StatisticalTestName = string;
/** `rate` and `level` are shares of 1 (0.9 = 90%); `share` is a share of a check's score range. */
export interface StatisticalTestParameter {
  key: string;
  label: string;
  kind: 'rate' | 'level' | 'share';
  default: number;
  min: number;
  max: number;
  hint: string;
}
export interface StatisticalTest {
  id: StatisticalTestName;
  name: string;
  engine: StatisticalEngine;
  /** The engine's own constants for this row (the t-test's floor and recommended size). */
  engine_settings: Record<string, unknown>;
  /** `batch`: decides a batch's checks; `comparison`: compares two batches. */
  kind: 'batch' | 'comparison';
  wave: number;
  question: string;
  reads: 'pass_fail' | 'scores';
  applies_to: 'every_check' | 'scored_checks' | 'judge_checks';
  verdicts: string[];
  parameters: StatisticalTestParameter[];
  floor: { kind: 'exact' | 'rule_of_thumb' | 'none'; formula: string | null; explanation: string };
  recommended_times: number | null;
  method: string;
}
export interface StatisticalTestCatalogue {
  items: StatisticalTest[];
  max_times: number;
  max_runs: number;
}
export type StatsScopeKind = 'test' | 'test_set' | 'test_plan';
export interface StatsScope {
  kind: StatsScopeKind;
  id: string;
  name: string;
}
/** What a batch runs: exactly one of the three. */
export interface StatsScopeRef {
  test_id?: string;
  test_set_id?: string;
  test_plan_id?: string;
}
export interface EstimateRequest extends StatsScopeRef {
  statistical_test: StatisticalTestName;
  parameters?: Record<string, number>;
  /** Omitted: the default suggestion. */
  times?: number | null;
}
export interface BatchRequest extends EstimateRequest {
  /** What this batch is of, up to 500 characters. */
  note?: string | null;
}
/** The gate's rule at `times`: Passed from `pass_at_least` met, Failed up to `fail_at_most`. */
export interface GateRule {
  times: number;
  pass_at_least: number | null;
  fail_at_most: number | null;
}
export interface SizeSuggestion {
  times: number;
  kind: 'floor' | 'absorbs_not_ran' | 'allows_one_miss' | 'detects_difference' | 'recommended';
  label: string;
  default: boolean;
}
export interface CheckPlan {
  label: string;
  test_type: string;
  applies: boolean;
  reason: string | null;
}
export interface EntryPlan {
  entry_id: string | null;
  test_id: string;
  test_set_id: string | null;
  test_set_name: string | null;
  name: string;
  recorded_answer: boolean;
  checks: CheckPlan[];
}
export interface Estimate {
  scope: StatsScope;
  statistical_test: StatisticalTestName;
  engine: StatisticalEngine;
  parameters: Record<string, number>;
  floor: number;
  floor_explanation: string;
  suggestions: SizeSuggestion[];
  times: number;
  rule: GateRule | null;
  runs_per_time: number;
  runs_total: number;
  calls: {
    application: { per_time: number; total: number };
    judge: { per_time: number; total: number };
  };
  checks_total: number;
  checks_applicable: number;
  entries: EntryPlan[];
  /** `code` is stable (for an icon); `message` is shown as it is. */
  warnings: { code: string; message: string }[];
}
export type BatchStatus =
  'Pending' | 'Running' | 'Passed' | 'Failed' | 'Inconclusive' | 'Incomplete' | 'NotRan';
export type RunCounts = Partial<Record<TestStatus, number>>;
export interface BatchCallCount {
  planned: number;
  finished: number;
  in_flight: number;
}
export interface StripPoint {
  index: number;
  run_id: string;
  execution_id: string | null;
  status: TestStatus;
}
/** One entry's runs while the batch is still going: statuses only, never a verdict. Every time
 *  is there from the start (Pending cells first), in the order the result's entries will have. */
export interface LiveEntry {
  /** Null for a standalone test. */
  entry_id: string | null;
  test_id: string;
  test_set_id: string | null;
  test_set_name: string | null;
  name: string;
  runs: RunCounts;
  strip: StripPoint[];
}
export interface BatchProgress {
  times_requested: number;
  /** Times with every run finished - cancelled ones included. */
  times_done: number;
  runs_total: number;
  /** Every finished run, cancelled ones included: runs_done - runs_cancelled actually ran. */
  runs_done: number;
  runs: RunCounts;
  runs_cancelled: number;
  times_cancelled: number;
  calls: { application: BatchCallCount; judge: BatchCallCount };
  /** The runs grid while Pending/Running; null in lists, with ?series=false and once the
   *  result is stored (then it's the result's entries' strips). */
  entries?: LiveEntry[] | null;
}
/** Every interval says what it is. `sides: 'one'`: each bound is one-sided at `level`. */
export interface Interval {
  lower: number | null;
  point: number | null;
  upper: number | null;
  method: 'exact' | 'wilson' | 't' | 'newcombe';
  level: number;
  sides: 'one' | 'two';
}
/** `evaluated` (= passed + failed) is the sample; errored and Not Ran runs are counted apart. */
export interface CheckCounts {
  evaluated: number;
  passed: number;
  failed: number;
  errored: number;
  not_ran: number;
}
export interface ScoreSummary {
  n: number;
  mean: number;
  sd: number | null;
  min: number;
  max: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
}
export type CheckVerdict = 'pass' | 'fail' | 'inconclusive';
export interface Statistic {
  /** Null: no verdict could be drawn - `reason` says why. */
  verdict: CheckVerdict | null;
  reason: string;
  n: number;
  /** The interval the verdict used: whiskers that can't contradict it. */
  interval: Interval | null;
  p_value_pass: number | null;
  p_value_fail: number | null;
  rule: GateRule | null;
  t?: number | null;
  df?: number | null;
  standard_error?: number | null;
  /** When inconclusive: the size of a new batch that would likely settle it. */
  times_to_decide: number | null;
  times_to_decide_message: string | null;
}
/** One time of the batch, in order. Null values mean no value (errored / Not Ran), never 0. */
export interface SeriesPoint {
  index: number;
  run_id: string;
  execution_id: string | null;
  status: TestStatus;
  passed: boolean | null;
  score: number | null;
  error: string | null;
}
export interface CheckResult {
  label: string;
  test_type: string;
  applies: boolean;
  reason: string | null;
  /** The check's own score range - a scored check's axis. */
  scale: { min: number | null; max: number | null } | null;
  threshold: number | null;
  /** `gte`: at or above the threshold passes; `lte`: at or below. */
  comparison: string | null;
  /** The gate's (or judge stability's) target. */
  target: number | null;
  counts: CheckCounts;
  /** Under the gate it is the verdict's interval (exact, one-sided); otherwise Wilson. */
  pass_rate: Interval | null;
  agreement?: Interval | null;
  scores: ScoreSummary | null;
  statistic: Statistic | null;
  series: SeriesPoint[] | null;
}
export interface EntryResult {
  entry_id: string | null;
  test_id: string | null;
  test_set_id: string | null;
  test_set_name: string | null;
  name: string;
  recorded_answer: boolean;
  runs: RunCounts;
  checks: CheckResult[];
  /** The entry's row of the runs grid; null with ?series=false. */
  strip: StripPoint[] | null;
}
/** Whether failures concentrate in some entries (sets and plans): a bar per entry. */
export interface FailuresByEntry {
  verdict: 'concentrated' | 'no_evidence' | null;
  reason: string;
  chi_square: number | null;
  df: number | null;
  p_value: number | null;
  approximate: boolean;
  entries: {
    entry_id: string | null;
    name: string;
    test_set_name: string | null;
    passed: number;
    failed: number;
  }[];
}
export interface BatchResult {
  computed_at: string;
  checks_total: number;
  checks_applicable: number;
  /** Applicable checks by verdict: pass, fail, inconclusive and none (no verdict drawn). */
  verdicts: Record<string, number>;
  summary: string;
  entries: EntryResult[];
  failures_by_entry?: FailuresByEntry | null;
}
export interface BatchSummary {
  id: string;
  scope: StatsScope;
  statistical_test: StatisticalTestName;
  /** The arithmetic the row named when the batch was created - kept if the row changes. */
  engine: StatisticalEngine;
  parameters: Record<string, number>;
  note: string | null;
  status: BatchStatus;
  floor: number;
  progress: BatchProgress;
  /** The header sentence; null while the batch runs. */
  summary: string | null;
  created_at: string;
  stopped_at: string | null;
  completed_at: string | null;
  /** Checks by verdict (pass, fail, inconclusive, none) once finished; null while it runs. */
  verdicts?: Record<string, number> | null;
}
/** `result` is null while the batch runs, by design: no verdicts until every run has finished. */
export interface Batch extends BatchSummary {
  result: BatchResult | null;
}
export interface ComparisonRequest {
  /** The baseline. */
  batch_a: string;
  /** The change. */
  batch_b: string;
  statistical_test?: StatisticalTestName;
  parameters?: Record<string, number>;
  note?: string | null;
}
export interface ComparedBatch {
  id: string;
  note: string | null;
  status: BatchStatus;
  statistical_test: StatisticalTestName;
  times_requested: number;
  created_at: string;
}
export type ComparisonVerdict = 'better' | 'worse' | 'no_difference' | 'no_worse' | 'inconclusive';
export interface ComparisonSide {
  counts: CheckCounts;
  pass_rate: Interval | null;
  scores?: ScoreSummary | null;
  series: SeriesPoint[] | null;
}
export interface CheckComparison {
  label: string;
  test_type: string;
  a: ComparisonSide;
  b: ComparisonSide;
  /** B - A with its interval; null for score ranks (see `effect`). */
  difference: Interval | null;
  /** Score ranks: the chance a B score beats an A score. */
  effect?: number | null;
  verdict: ComparisonVerdict | null;
  reason: string;
  p_value: number | null;
  p_value_method: string | null;
  times_to_decide: number | null;
  times_to_decide_message: string | null;
}
export interface EntryComparison {
  entry_id: string | null;
  test_id: string | null;
  test_set_name: string | null;
  name: string;
  checks: CheckComparison[];
}
/** Paired by entry: one verdict for the whole scope, over each entry's check A → B. */
export interface PairedComparison {
  n_pairs: number;
  pairs: {
    entry_id: string | null;
    name: string;
    label: string;
    rate_a: number;
    rate_b: number;
    difference: number;
  }[];
  difference: Interval | null;
  verdict: ComparisonVerdict | null;
  reason: string;
  p_value: number | null;
  p_value_wilcoxon: number | null;
  wilcoxon_method: string | null;
}
export interface ComparisonResult {
  verdicts: Record<string, number>;
  summary: string;
  entries: EntryComparison[];
  /** Entries or checks only one batch has. */
  unmatched: { entry_id: string | null; name: string; label: string | null; only_in: 'a' | 'b' }[];
  paired?: PairedComparison | null;
}
export interface ComparisonSummary {
  id: string;
  scope: StatsScope;
  statistical_test: StatisticalTestName;
  engine: StatisticalEngine;
  parameters: Record<string, number>;
  note: string | null;
  batch_a: ComparedBatch;
  batch_b: ComparedBatch;
  summary: string;
  created_at: string;
}
export interface Comparison extends ComparisonSummary {
  result: ComparisonResult;
}
