import type { DbtNode, ProjectState } from './types';

/**
 * Collect all dependencies (refs + sourceRefs) of a node.
 *
 * Args:
 *   node: Model node.
 * Returns:
 *   Array of upstream ids (models and sources).
 */
export function dependenciesOf(node: DbtNode): string[] {
  return [...node.refs, ...node.sourceRefs];
}

/**
 * True when the id refers to a source relation.
 *
 * Args:
 *   id: Node or source id.
 * Returns:
 *   True if the id looks like `sourceName.tableName`.
 */
export function isSourceId(id: string): boolean {
  return id.includes('.') && !isModelName(id);
}

/**
 * Model names may also contain dots (schema.model); sources use
 * the form `source.table` where source is registered in project.sources.
 */
export function isModelName(id: string): boolean {
  return !id.startsWith('source:') && id.split('.').length <= 2;
}

/**
 * Build adjacency maps for the full project graph (models + sources).
 *
 * Args:
 *   project: Current project state.
 * Returns:
 *   Object with parents/children maps keyed by node id.
 */
export function buildGraph(project: ProjectState): {
  parents: Map<string, string[]>;
  children: Map<string, string[]>;
  allIds: string[];
} {
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const allIds: string[] = [];

  const ensure = (id: string) => {
    if (!parents.has(id)) parents.set(id, []);
    if (!children.has(id)) children.set(id, []);
  };

  for (const id of Object.keys(project.sources)) {
    ensure(id);
    allIds.push(id);
  }
  for (const node of Object.values(project.nodes)) {
    ensure(node.id);
    allIds.push(node.id);
  }

  for (const node of Object.values(project.nodes)) {
    for (const dep of dependenciesOf(node)) {
      ensure(dep);
      const p = parents.get(node.id)!;
      if (!p.includes(dep)) p.push(dep);
      const c = children.get(dep)!;
      if (!c.includes(node.id)) c.push(node.id);
    }
  }

  return { parents, children, allIds };
}

/**
 * Ancestors of a node (all upstream, excluding self).
 *
 * Args:
 *   id: Starting node id.
 *   parents: Parent adjacency map.
 * Returns:
 *   Set of ancestor ids.
 */
export function ancestors(id: string, parents: Map<string, string[]>): Set<string> {
  const out = new Set<string>();
  const stack = [...(parents.get(id) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    stack.push(...(parents.get(cur) ?? []));
  }
  return out;
}

/**
 * Descendants of a node (all downstream, excluding self).
 *
 * Args:
 *   id: Starting node id.
 *   children: Children adjacency map.
 * Returns:
 *   Set of descendant ids.
 */
export function descendants(id: string, children: Map<string, string[]>): Set<string> {
  const out = new Set<string>();
  const stack = [...(children.get(id) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    stack.push(...(children.get(cur) ?? []));
  }
  return out;
}

/**
 * Topologically sort models that must be built.
 * Sources are ordered first when present in the selection set.
 * Cycles throw.
 *
 * Args:
 *   ids: Node ids to order (models + possibly sources).
 *   parents: Parent adjacency map.
 * Returns:
 *   Array ordered dependencies-first.
 */
export function topoSort(ids: Iterable<string>, parents: Map<string, string[]>): string[] {
  const idSet = new Set(ids);
  const indeg = new Map<string, number>();
  const order: string[] = [];
  const queue: string[] = [];

  for (const id of idSet) {
    const deps = (parents.get(id) ?? []).filter((p) => idSet.has(p));
    indeg.set(id, deps.length);
  }
  for (const [id, deg] of indeg) {
    if (deg === 0) queue.push(id);
  }
  queue.sort();

  const childOf = new Map<string, string[]>();
  for (const id of idSet) {
    for (const p of parents.get(id) ?? []) {
      if (!idSet.has(p)) continue;
      if (!childOf.has(p)) childOf.set(p, []);
      childOf.get(p)!.push(id);
    }
  }

  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const child of childOf.get(id) ?? []) {
      const next = (indeg.get(child) ?? 0) - 1;
      indeg.set(child, next);
      if (next === 0) {
        queue.push(child);
        queue.sort();
      }
    }
  }

  if (order.length !== idSet.size) {
    const remaining = [...idSet].filter((id) => !order.includes(id));
    throw new Error(`Circular dependency involving: ${remaining.join(', ')}`);
  }
  return order;
}

/**
 * Detect whether adding refs would create a cycle.
 *
 * Args:
 *   project: Current project.
 *   modelId: Model being edited.
 *   newRefs: Proposed refs.
 * Returns:
 *   True when a cycle would exist.
 */
export function wouldCreateCycle(
  project: ProjectState,
  modelId: string,
  newRefs: string[],
): boolean {
  const { parents } = buildGraph(project);
  // Simulate: modelId's parents become newRefs
  const simulated = new Map(parents);
  simulated.set(modelId, [...newRefs]);
  try {
    topoSort(simulated.keys(), simulated);
    // Also need children edges; rebuild quickly
    const children = new Map<string, string[]>();
    for (const [child, deps] of simulated) {
      for (const d of deps) {
        if (!children.has(d)) children.set(d, []);
        children.get(d)!.push(child);
      }
    }
    // If model is an ancestor of itself under new refs → cycle
    return ancestors(modelId, simulated).has(modelId) ||
      descendants(modelId, children).has(modelId) &&
        ancestors(modelId, simulated).size > 0 &&
        isReachable(modelId, modelId, simulated);
  } catch {
    return true;
  }
}

function isReachable(from: string, to: string, parents: Map<string, string[]>): boolean {
  // walk ancestors of `from`; if we can get from `to` to `from` via parents...
  return ancestors(from, parents).has(to);
}

export type { DbtNode, ProjectState };
