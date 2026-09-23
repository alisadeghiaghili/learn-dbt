import { appendLogs, cloneProject } from './project';
import { buildGraph, topoSort } from './graph';
import { parseSelectionArgs, resolveSelection } from './selection';
import type { GoalSpec, LogLine, ProjectState } from './types';
import { evaluateGoal } from './compare';
import {
  addTest,
  buildDocs,
  defineExposure,
  defineMacro,
  editModelSql,
  installPackage,
  newModel,
  setConfig,
  setVar,
  useTarget,
} from './mutate';
import { compileSql } from './sql';

export interface CommandResult {
  project: ProjectState;
  logs: LogLine[];
  /** True when the command should count toward level golf. */
  counts: boolean;
  error?: string;
}

function log(kind: LogLine['kind'], text: string): LogLine {
  return { kind, text };
}

function tokenize(input: string): string[] {
  return input.trim().split(/\s+/).filter(Boolean);
}

function depReady(project: ProjectState, depId: string): boolean {
  const src = project.sources[depId];
  if (src) return src.loaded;
  const node = project.nodes[depId];
  if (!node) return false;
  if (node.materialization === 'ephemeral') return node.status === 'success';
  return node.status === 'success';
}

function runOne(project: ProjectState, nodeId: string, fullRefresh: boolean): LogLine[] {
  const logs: LogLine[] = [];
  const src = project.sources[nodeId];
  if (src) {
    logs.push(log('out', `source ${src.id} ${src.loaded ? 'ok (already present)' : 'MISSING'}`));
    return logs;
  }

  const node = project.nodes[nodeId];
  if (!node) {
    logs.push(log('err', `node not found: ${nodeId}`));
    return logs;
  }

  const deps = [...node.refs, ...node.sourceRefs];
  const missing = deps.filter((d) => !depReady(project, d));
  if (missing.length) {
    node.status = 'error';
    logs.push(log('err', `ERROR ${node.id}: missing upstream [${missing.join(', ')}]`));
    return logs;
  }

  if (node.materialization === 'ephemeral') {
    node.status = 'success';
    logs.push(log('out', `ephemeral ${node.id} compiled inline (no relation)`));
    return logs;
  }

  if (node.materialization === 'incremental' && node.hasRelation && !fullRefresh) {
    node.status = 'success';
    logs.push(log('ok', `INCREMENTAL ${node.id} updated existing relation`));
    return logs;
  }

  node.status = 'success';
  node.hasRelation = true;
  logs.push(log('ok', `OK ${node.materialization} ${node.id}`));
  return logs;
}

function testOne(project: ProjectState, nodeId: string): LogLine[] {
  const logs: LogLine[] = [];
  const node = project.nodes[nodeId];
  if (!node) {
    logs.push(log('err', `node not found: ${nodeId}`));
    return logs;
  }
  if (node.status !== 'success') {
    logs.push(log('err', `SKIP tests ${node.id}: model not built`));
    return logs;
  }
  if (!node.tests.length) {
    logs.push(log('out', `tests ${node.id}: none defined`));
    return logs;
  }

  for (const t of node.tests) {
    t.passed = true;
    logs.push(log('ok', `PASS ${t.type} ${t.id}`));
  }
  return logs;
}

/**
 * Execute a terminal line against the project.
 *
 * Args:
 *   raw: Full command string.
 *   project: Current project state.
 *   levelGoal: Optional level goal (evaluated after dbt commands).
 * Returns:
 *   CommandResult with updated project and logs.
 */
export function executeCommand(
  raw: string,
  project: ProjectState,
  levelGoal?: GoalSpec,
): CommandResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { project, logs: [], counts: false };
  }

  const tokens = tokenize(trimmed);
  const head = tokens[0];

  if (head === 'help' || head === '?') {
    return complete(project, [log('meta', helpText())], { counts: false });
  }
  if (head === 'clear') {
    return complete({ ...cloneProject(project), logs: [] }, [], { counts: false });
  }

  // ----- authoring commands (not prefixed with dbt) -----
  if (
    head === 'new' ||
    head === 'edit' ||
    head === 'add' ||
    head === 'set' ||
    head === 'macro' ||
    head === 'deps' ||
    head === 'var' ||
    head === 'target' ||
    head === 'exposure'
  ) {
    return authoringCommand(trimmed, project, levelGoal);
  }

  if (head !== 'dbt') {
    return complete(
      project,
      [log('err', `unknown command: ${head}. Try 'dbt run', 'dbt build', 'dbt ls', or 'help'.`)],
      { counts: false, error: `Unknown command: ${head}` },
    );
  }

  const sub = tokens[1];
  const rest = tokens.slice(2);
  const { select, exclude } = parseSelectionArgs(rest);
  const fullRefresh = rest.includes('--full-refresh');

  const next = cloneProject(project);
  const logs: LogLine[] = [log('cmd', trimmed)];
  next.commandsIssued = [...next.commandsIssued, trimmed];

  if (sub === 'docs' && rest[0] === 'generate') {
    const r = buildDocs(next);
    logs.push(...r.logs);
    return complete(r.project, logs, { counts: true, levelGoal });
  }
  if (sub === 'deps') {
    const pkg = rest[0];
    if (!pkg) {
      logs.push(log('err', 'usage: dbt deps <package>'));
      return complete(next, logs, { counts: false });
    }
    const r = installPackage(next, pkg);
    logs.push(...r.logs);
    return complete(r.project, logs, { counts: true, levelGoal });
  }
  if (sub === 'compile') {
    const usingSelect = select.length > 0 || exclude.length > 0;
    const ids = usingSelect
      ? resolveSelection(select, exclude, next)
      : Object.keys(next.nodes).sort();
    const modelIds = ids.filter((id) => next.nodes[id]);
    for (const id of modelIds) {
      const n = next.nodes[id]!;
      const compiled = compileSql(n.sql ?? '', next.vars, next.target);
      logs.push(log('out', `compiled ${id}\n${compiled}`));
    }
    next.lastSelection = modelIds;
    return complete(next, logs, { counts: true, levelGoal });
  }

  switch (sub) {
    case 'ls':
    case 'list': {
      const ids =
        select.length || exclude.length
          ? resolveSelection(select, exclude, next)
          : Object.keys(next.nodes).sort();
      for (const id of ids) {
        const n = next.nodes[id];
        const src = next.sources[id];
        if (src) logs.push(log('out', `source:${src.id}`));
        else if (n) logs.push(log('out', `${n.path}  [${n.materialization}]  ${n.id}`));
      }
      if (!ids.length) logs.push(log('out', 'no nodes matched'));
      next.lastSelection = ids;
      return complete(next, logs, { counts: true, levelGoal });
    }

    case 'run': {
      const usingSelect = select.length > 0 || exclude.length > 0;
      const ids = usingSelect
        ? resolveSelection(select, exclude, next)
        : Object.keys(next.nodes).sort();
      const modelIds = ids.filter((id) => next.nodes[id]);
      next.lastSelection = usingSelect ? ids : Object.keys(next.nodes).sort();
      if (usingSelect) {
        logs.push(log('meta', `selection (${ids.length}): ${ids.join(', ') || '(empty)'}`));
      }
      const order = safeTopo(modelIds, buildGraph(next).parents, logs);
      for (const id of order) {
        logs.push(...runOne(next, id, fullRefresh));
      }
      return complete(next, logs, { counts: true, levelGoal });
    }

    case 'build': {
      const usingSelect = select.length > 0 || exclude.length > 0;
      const ids = usingSelect
        ? resolveSelection(select, exclude, next)
        : Object.keys(next.nodes).sort();
      const modelIds = ids.filter((id) => next.nodes[id]);
      next.lastSelection = usingSelect ? ids : Object.keys(next.nodes).sort();
      logs.push(
        log('meta', `build selection (${modelIds.length}): ${modelIds.join(', ') || '(empty)'}`),
      );
      const order = safeTopo(modelIds, buildGraph(next).parents, logs);
      for (const id of order) {
        logs.push(...runOne(next, id, fullRefresh));
        const node = next.nodes[id];
        if (node && node.status === 'success') {
          logs.push(...testOne(next, id));
        }
      }
      return complete(next, logs, { counts: true, levelGoal });
    }

    case 'test': {
      const usingSelect = select.length > 0 || exclude.length > 0;
      const ids = usingSelect
        ? resolveSelection(select, exclude, next)
        : Object.keys(next.nodes).sort();
      const modelIds = ids.filter((id) => next.nodes[id]);
      next.lastSelection = modelIds;
      logs.push(
        log('meta', `test selection (${modelIds.length}): ${modelIds.join(', ') || '(empty)'}`),
      );
      const order = safeTopo(modelIds, buildGraph(next).parents, logs);
      for (const id of order) {
        logs.push(...testOne(next, id));
      }
      return complete(next, logs, { counts: true, levelGoal });
    }

    case 'seed': {
      const targets = select.length || exclude.length
        ? resolveSelection(select, exclude, next).filter(
            (id) => next.nodes[id]?.materialization === 'seed',
          )
        : Object.values(next.nodes)
            .filter((n) => n.materialization === 'seed')
            .map((n) => n.id);
      for (const id of targets) {
        const node = next.nodes[id];
        if (!node) continue;
        node.status = 'success';
        node.hasRelation = true;
        logs.push(log('ok', `OK seed ${id}`));
      }
      next.lastSelection = targets;
      return complete(next, logs, { counts: true, levelGoal });
    }

    case 'snapshot': {
      const snaps = Object.values(next.nodes).filter((n) => n.materialization === 'snapshot');
      const targets = select.length
        ? resolveSelection(select, exclude, next).filter((id) => next.nodes[id]?.materialization === 'snapshot')
        : snaps.map((n) => n.id);
      for (const id of targets) {
        const node = next.nodes[id];
        if (!node) continue;
        node.status = 'success';
        node.hasRelation = true;
        logs.push(log('ok', `OK snapshot ${id} (${node.snapshotStrategy ?? 'timestamp'})`));
      }
      next.lastSelection = targets;
      return complete(next, logs, { counts: true, levelGoal });
    }

    case 'source': {
      if (rest[0] === 'freshness') {
        for (const s of Object.values(next.sources)) {
          logs.push(
            log(s.loaded ? 'ok' : 'err', `source ${s.id}: ${s.loaded ? 'fresh' : 'stale / missing'}`),
          );
        }
        return complete(next, logs, { counts: true, levelGoal });
      }
      logs.push(log('err', 'usage: dbt source freshness'));
      return complete(next, logs, { counts: false });
    }

    default: {
      logs.push(log('err', `unsupported dbt subcommand: ${sub ?? '(none)'}`));
      return complete(next, logs, {
        counts: false,
        error: `Unsupported subcommand: ${sub}`,
      });
    }
  }
}

function splitNamedArgs(tokens: string[], raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of tokens) {
    const eq = t.indexOf('=');
    if (eq > 0) {
      const k = t.slice(0, eq);
      if (k === 'sql') continue; // handled from raw
      map.set(k, t.slice(eq + 1));
    }
  }
  const m = raw.match(/\bsql=(.+)$/);
  if (m) map.set('sql', m[1]!.trim());
  return map;
}

/** Authoring verbs used by curriculum levels (model writing, tests, macros…). */
function authoringCommand(
  trimmed: string,
  project: ProjectState,
  levelGoal?: GoalSpec,
): CommandResult {
  const logs: LogLine[] = [log('cmd', trimmed)];
  const tokens = tokenize(trimmed);
  const head = tokens[0]!;
  let next = cloneProject(project);
  next.commandsIssued = [...next.commandsIssued, trimmed];

  if (head === 'new') {
    if (tokens[1] === 'model' && tokens[2]) {
      const id = tokens[2]!;
      const map = splitNamedArgs(tokens.slice(3), trimmed);
      const opts: Parameters<typeof newModel>[2] = {
        sql: map.get('sql') ?? 'select 1 as id',
      };
      if (map.has('layer')) opts.layer = map.get('layer') as never;
      if (map.has('mat')) opts.materialization = map.get('mat') as never;
      const r = newModel(next, id, opts);
      logs.push(...r.logs);
      return complete(r.project, logs, { counts: true, levelGoal });
    }
    if (tokens[1] === 'snapshot' && tokens[2]) {
      const id = tokens[2]!;
      const r = newModel(next, id, {
        layer: 'snapshot',
        materialization: 'snapshot',
        sql: "select * from {{ ref('src') }}",
      });
      logs.push(...r.logs);
      if (r.ok) {
        r.project.nodes[id]!.snapshotStrategy = tokens.includes('strategy=check')
          ? 'check'
          : 'timestamp';
      }
      return complete(r.project, logs, { counts: true, levelGoal });
    }
    if (tokens[1] === 'seed' && tokens[2]) {
      const r = newModel(next, tokens[2]!, { layer: 'seed', materialization: 'seed' });
      logs.push(...r.logs);
      return complete(r.project, logs, { counts: true, levelGoal });
    }
  }

  if (head === 'edit' && tokens[1] === 'model' && tokens[2]) {
    const id = tokens[2]!;
    const map = splitNamedArgs(tokens.slice(3), trimmed);
    let sql = map.get('sql');
    if (!sql && (map.has('ref') || map.has('source'))) {
      const refs = (map.get('ref') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const srcs = (map.get('source') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      sql = [
        'select * from',
        ...refs.map((r) => `{{ ref('${r}') }}`),
        ...srcs.map((s) => `{{ source('${s.split('.')[0]}', '${s.split('.')[1] ?? ''}') }}`),
      ].join(' ');
    }
    if (!sql) {
      logs.push(log('err', 'edit model needs sql= or ref=/source='));
      return complete(next, logs, { counts: false });
    }
    const r = editModelSql(next, id, sql.replace(/;/g, ' '));
    logs.push(...r.logs);
    next = r.project;
    if (map.has('mat') || map.has('strategy') || map.has('unique')) {
      const c = setConfig(next, id, {
        materialization: map.get('mat') as never,
        incrementalStrategy: map.get('strategy') as never,
        uniqueKey: map.get('unique'),
      });
      logs.push(...c.logs);
      next = c.project;
    }
    return complete(next, logs, { counts: true, levelGoal });
  }

  if (head === 'add' && tokens[1] === 'test' && tokens[2]) {
    const type = tokens[2] as never;
    const model = tokens[3];
    if (!model) {
      logs.push(log('err', 'add test <type> <model> …'));
      return complete(next, logs, { counts: false });
    }
    const map = splitNamedArgs(tokens.slice(4), trimmed);
    const r = addTest(next, model, type, {
      column: map.get('col'),
      to: map.get('to'),
      config: map.get('config'),
      severity: map.get('severity') as never,
    });
    logs.push(...r.logs);
    return complete(r.project, logs, { counts: true, levelGoal });
  }

  if (head === 'set' && tokens[1] === 'config' && tokens[2]) {
    const id = tokens[2]!;
    const map = splitNamedArgs(tokens.slice(3), trimmed);
    const r = setConfig(next, id, {
      materialization: map.get('mat') as never,
      incrementalStrategy: map.get('strategy') as never,
      uniqueKey: map.get('unique'),
      tags: map.get('tags')?.split(','),
      contract: map.get('contract') === 'true',
      declaredColumns: map.get('cols')?.split(','),
      owner: map.get('owner'),
      description: map.get('desc'),
    });
    logs.push(...r.logs);
    return complete(r.project, logs, { counts: true, levelGoal });
  }

  if (head === 'macro' && tokens[1] === 'add' && tokens[2]) {
    const body = trimmed.replace(/^macro\s+add\s+\S+\s*/i, '');
    const r = defineMacro(next, tokens[2]!, body || 'select 1');
    logs.push(...r.logs);
    return complete(r.project, logs, { counts: true, levelGoal });
  }

  if (head === 'exposure' && tokens[1] === 'add' && tokens[2]) {
    const id = tokens[2]!;
    const map = splitNamedArgs(tokens.slice(3), trimmed);
    const r = defineExposure(
      next,
      id,
      (map.get('type') as never) ?? 'dashboard',
      (map.get('ref') ?? '').split(',').filter(Boolean),
    );
    logs.push(...r.logs);
    return complete(r.project, logs, { counts: true, levelGoal });
  }

  if (head === 'deps' && tokens[1]) {
    const r = installPackage(next, tokens[1]!);
    logs.push(...r.logs);
    return complete(r.project, logs, { counts: true, levelGoal });
  }

  if (head === 'var' && tokens[1]) {
    const [k, v] = tokens[1]!.split('=');
    if (!k) {
      logs.push(log('err', 'usage: var key=value'));
      return complete(next, logs, { counts: false });
    }
    const r = setVar(next, k, v ?? '');
    logs.push(...r.logs);
    return complete(r.project, logs, { counts: true, levelGoal });
  }

  if (head === 'target' && tokens[1] === 'use' && tokens[2]) {
    const r = useTarget(next, tokens[2]!);
    logs.push(...r.logs);
    return complete(r.project, logs, { counts: true, levelGoal });
  }

  logs.push(log('err', `unsupported authoring command: ${trimmed}`));
  return complete(next, logs, { counts: false });
}

function safeTopo(ids: string[], parents: Map<string, string[]>, logs: LogLine[]): string[] {
  try {
    return topoSort(ids, parents);
  } catch (err) {
    logs.push(log('err', err instanceof Error ? err.message : String(err)));
    return [];
  }
}

function complete(
  project: ProjectState,
  logs: LogLine[],
  opts: { counts: boolean; levelGoal?: GoalSpec; error?: string },
): CommandResult {
  const next = cloneProject(project);
  next.logs = appendLogs(next, logs);
  if (opts.counts) next.commandCount += 1;
  if (opts.levelGoal) {
    const goal = evaluateGoal(next, opts.levelGoal);
    next.solved = goal.solved;
    if (goal.solved) {
      logs.push(log('meta', 'level solved'));
      next.logs = appendLogs(project, [...logs]);
    } else if (goal.reasons.length && opts.counts) {
      const brief = goal.reasons.slice(0, 3).join(' | ');
      logs.push(log('out', `goal: ${brief}`));
      next.logs = appendLogs(project, [...logs]);
    }
  }
  return { project: next, logs, counts: opts.counts, error: opts.error };
}

function helpText(): string {
  return [
    'dbt commands',
    '  dbt ls | run | build | test | seed | snapshot | compile | docs generate',
    '  dbt deps <pkg> | source freshness',
    '',
    'selection',
    '  model | +model | model+ | +model+ | @model',
    '  path: | tag: | source: | status:modified | --exclude',
    '',
    'authoring',
    '  new model <id> layer=… mat=… sql=…',
    '  edit model <id> ref=a,b source=s.t mat=… strategy=… sql=…',
    '  add test unique|not_null|relationships|accepted_values <model> col=…',
    '  set config <id> mat=… strategy=… contract=true cols=a,b',
    '  macro add <name> … | deps <pkg> | var k=v | target use prod',
    '  exposure add <id> type=dashboard ref=mart_a',
    '',
    'level meta',
    '  help | hint | levels | steps | why | show goal | hide goal | show solution | reset | undo',
  ].join('\n');
}
