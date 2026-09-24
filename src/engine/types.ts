/**
 * Core domain types for the learn-dbt simulator.
 */

export type Row = Record<string, string | number | null>;

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

export type Warehouse = 'bq' | 'snowflake' | 'redshift' | 'postgres' | 'duckdb';

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
  snapshotConfig?: string;
  updatedAt?: string;
  /** BigQuery style clustering/partitioning (and Snowflake equivalents). */
  partitionBy?: string;
  clusterBy?: string;
  warehouse?: Warehouse;
  corruption?: 'dup_key' | 'null_key' | 'orphan_fk' | 'bad_enum' | 'clean';
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
  /** macros/ file path for multi-file packages. */
  file?: string;
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

export interface RubricItem {
  id: string;
  label: string;
  points: number;
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
  /** Active warehouse dialect for strategy guidance. */
  warehouse: Warehouse;
  /** Timed exam: deadline epoch ms. */
  deadlineAt?: number;
  /** Design drills: created model id set this attempt. */
  designedModels: string[];
  /** Materialized row fixtures per node id (for data-level tests). */
  modelRows?: Record<string, Row[]>;
  /** Count of correct quiz answers this session/project. */
  quizCorrect: number;
  /** Transfers: structural score 0-100 for design levels. */
  transferScore?: number;
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
  snapshotConfig?: string;
  updatedAt?: string;
  partitionBy?: string;
  clusterBy?: string;
  warehouse?: Warehouse;
  /** Data corruption seed for incident fixtures. */
  corruption?: 'dup_key' | 'null_key' | 'orphan_fk' | 'bad_enum' | 'clean';
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
  warehouse?: Warehouse;
  ciState?: CiState;
  incidentId?: string;
  deadlineSeconds?: number;
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
  minDiagnoses?: number;
  /** Minimum correct quiz answers recorded. */
  quizCorrect?: number;
  /** Minimum audit errors remaining (usually 0). */
  maxAuditErrors?: number;
  /** Transfer: all declared columns must appear in sql. */
  sqlColumns?: Record<string, string[]>;
  /** Minimum transfer structure score. */
  minTransferScore?: number;
  diagnosesInclude?: string[];
  ciSaved?: boolean;
  macroArgs?: Record<string, string[]>;
  sqlRequires?: Record<string, 'for' | 'if' | 'set' | 'macro'>;
  /** Warehouse physical design. */
  partitionBy?: Record<string, string>;
  clusterBy?: Record<string, string>;
  warehouseIs?: Warehouse;
  /** Macro written to macros/<file>. */
  macroFiles?: Record<string, string>;
  snapshotConfigs?: Record<string, string>;
  /** Design drills: at least N models created in layer X. */
  designLayers?: Partial<Record<Layer, number>>;
  /** Graded rubric items (each must be satisfied — mapped loosely via other fields). */
  rubric?: RubricItem[];
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
  /** Timed exam (seconds). */
  timeLimitSec?: number;
  rubric?: RubricItem[];
}
