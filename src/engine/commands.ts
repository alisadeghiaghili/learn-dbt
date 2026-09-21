import { appendLogs, cloneProject } from './project';
import { buildGraph, topoSort } from './graph';
import { parseSelectionArgs, resolveSelection } from './selection';
import type { GoalSpec, LogLine, ProjectState } from './types';
import { evaluateGoal } from './compare';

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
        logs.push(
          log('meta', `selection (${ids.length}): ${ids.join(', ') || '(empty)'}`),
        );
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

    case 'compile': {
      const usingSelect = select.length > 0 || exclude.length > 0;
      const ids = usingSelect
        ? resolveSelection(select, exclude, next)
        : Object.keys(next.nodes).sort();
      const modelIds = ids.filter((id) => next.nodes[id]);
      for (const id of modelIds) logs.push(log('out', `compiled ${id}`));
      next.lastSelection = modelIds;
      return complete(next, logs, { counts: true, levelGoal });
    }

    case 'source': {
      if (rest[0] === 'freshness') {
        for (const s of Object.values(next.sources)) {
          logs.push(
            log(
              s.loaded ? 'ok' : 'err',
              `source ${s.id}: ${s.loaded ? 'fresh' : 'stale / missing'}`,
            ),
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
    '  dbt ls [--select SEL]              list nodes in selection',
    '  dbt run [--select SEL] [--full-refresh]',
    '  dbt build [--select SEL]           run + test in dependency order',
    '  dbt test [--select SEL]',
    '  dbt seed',
    '  dbt compile [--select SEL]',
    '  dbt source freshness',
    '',
    'selection',
    '  model | +model | model+ | +model+ | @model',
    '  path:models/staging | tag:finance | source:raw.orders',
    '  status:modified | status:built',
    '  --exclude model',
    '',
    'level meta',
    '  help | hint | levels | show goal | hide goal | show solution | reset | undo',
  ].join('\n');
}
