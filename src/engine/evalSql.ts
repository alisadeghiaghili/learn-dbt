/**
 * Mini SQL evaluator over fixture rows.
 * Supports: SELECT cols | * | COUNT(*) | SUM(col) FROM <relation>
 *           [WHERE col op literal] [GROUP BY col]
 * Enough to make "write real SQL" transfers gradeable.
 */

export type Row = Record<string, string | number | null>;
export type RelationMap = Record<string, Row[]>;

export interface EvalResult {
  rows: Row[];
  columns: string[];
  error?: string;
}

function parseLiteral(tok: string): string | number | null {
  const t = tok.trim().replace(/;$/, '');
  if (/^'.*'$/.test(t) || /^".*"$/.test(t)) return t.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (/^null$/i.test(t)) return null;
  return t;
}

function applyWhere(rows: Row[], clause: string): Row[] {
  // col = literal | col != literal | col > n | col < n | col IS NULL | col IS NOT NULL
  const m = clause.match(/^\s*([a-zA-Z_][\w]*)\s*(=|!=|<>|>=|<=|>|<|IS\s+NOT\s+NULL|IS\s+NULL)\s*(.*)$/i);
  if (!m) return rows;
  const [, col, opRaw, restRaw] = m;
  const op = opRaw.replace(/\s+/g, ' ').toUpperCase();
  const lit = parseLiteral(restRaw ?? '');
  return rows.filter((r) => {
    const v = r[col!];
    switch (op) {
      case '=':
        return v === lit;
      case '!=':
      case '<>':
        return v !== lit;
      case '>':
        return Number(v) > Number(lit);
      case '<':
        return Number(v) < Number(lit);
      case '>=':
        return Number(v) >= Number(lit);
      case '<=':
        return Number(v) <= Number(lit);
      case 'IS NULL':
        return v === null || v === undefined;
      case 'IS NOT NULL':
        return v !== null && v !== undefined;
      default:
        return true;
    }
  });
}

/**
 * Evaluate a simplified SELECT against relations.
 *
 * Args:
 *   sql: Model body (Jinja already stripped/compiled to relation names).
 *   relations: name → rows. Relation names may be quoted.
 * Returns:
 *   Result rows or error.
 */
export function evalSql(sql: string, relations: RelationMap): EvalResult {
  let s = sql
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .replace(/\{%[\s\S]*?%\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/;$/, '');

  // FROM relation (last token after FROM that is not a keyword)
  const fromM = s.match(/\bfrom\s+("?[\w.]+"?)/i);
  if (!fromM) return { rows: [], columns: [], error: 'no FROM clause' };
  let relName = fromM[1]!.replace(/"/g, '');
  // strip schema prefix
  if (relName.includes('.')) relName = relName.split('.').pop()!;
  const rel = relations[relName];
  if (!rel) return { rows: [], columns: [], error: `relation not found: ${relName}` };

  let rows = [...rel];

  const whereM = s.match(/\bwhere\b(.*?)(\bgroup\b|\border\b|$)/i);
  if (whereM) {
    rows = applyWhere(rows, whereM[1]!.trim());
  }

  const selectM = s.match(/^\s*select\s+(.*?)\s+from\b/is);
  const selectList = selectM?.[1]?.trim() ?? '*';
  const groupM = s.match(/\bgroup\s+by\s+([a-zA-Z_][\w, ]*)/i);

  if (/count\s*\(\s*\*\s*\)/i.test(selectList)) {
    return {
      rows: [{ count: rows.length }],
      columns: ['count'],
    };
  }
  const sumM = selectList.match(/sum\s*\(\s*([a-zA-Z_][\w]*)\s*\)/i);
  if (sumM) {
    const col = sumM[1]!;
    const total = rows.reduce((a, r) => a + Number(r[col] ?? 0), 0);
    return { rows: [{ sum: total }], columns: ['sum'] };
  }

  if (groupM) {
    const gcol = groupM[1]!.split(',')[0]!.trim();
    const groups = new Map<string, number>();
    for (const r of rows) {
      const k = String(r[gcol]);
      groups.set(k, (groups.get(k) ?? 0) + 1);
    }
    return {
      rows: [...groups.entries()].map(([k, n]) => ({ [gcol]: k, count: n })),
      columns: [gcol, 'count'],
    };
  }

  if (selectList === '*' || selectList === ' *') {
    const cols = rows.length ? Object.keys(rows[0]!) : [];
    return { rows, columns: cols };
  }

  const cols = selectList.split(',').map((c) => c.trim().split(/\s+as\s+/i).pop()!.trim());
  return {
    rows: rows.map((r) => {
      const out: Row = {};
      for (const c of cols) out[c] = r[c] ?? null;
      return out;
    }),
    columns: cols,
  };
}

/**
 * Structural score for a transfer SQL answer (0-100).
 *
 * Args:
 *   sql: Learner SQL.
 *   required: Must-have fragments (ref, column names, aggregate…).
 * Returns:
 *   Score and missing pieces.
 */
export function scoreSqlTransfer(
  sql: string,
  required: { id: string; label: string; test: (s: string) => boolean; points: number }[],
): { score: number; max: number; hits: { id: string; label: string; hit: boolean; points: number }[]; missing: string[] } {
  const hits = required.map((r) => ({
    id: r.id,
    label: r.label,
    hit: r.test(sql),
    points: r.points,
  }));
  const score = hits.filter((h) => h.hit).reduce((a, b) => a + b.points, 0);
  const max = hits.reduce((a, b) => a + b.points, 0);
  const missing = hits.filter((h) => !h.hit).map((h) => h.label);
  return { score, max, hits, missing };
}
