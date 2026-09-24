import type { CiState, LogLine, ProjectState } from './types';
import { cloneProject } from './project';

function log(kind: LogLine['kind'], text: string): LogLine {
  return { kind, text };
}

function graphHash(p: ProjectState): string {
  const keys = Object.keys(p.nodes).sort().join(',');
  return `h${keys.length}:${keys.slice(0, 24)}`;
}

/**
 * Save CI/prod artifact (simulates uploading manifest to state).
 */
export function ciSave(project: ProjectState): { project: ProjectState; logs: LogLine[] } {
  const next = cloneProject(project);
  const builtIds = Object.values(next.nodes)
    .filter((n) => n.status === 'success' || n.hasRelation)
    .map((n) => n.id)
    .sort();
  const modifiedIds = Object.values(next.nodes)
    .filter((n) => n.modified)
    .map((n) => n.id)
    .sort();
  const state: CiState = {
    savedAt: new Date().toISOString(),
    builtIds,
    modifiedIds,
    graphHash: graphHash(next),
  };
  next.ciState = state;
  return {
    project: next,
    logs: [
      log('ok', `ci state saved (${builtIds.length} built, ${modifiedIds.length} modified)`),
      log('meta', 'This artifact is what state:modified and restore compare against.'),
    ],
  };
}

/**
 * Restore from CI artifact — reset runtime, then mark previously built nodes.
 */
export function ciRestore(project: ProjectState): { project: ProjectState; logs: LogLine[] } {
  const logs: LogLine[] = [];
  if (!project.ciState) {
    return { project, logs: [log('err', 'no ci state — run `ci save` first')] };
  }
  const next = cloneProject(project);
  const st = next.ciState;
  if (!st) {
    return { project, logs: [log('err', 'no ci state — run `ci save` first')] };
  }
  const built = new Set(st.builtIds);
  for (const n of Object.values(next.nodes)) {
    if (built.has(n.id)) {
      n.status = 'success';
      n.hasRelation = true;
      n.modified = false;
    } else {
      n.status = 'pending';
    }
    for (const t of n.tests) t.passed = undefined;
  }
  next.lastSelection = [];
  next.solved = false;
  logs.push(log('ok', `restored from ci state (${built.size} relations present)`));
  logs.push(
    log(
      'meta',
      'PR workflow: only changed models are dirty. Run `dbt run --select status:modified+`.',
    ),
  );
  return { project: next, logs };
}

/**
 * Record a structured diagnosis for incident drills.
 */
export function diagnose(
  project: ProjectState,
  note: string,
): { project: ProjectState; logs: LogLine[] } {
  const next = cloneProject(project);
  next.diagnoses = [...next.diagnoses, note];
  return {
    project: next,
    logs: [log('meta', `diagnosis recorded: ${note}`)],
  };
}
