import type { Layer, ProjectState } from '../engine/types';
import { buildGraph } from '../engine/graph';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  layer: Layer;
  status: string;
  materialization: string;
  selected: boolean;
  label: string;
}

export interface LayoutEdge {
  from: string;
  to: string;
}

export interface DagLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

const LAYER_ORDER: Layer[] = [
  'source',
  'seed',
  'staging',
  'intermediate',
  'mart',
  'exposure',
  'snapshot',
];

const LAYER_X: Record<Layer, number> = {
  source: 40,
  seed: 40,
  staging: 220,
  intermediate: 400,
  mart: 580,
  exposure: 760,
  snapshot: 760,
};

/**
 * Compute a layered left-to-right DAG layout.
 *
 * Args:
 *   project: Project state.
 *   selection: Ids currently selected by the last command.
 * Returns:
 *   Node positions, edges, and canvas size.
 */
export function layoutDag(project: ProjectState, selection: string[] = []): DagLayout {
  const selected = new Set(selection);
  const columns = new Map<Layer, string[]>();

  for (const layer of LAYER_ORDER) {
    columns.set(
      layer,
      Object.values(project.nodes)
        .filter((n) => n.layer === layer)
        .map((n) => n.id)
        .sort(),
    );
  }
  // sources live in their own column
  const sourceIds = Object.keys(project.sources).sort();

  const nodes: LayoutNode[] = [];
  const rowH = 72;
  const colW = 170;
  let maxRows = 0;

  const placeColumn = (ids: string[], x: number, layer: Layer) => {
    maxRows = Math.max(maxRows, ids.length);
    ids.forEach((id, i) => {
      const node = project.nodes[id];
      const src = project.sources[id];
      nodes.push({
        id,
        x,
        y: 36 + i * rowH,
        layer,
        status: node?.status ?? (src?.loaded ? 'success' : 'pending'),
        materialization: node?.materialization ?? 'source',
        selected: selected.has(id),
        label: id,
      });
    });
  };

  placeColumn(sourceIds, LAYER_X.source, 'source');
  for (const layer of LAYER_ORDER) {
    if (layer === 'source') continue;
    const ids = columns.get(layer) ?? [];
    if (!ids.length) continue;
    placeColumn(ids, LAYER_X[layer] ?? LAYER_X.mart, layer);
  }

  const { parents } = buildGraph(project);
  const edges: LayoutEdge[] = [];
  for (const node of Object.values(project.nodes)) {
    for (const dep of node.refs) {
      edges.push({ from: dep, to: node.id });
    }
    for (const dep of node.sourceRefs) {
      edges.push({ from: dep, to: node.id });
    }
  }

  // snapshot column may collide with exposure — offset snapshot vertically if both exist
  const hasExposure = (columns.get('exposure') ?? []).length > 0;
  const hasSnapshot = (columns.get('snapshot') ?? []).length > 0;
  if (hasExposure && hasSnapshot) {
    for (const n of nodes) {
      if (n.layer === 'snapshot') n.x += colW;
    }
  }

  const width = Math.max(900, ...nodes.map((n) => n.x + 160));
  const height = Math.max(320, 36 + maxRows * rowH + 40);
  void parents;
  return { nodes, edges, width, height };
}

export const layerColor: Record<Layer, string> = {
  source: 'var(--source)',
  seed: 'var(--staging)',
  staging: 'var(--staging)',
  intermediate: 'var(--intermediate)',
  mart: 'var(--mart)',
  exposure: 'var(--accent)',
  snapshot: 'var(--muted)',
};
