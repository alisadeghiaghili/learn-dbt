import type {
  DbtNode,
  DbtTest,
  LogLine,
  NodeSpec,
  ProjectSpec,
  ProjectState,
  SourceNode,
} from './types';

function defaultPath(layer: string, id: string): string {
  if (layer === 'source') return `models/sources/${id}`;
  if (layer === 'seed') return `seeds/${id}.csv`;
  if (layer === 'staging') return `models/staging/${id}.sql`;
  if (layer === 'intermediate') return `models/intermediate/${id}.sql`;
  if (layer === 'mart') return `models/marts/${id}.sql`;
  if (layer === 'snapshot') return `snapshots/${id}.sql`;
  return `models/${id}.sql`;
}

function materializeDefault(spec: NodeSpec): DbtNode['materialization'] {
  if (spec.materialization) return spec.materialization;
  if (spec.layer === 'source') return 'source';
  if (spec.layer === 'seed') return 'seed';
  if (spec.layer === 'snapshot') return 'snapshot';
  return 'view';
}

/**
 * Materialize a ProjectSpec into an in-memory ProjectState.
 *
 * Args:
 *   spec: Compact level/sandbox project definition.
 * Returns:
 *   Fresh project state with all nodes pending.
 */
export function createProject(spec: ProjectSpec): ProjectState {
  const nodes: Record<string, DbtNode> = {};
  const sources: Record<string, SourceNode> = {};

  for (const s of spec.sources ?? []) {
    const [sourceName, tableName] = splitSourceId(s.id);
    sources[s.id] = {
      id: s.id,
      sourceName,
      tableName,
      loaded: s.loaded ?? true,
    };
  }

  for (const n of spec.nodes) {
    const tests: DbtTest[] = (n.tests ?? []).map((t, i) => ({
      id: `${n.id}.${t.column ?? t.type}${i > 0 ? `.${i}` : ''}`,
      type: t.type,
      column: t.column,
      to: t.to,
      severity: t.severity ?? 'error',
      passed: undefined,
    }));
    nodes[n.id] = {
      id: n.id,
      name: n.id,
      path: n.path ?? defaultPath(n.layer, n.id),
      layer: n.layer,
      materialization: materializeDefault(n),
      refs: [...(n.refs ?? [])],
      sourceRefs: [...(n.sourceRefs ?? [])],
      tags: [...(n.tags ?? [])],
      tests,
      status: n.status ?? 'pending',
      modified: n.modified ?? false,
      hasRelation: n.hasRelation ?? (n.status === 'success'),
      sql: n.sql,
      incrementalStrategy: n.incrementalStrategy,
      uniqueKey: n.uniqueKey,
      contract: n.contract,
      declaredColumns: n.declaredColumns,
      description: n.description,
      owner: n.owner,
      snapshotStrategy: n.snapshotStrategy,
      updatedAt: n.updatedAt,
    };
  }

  return {
    nodes,
    sources,
    macros: Object.fromEntries((spec.macros ?? []).map((m) => [m.name, m])),
    exposures: Object.fromEntries((spec.exposures ?? []).map((e) => [e.id, e])),
    packages: [...(spec.packages ?? [])],
    vars: { ...(spec.vars ?? {}) },
    target: spec.target ?? 'dev',
    docsBuilt: false,
    commandCount: 0,
    lastSelection: [],
    logs: [],
    solved: false,
    commandsIssued: [],
    ciState: spec.ciState ?? null,
    incidentId: spec.incidentId,
    diagnoses: [],
  };
}

function splitSourceId(id: string): [string, string] {
  const idx = id.indexOf('.');
  if (idx === -1) return [id, id];
  return [id.slice(0, idx), id.slice(idx + 1)];
}

/**
 * Deep-clone a project state (for undo snapshots).
 *
 * Args:
 *   project: State to clone.
 * Returns:
 *   Structurally equal copy.
 */
export function cloneProject(project: ProjectState): ProjectState {
  return structuredClone(project);
}

/**
 * Append log lines.
 *
 * Args:
 *   project: Mutated in place via returned copy pattern at call sites.
 *   lines: Lines to append.
 * Returns:
 *   New logs array.
 */
export function appendLogs(project: ProjectState, lines: LogLine[]): LogLine[] {
  return [...project.logs, ...lines].slice(-200);
}

/**
 * Reset runtime build status without forgetting the graph structure.
 *
 * Args:
 *   project: Project state.
 * Returns:
 *   New project with nodes pending and tests undefined.
 */
export function resetBuildStatus(project: ProjectState): ProjectState {
  const next = cloneProject(project);
  for (const node of Object.values(next.nodes)) {
    node.status = 'pending';
    node.hasRelation = node.materialization === 'seed' || node.materialization === 'source';
    for (const t of node.tests) t.passed = undefined;
  }
  next.commandCount = 0;
  next.lastSelection = [];
  next.solved = false;
  next.logs = [];
  next.commandsIssued = [];
  return next;
}

/**
 * Rebuild project from a level's start spec (full reset for levels).
 *
 * Args:
 *   spec: Level start project.
 * Returns:
 *   Fresh state.
 */
export function restartFromSpec(spec: ProjectSpec): ProjectState {
  return createProject(spec);
}
