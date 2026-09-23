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
  | 'snapshot';

export type NodeStatus = 'pending' | 'success' | 'error' | 'skipped';

export type TestType = 'unique' | 'not_null' | 'relationships' | 'accepted_values' | 'custom';

export interface DbtTest {
  id: string;
  type: TestType;
  /** Column the test runs on, if column-scoped. */
  column?: string;
  /** Upstream ref for relationships tests. */
  to?: string;
  severity: 'error' | 'warn';
  passed?: boolean;
}

export interface DbtNode {
  id: string;
  name: string;
  path: string;
  layer: Layer;
  materialization: Materialization;
  /** Upstream model ids referenced via ref(). */
  refs: string[];
  /** Upstream source ids referenced via source(). Format: `source.table`. */
  sourceRefs: string[];
  tags: string[];
  tests: DbtTest[];
  status: NodeStatus;
  /** True when this node was modified relative to production state. */
  modified: boolean;
  /** Incremental models remember whether they have a target relation. */
  hasRelation: boolean;
}

export interface SourceNode {
  id: string;
  sourceName: string;
  tableName: string;
  /** Whether the raw relation exists in the warehouse. */
  loaded: boolean;
}

export interface LogLine {
  kind: 'cmd' | 'out' | 'err' | 'ok' | 'meta';
  text: string;
}

export interface ProjectState {
  nodes: Record<string, DbtNode>;
  sources: Record<string, SourceNode>;
  target: string;
  commandCount: number;
  lastSelection: string[];
  logs: LogLine[];
  /** Set when the level's goal is satisfied. */
  solved: boolean;
  /** Raw terminal lines issued this session (for command-based goals). */
  commandsIssued: string[];
}

/** Compact node definition used by levels and sandbox seeds. */
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
  /** Initial runtime status (e.g. already built in prod). */
  status?: NodeStatus;
}

export interface SourceSpec {
  id: string;
  loaded?: boolean;
}

export interface ProjectSpec {
  nodes: NodeSpec[];
  sources?: SourceSpec[];
  target?: string;
}

export type GoalBuiltMode = 'exactly' | 'atLeast' | 'none';

export interface GoalSpec {
  /** Models that must be successfully built. */
  built?: string[];
  builtMode?: GoalBuiltMode;
  /** If set, all listed tests must pass (ids or `model.column:type`). */
  testsPassed?: string[];
  /** If set, these model ids must not be built. */
  notBuilt?: string[];
  /** Structural requirement: materialization map that must hold. */
  materializations?: Record<string, Materialization>;
  /** Structural requirement: required refs for a model. */
  refs?: Record<string, string[]>;
  /** At least one issued command must contain this substring. */
  mustRunCommand?: string;
  /** Every id must appear in the last selection. */
  selectionIncludes?: string[];
  /** Last selection must equal this set (order-insensitive). */
  selectionEquals?: string[];
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
  /** Par = number of commands in the canonical solution. */
  solution: string[];
  start: ProjectSpec;
  goal: GoalSpec;
  dialog?: LevelDialogSlide[];
  /** What the learner should understand after this level (bullet strings). */
  learning?: string[];
  /** Production / interview notes shown in the guide panel. */
  fieldNotes?: string[];
  /** Meta-commands that do not count toward golf. */
  disabledCommands?: string[];
}
