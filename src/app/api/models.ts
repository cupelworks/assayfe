// Mirrors components.schemas in Assay's OpenAPI (v0.9.0).
export interface Ref {
  id: string;
}
export interface Page<T> {
  total: number;
  offset: number;
  limit: number;
  items: T[];
}
export type TestStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';

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
export interface TestCaseBody {
  name?: string;
  input: string;
  expected_output?: string | null;
  model_output?: string | null;
  test_type_names?: string[];
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
  error: string | null;
  scores: Record<string, number> | null;
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
  error: string | null;
  scores: Record<string, number> | null;
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
}

// Test types catalogue
export type TestCategory = 'deterministic' | 'nlp_metric' | 'llm_as_judge';
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
  required_reference: boolean;
}

export type Kind = 'test-sets' | 'test-plans';
