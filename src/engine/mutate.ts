import { cloneProject } from './project';
import { parseSql } from './sql';
import { wouldCreateCycle } from './graph';
import type {
  ExposureDef,
  IncrementalStrategy,
  Layer,
  LogLine,
  MacroDef,
  Materialization,
  ProjectState,
  TestType,
} from './types';

function log(kind: LogLine['kind'], text: string): LogLine {
  return { kind, text };
}

function defaultPath(layer: Layer, id: string): string {
  if (layer === 'seed') return `seeds/${id}.csv`;
  if (layer === 'snapshot') return `snapshots/${id}.sql`;
  if (layer === 'staging') return `models/staging/${id}.sql`;
  if (layer === 'intermediate') return `models/intermediate/${id}.sql`;
  if (layer === 'mart') return `models/marts/${id}.sql`;
  return `models/${id}.sql`;
}

/**
 * Create a new model node with optional SQL body.
 */
export function newModel(
  project: ProjectState,
  id: string,
  opts: {
    layer?: Layer;
    materialization?: Materialization;
    sql?: string;
    tags?: string[];
  } = {},
): { project: ProjectState; logs: LogLine[]; ok: boolean } {
  const logs: LogLine[] = [];
  if (project.nodes[id]) {
    return { project, logs: [log('err', `model exists: ${id}`)], ok: false };
  }
  const next = cloneProject(project);
  const layer = opts.layer ?? 'staging';
  const parsed = opts.sql ? parseSql(opts.sql) : null;
  next.nodes[id] = {
    id,
    name: id,
    path: defaultPath(layer, id),
    layer,
    materialization: opts.materialization ?? 'view',
    refs: parsed?.refs ?? [],
    sourceRefs: parsed?.sourceRefs ?? [],
    tags: opts.tags ?? [],
    tests: [],
    status: 'pending',
    modified: true,
    hasRelation: false,
    sql: opts.sql ?? 'select 1 as id',
  };
  logs.push(log('ok', `created model ${id} [${layer}/${next.nodes[id].materialization}]`));
  return { project: next, logs, ok: true };
}

/**
 * Replace model SQL and re-derive lineage from ref()/source().
 */
export function editModelSql(
  project: ProjectState,
  id: string,
  sql: string,
): { project: ProjectState; logs: LogLine[]; ok: boolean } {
  const logs: LogLine[] = [];
  const node = project.nodes[id];
  if (!node) return { project, logs: [log('err', `model not found: ${id}`)], ok: false };

  const parsed = parseSql(sql);
  const unknownRefs = parsed.refs.filter((r) => !project.nodes[r] && !project.sources[r]);
  const unknownSrc = parsed.sourceRefs.filter((s) => !project.sources[s]);
  if (unknownRefs.length) {
    logs.push(log('err', `compile error: unknown ref(s) ${unknownRefs.join(', ')}`));
  }
  if (unknownSrc.length) {
    logs.push(log('err', `compile error: unknown source(s) ${unknownSrc.join(', ')}`));
  }

  const next = cloneProject(project);
  const n = next.nodes[id]!;
  if (wouldCreateCycle(next, id, parsed.refs)) {
    logs.push(log('err', `would create a circular dependency — ref rejected`));
    return { project, logs, ok: false };
  }
  n.sql = sql;
  n.refs = parsed.refs;
  n.sourceRefs = parsed.sourceRefs;
  n.modified = true;
  n.status = 'pending';
  logs.push(log('ok', `updated ${id} sql (refs: ${n.refs.join(', ') || 'none'})`));
  return { project: next, logs, ok: !unknownRefs.length && !unknownSrc.length };
}

/**
 * Attach a generic or unit-style test to a model.
 */
export function addTest(
  project: ProjectState,
  modelId: string,
  type: TestType,
  opts: { column?: string; to?: string; config?: string; severity?: 'error' | 'warn' } = {},
): { project: ProjectState; logs: LogLine[]; ok: boolean } {
  const logs: LogLine[] = [];
  const node = project.nodes[modelId];
  if (!node) return { project, logs: [log('err', `model not found: ${modelId}`)], ok: false };

  const next = cloneProject(project);
  const n = next.nodes[modelId]!;
  const id = `${modelId}.${opts.column ?? type}.${n.tests.length}`;
  n.tests.push({
    id,
    type,
    column: opts.column,
    to: opts.to,
    config: opts.config,
    severity: opts.severity ?? 'error',
    kind: type === 'custom' ? 'singular' : 'generic',
    passed: undefined,
  });
  n.modified = true;
  logs.push(log('ok', `added test ${type}${opts.column ? ` on ${opts.column}` : ''} → ${modelId}`));
  return { project: next, logs, ok: true };
}

export function setConfig(
  project: ProjectState,
  id: string,
  opts: {
    materialization?: Materialization;
    incrementalStrategy?: IncrementalStrategy;
    uniqueKey?: string;
    tags?: string[];
    contract?: boolean;
    declaredColumns?: string[];
    owner?: string;
    description?: string;
  },
): { project: ProjectState; logs: LogLine[]; ok: boolean } {
  const logs: LogLine[] = [];
  if (!project.nodes[id]) return { project, logs: [log('err', `model not found: ${id}`)], ok: false };
  const next = cloneProject(project);
  const n = next.nodes[id]!;
  if (opts.materialization) n.materialization = opts.materialization;
  if (opts.incrementalStrategy) n.incrementalStrategy = opts.incrementalStrategy;
  if (opts.uniqueKey) n.uniqueKey = opts.uniqueKey;
  if (opts.tags) n.tags = [...new Set([...n.tags, ...opts.tags])];
  if (opts.contract !== undefined) n.contract = opts.contract;
  if (opts.declaredColumns) n.declaredColumns = opts.declaredColumns;
  if (opts.owner) n.owner = opts.owner;
  if (opts.description) n.description = opts.description;
  n.modified = true;
  logs.push(log('ok', `configured ${id}`, ));
  return { project: next, logs, ok: true };
}

export function defineMacro(
  project: ProjectState,
  name: string,
  body: string,
): { project: ProjectState; logs: LogLine[] } {
  const next = cloneProject(project);
  const macro: MacroDef = { name, body };
  next.macros[name] = macro;
  return { project: next, logs: [log('ok', `defined macro ${name}`)] };
}

export function installPackage(
  project: ProjectState,
  pkg: string,
): { project: ProjectState; logs: LogLine[] } {
  const next = cloneProject(project);
  if (!next.packages.includes(pkg)) next.packages.push(pkg);
  return { project: next, logs: [log('ok', `installed package ${pkg}`)] };
}

export function setVar(
  project: ProjectState,
  key: string,
  value: string,
): { project: ProjectState; logs: LogLine[] } {
  const next = cloneProject(project);
  next.vars = { ...next.vars, [key]: value };
  return { project: next, logs: [log('ok', `var ${key}=${value}`)] };
}

export function useTarget(
  project: ProjectState,
  target: string,
): { project: ProjectState; logs: LogLine[] } {
  const next = cloneProject(project);
  next.target = target;
  return { project: next, logs: [log('ok', `target → ${target}`)] };
}

export function defineExposure(
  project: ProjectState,
  id: string,
  type: ExposureDef['type'],
  dependsOn: string[],
): { project: ProjectState; logs: LogLine[] } {
  const next = cloneProject(project);
  next.exposures[id] = { id, type, dependsOn, maturity: 'medium' };
  return { project: next, logs: [log('ok', `exposure ${id} (${type}) → ${dependsOn.join(', ')}`)] };
}

export function buildDocs(
  project: ProjectState,
): { project: ProjectState; logs: LogLine[] } {
  const next = cloneProject(project);
  next.docsBuilt = true;
  const missing = Object.values(next.nodes).filter((n) => !n.description);
  const logs: LogLine[] = [
    log('ok', 'docs generated'),
    log(
      'out',
      missing.length
        ? `${missing.length} model(s) still lack descriptions`
        : 'all models have descriptions',
    ),
  ];
  return { project: next, logs };
}
