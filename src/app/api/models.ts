// Mirrors components.schemas in Assay's OpenAPI (v0.9.2).
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
 *  `score` is populated for deterministic/nlp_metric types, sometimes for llm_as_judge. `detail`
 *  carries a judge's rationale, or this specific type's own error message if only it failed to
 *  evaluate while the rest of the run's other types proceeded normally. */
export interface TestTypeResult {
  passed: boolean;
  score: number | null;
  detail: string | null;
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
export interface RunDetails extends RunMetadata, TestCaseBody {
  executed_at: string | null;
  /** Set only when status is NotRan - a run-level failure, mutually exclusive with results. */
  error: string | null;
  /** Per-assigned-type outcomes, keyed by type name. Populated once status is Green/Amber/Red;
   *  null while Pending/Running, and for NotRan (see error instead). */
  results: Record<string, TestTypeResult> | null;
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
export interface StandaloneRunDetails extends StandaloneRun {
  executed_at: string | null;
  /** Set only when status is NotRan - a run-level failure, mutually exclusive with results. */
  error: string | null;
  /** Per-assigned-type outcomes, keyed by type name. Populated once status is Green/Amber/Red;
   *  null while Pending/Running, and for NotRan (see error instead). */
  results: Record<string, TestTypeResult> | null;
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
export type ConfigFieldKind = 'reference' | 'multiline' | 'rubric' | 'numeric';
export interface ConfigFieldDescriptor {
  key: string;
  label: string;
  kind: ConfigFieldKind;
  required: boolean;
  /** Advisory bounds for a "numeric" field - null for every other kind. The API does not
   *  validate a submitted value against these (or that it's numeric at all), so they only drive
   *  the FE's own input constraints and validation. */
  min?: number | null;
  max?: number | null;
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
}

export type Kind = 'test-sets' | 'test-plans';
