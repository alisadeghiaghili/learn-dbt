/**
 * Core domain types for the learn-dbt simulator.
 */

export type Layer = 'source' | 'seed' | 'staging' | 'intermediate' | 'mart' | 'exposure' | 'snapshot';

export type Materialization =
  | 'source'
  | 'seed'
  | 'view'
  | 'table'
  | 'incremental'
  | 'ephemeral'
  | 'snapshot'
  | 'materialized_view';

export type IncrementalStrategy = 'append' | 'delete+insert' | 'merge' | 'microbatch';

export type NodeStatus = 'pending' | 'success' | 'error' | 'skipped';

export type TestType =
  | 'unique'
  | 'not_null'
  | 'relationships'
  | 'accepted_values'
  | 'expression_is_true'
  | 'custom'
  | 'unit'
  | 'singular';

export interface DbtTest {
  id: string;
  type: TestType;
  column?: string;
  to?: string;
  config?: string;
  severity: 'error' | 'warn';
  passed?: boolean;
  kind?: 'generic' | 'singular' | 'unit';
  sql?: string;
  fixture?: string;
}

export interface DbtNode {
  id: string;
  name: string;
  path: string;
  layer: Layer;
  materialization: Materialization;
  refs: string[];
  sourceRefs: string[];
  tags: string[];
  tests: DbtTest[];
  status: NodeStatus;
  modified: boolean;
  hasRelation: boolean;
  sql?: string;
  incrementalStrategy?: IncrementalStrategy;
  uniqueKey?: string;
  contract?: boolean;
  declaredColumns?: string[];
  description?: string;
  owner?: string;
  snapshotStrategy?: 'timestamp' | 'check';
  updatedAt?: string;
}

export interface SourceNode {
  id: string;
  sourceName: string;
  tableName: string;
  loaded: boolean;
  description?: string;
  loadedAt?: string;
  freshnessWarnAfter?: string;
  freshnessErrorAfter?: string;
}

export interface MacroDef {
  name: string;
  body: string;
  args?: string[];
}

export interface ExposureDef {
  id: string;
  type: 'dashboard' | 'analysis' | 'ml' | 'application';
  dependsOn: string[];
  maturity: 'low' | 'medium' | 'high';
}

export interface LogLine {
  kind: 'cmd' | 'out' | 'err' | 'ok' | 'meta' | 'why';
  text: string;
}

export interface CiState {
  savedAt: string;
  builtIds: string[];
  modifiedIds: string[];
  graphHash: string;
}

export interface ProjectState {
  nodes: Record<string, DbtNode>;
  sources: Record<string, SourceNode>;
  macros: Record<string, MacroDef>;
  exposures: Record<string, ExposureDef>;
  packages: string[];
  vars: Record<string, string>;
  target: string;
  docsBuilt: boolean;
  commandCount: number;
  lastSelection: string[];
  logs: LogLine[];
  solved: boolean;
  commandsIssued: string[];
  ciState: CiState | null;
  incidentId?: string;
  diagnoses: string[];
}

export interface NodeSpec {
  id: string;
  layer: Layer;
  materialization?: Materialization;
  refs?: string[];
  sourceRefs?: string[];
  tags?: string[];
  path?: string;
  tests?: Omit<DbtTest, 'id' | 'passed'>[];
  modified?: boolean;
  hasRelation?: boolean;
  status?: NodeStatus;
  sql?: string;
  incrementalStrategy?: IncrementalStrategy;
  uniqueKey?: string;
  contract?: boolean;
  declaredColumns?: string[];
  description?: string;
  owner?: string;
  snapshotStrategy?: 'timestamp' | 'check';
  updatedAt?: string;
}

export interface SourceSpec {
  id: string;
  loaded?: boolean;
  description?: string;
  loadedAt?: string;
  freshnessWarnAfter?: string;
  freshnessErrorAfter?: string;
}

export interface ProjectSpec {
  nodes: NodeSpec[];
  sources?: SourceSpec[];
  macros?: MacroDef[];
  exposures?: ExposureDef[];
  packages?: string[];
  vars?: Record<string, string>;
  target?: string;
  ciState?: CiState;
  incidentId?: string;
}

export type GoalBuiltMode = 'exactly' | 'atLeast' | 'none';

export interface GoalSpec {
  built?: string[];
  builtMode?: GoalBuiltMode;
  testsPassed?: string[];
  notBuilt?: string[];
  materializations?: Record<string, Materialization>;
  refs?: Record<string, string[]>;
  mustRunCommand?: string;
  selectionIncludes?: string[];
  selectionEquals?: string[];
  modelsExist?: string[];
  testsDefined?: { model: string; type: TestType; column?: string }[];
  macrosDefined?: string[];
  packagesInstalled?: string[];
  docsBuilt?: boolean;
  snapshots?: string[];
  exposures?: string[];
  varsSet?: Record<string, string>;
  contracts?: string[];
  incrementalStrategies?: Record<string, IncrementalStrategy>;
  sqlContains?: Record<string, string>;
  /** At least N diagnosis notes recorded (incident drills). */
  minDiagnoses?: number;
  /** Required diagnosis keywords. */
  diagnosesInclude?: string[];
  /** CI artifact must exist. */
  ciSaved?: boolean;
  /** Macro must declare these args. */
  macroArgs?: Record<string, string[]>;
  /** Jinja constructs required in model sql. */
  sqlRequires?: Record<string, 'for' | 'if' | 'set' | 'macro'>;
}

export interface LevelDialogSlide {
  title: string;
  body: string;
}

export interface LevelDef {
  id: string;
  sequence: string;
  name: string;
  objective: string;
  hint: string;
  solution: string[];
  start: ProjectSpec;
  goal: GoalSpec;
  dialog?: LevelDialogSlide[];
  learning?: string[];
  fieldNotes?: string[];
  disabledCommands?: string[];
}
