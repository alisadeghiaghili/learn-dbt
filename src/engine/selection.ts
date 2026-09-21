import { ancestors, buildGraph, descendants } from './graph';
import type { ProjectState } from './types';

export interface SelectionGraph {
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
  project: ProjectState;
}

interface PlusFlags {
  prefix: boolean;
  suffix: boolean;
  core: string;
}

function parsePlus(sel: string): PlusFlags {
  if (sel.startsWith('@') && sel.length > 1) {
    return { prefix: false, suffix: false, core: sel };
  }
  const both = sel.startsWith('+') && sel.endsWith('+') && sel.length > 2;
  if (both) {
    return { prefix: true, suffix: true, core: sel.slice(1, -1) };
  }
  if (sel.startsWith('+') && sel.length > 1) {
    return { prefix: true, suffix: false, core: sel.slice(1) };
  }
  if (sel.endsWith('+') && sel.length > 1) {
    return { prefix: false, suffix: true, core: sel.slice(0, -1) };
  }
  return { prefix: false, suffix: false, core: sel };
}

function expandCore(core: string, project: ProjectState): Set<string> {
  if (core.startsWith('path:')) {
    const prefix = core.slice('path:'.length);
    const out = new Set<string>();
    for (const node of Object.values(project.nodes)) {
      if (
        node.path === prefix ||
        node.path.startsWith(prefix + '/') ||
        node.path.startsWith(prefix)
      ) {
        out.add(node.id);
      }
    }
    return out;
  }

  if (core.startsWith('tag:')) {
    const tag = core.slice('tag:'.length);
    const out = new Set<string>();
    for (const node of Object.values(project.nodes)) {
      if (node.tags.includes(tag)) out.add(node.id);
    }
    return out;
  }

  if (core.startsWith('source:')) {
    const rest = core.slice('source:'.length);
    const out = new Set<string>();
    if (rest.includes('.')) {
      if (project.sources[rest]) out.add(rest);
      return out;
    }
    for (const id of Object.keys(project.sources)) {
      if (id.startsWith(rest + '.')) out.add(id);
    }
    return out;
  }

  if (core === 'status:modified') {
    const out = new Set<string>();
    for (const node of Object.values(project.nodes)) {
      if (node.modified) out.add(node.id);
    }
    return out;
  }

  if (core === 'status:built') {
    const out = new Set<string>();
    for (const node of Object.values(project.nodes)) {
      if (node.status === 'success') out.add(node.id);
    }
    return out;
  }

  return new Set([core]);
}

/**
 * Expand a single dbt node selector to a set of node ids.
 *
 * Supported syntax:
 *   name | +name | name+ | +name+ | @name
 *   path:models/staging | tag:finance | source:raw.orders
 *   source:raw+ | tag:finance+ | status:modified+
 *   status:built
 *
 * Args:
 *   selector: Selector string.
 *   project: Project state.
 *   graph: Optional precomputed graph; computed when omitted.
 * Returns:
 *   Set of matching node/source ids.
 */
export function expandSelector(
  selector: string,
  project: ProjectState,
  graph?: SelectionGraph,
): Set<string> {
  const g = graph ?? { ...buildGraph(project), project };
  const sel = selector.trim();
  if (!sel) return new Set();

  if (sel.startsWith('@') && sel.length > 1) {
    const name = sel.slice(1);
    const out = new Set<string>([name]);
    for (const a of ancestors(name, g.parents)) out.add(a);
    for (const d of descendants(name, g.children)) {
      out.add(d);
      for (const a of ancestors(d, g.parents)) out.add(a);
    }
    return out;
  }

  const { prefix, suffix, core } = parsePlus(sel);
  const base = expandCore(core, project);
  if (!prefix && !suffix) return base;

  const out = new Set(base);
  for (const id of base) {
    if (prefix) {
      for (const a of ancestors(id, g.parents)) out.add(a);
    }
    if (suffix) {
      for (const d of descendants(id, g.children)) out.add(d);
    }
  }
  return out;
}

/**
 * Resolve a full --select / --exclude expression.
 *
 * Args:
 *   selectors: Union of selectors.
 *   exclude: Selectors to subtract after union.
 *   project: Project state.
 * Returns:
 *   Sorted array of selected ids.
 */
export function resolveSelection(
  selectors: string[],
  exclude: string[],
  project: ProjectState,
): string[] {
  const graph = { ...buildGraph(project), project };
  const out = new Set<string>();
  for (const sel of selectors) {
    for (const id of expandSelector(sel, project, graph)) {
      out.add(id);
    }
  }
  for (const sel of exclude) {
    for (const id of expandSelector(sel, project, graph)) {
      out.delete(id);
    }
  }
  return [...out].sort();
}

/**
 * Split a raw command's selection args into select/exclude lists.
 *
 * Args:
 *   tokens: Command tokens after the dbt subcommand.
 * Returns:
 *   Object with select and exclude token arrays.
 */
export function parseSelectionArgs(tokens: string[]): { select: string[]; exclude: string[] } {
  const select: string[] = [];
  const exclude: string[] = [];
  let mode: 'select' | 'exclude' | 'none' = 'none';

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '--select' || t === '-s' || t === '--models' || t === '-m') {
      mode = 'select';
      continue;
    }
    if (t === '--exclude') {
      mode = 'exclude';
      continue;
    }
    if (t.startsWith('-') && mode === 'none') {
      continue;
    }
    if (mode === 'select') select.push(t);
    else if (mode === 'exclude') exclude.push(t);
  }

  return { select, exclude };
}
