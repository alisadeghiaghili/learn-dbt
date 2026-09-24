/**
 * Tiny in-memory data layer so tests evaluate real rows, not just build status.
 */

export type Row = Record<string, string | number | null>;
export type Rows = Row[];

import type { DbtTest, ProjectState } from './types';

/** Deterministic pseudo-rows for a model so unique/not_null/relationships can fail for real. */
export function seedRowsFor(
  modelId: string,
  kind: 'source' | 'model',
  opts: {
    primaryKey?: string;
    /** Corrupt grain / introduce nulls for incident drills. */
    corruption?: 'dup_key' | 'null_key' | 'orphan_fk' | 'bad_enum' | 'clean';
    refCount?: number;
  } = {},
): Rows {
  const pk = opts.primaryKey ?? 'id';
  const corruption = opts.corruption ?? 'clean';
  const rows: Rows = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    rows.push({
      [pk]: i,
      customer_id: corruption === 'orphan_fk' && i === n - 1 ? 999 : i % 3,
      order_id: i,
      amount: 10 * (i + 1),
      status: corruption === 'bad_enum' && i === 0 ? 'unknown_status' : 'placed',
      updated_at: `2024-01-0${i + 1}`,
    });
  }
  if (corruption === 'dup_key' && rows.length) {
    rows.push({ ...rows[0]! });
  }
  if (corruption === 'null_key' && rows.length) {
    rows[0]![pk] = null;
    rows[1]!['order_id'] = null;
  }
  void kind;
  void opts.refCount;
  void modelId;
  return rows;
}

/**
 * Evaluate a test against a row set (and optional parent rows for relationships).
 *
 * Args:
 *   test: Test definition.
 *   rows: Model rows.
 *   parentRows: Upstream rows for relationships.
 * Returns:
 *   True when the assertion holds on data.
 */
export function evaluateTestOnRows(
  test: DbtTest,
  rows: Rows,
  parentRows?: Rows,
): boolean {
  if (!rows.length) return false;

  switch (test.type) {
    case 'unique': {
      const col = test.column ?? 'id';
      const seen = new Set<string>();
      for (const r of rows) {
        const v = r[col];
        if (v === null || v === undefined) return false;
        const key = String(v);
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    }
    case 'not_null': {
      const col = test.column ?? 'id';
      return rows.every((r) => r[col] !== null && r[col] !== undefined);
    }
    case 'relationships': {
      const col = test.column ?? 'customer_id';
      if (!parentRows?.length) return false;
      const parentKeys = new Set(parentRows.map((r) => String(r['id'] ?? r[col] ?? r['order_id'])));
      return rows.every((r) => parentKeys.has(String(r[col])));
    }
    case 'accepted_values': {
      const col = test.column ?? 'status';
      const allowed = (test.config ?? '')
        .split(/[|,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!allowed.length) return true;
      return rows.every((r) => allowed.includes(String(r[col])));
    }
    case 'expression_is_true':
    case 'custom':
    case 'singular':
    case 'unit':
      // Simulation rule: non-generic tests pass on non-empty built data
      // unless rows are empty.
      return rows.length > 0;
    default:
      return rows.length > 0;
  }
}

/**
 * Attach/generated rows for all nodes/sources after a successful build step.
 */
export function ensureRows(project: ProjectState, nodeId: string, corruption?: Parameters<typeof seedRowsFor>[2]): Rows {
  const existing = project.modelRows?.[nodeId];
  if (existing?.length) return existing;
  const isSrc = Boolean(project.sources[nodeId]);
  const rows = seedRowsFor(nodeId, isSrc ? 'source' : 'model', corruption);
  project.modelRows = { ...(project.modelRows ?? {}), [nodeId]: rows };
  return rows;
}
