/**
 * Minimal SQL / Jinja surface parsing for lineage and compile checks.
 */

export interface ParsedSql {
  refs: string[];
  sourceRefs: string[];
  hasJinja: boolean;
  hasRef: boolean;
  hasSource: boolean;
  hasIncrementalBlock: boolean;
  hasVar: boolean;
  hasMacroCall: string[];
}

/**
 * Parse model SQL for ref()/source()/jinja constructs.
 *
 * Args:
 *   sql: Model body.
 * Returns:
 *   Extracted lineage and feature flags.
 */
export function parseSql(sql: string): ParsedSql {
  const refs = new Set<string>();
  const sourceRefs = new Set<string>();
  const macroCall = new Set<string>();

  for (const m of sql.matchAll(/\{\{\s*ref\(\s*['"]?([^'"\s)]+)['"]?\s*\)\s*\}\}/g)) {
    refs.add(m[1]!);
  }
  for (const m of sql.matchAll(
    /\{\{\s*source\(\s*['"]?([^'"\s)]+)['"]?\s*,\s*['"]?([^'"\s)]+)['"]?\s*\)\s*\}\}/g,
  )) {
    sourceRefs.add(`${m[1]}.${m[2]}`);
  }
  for (const m of sql.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)) {
    const name = m[1]!;
    if (name !== 'ref' && name !== 'source' && name !== 'var' && name !== 'config') {
      macroCall.add(name);
    }
  }

  return {
    refs: [...refs],
    sourceRefs: [...sourceRefs],
    hasJinja: /\{\{|\{%/.test(sql),
    hasRef: refs.size > 0,
    hasSource: sourceRefs.size > 0,
    hasIncrementalBlock: /is_incremental\s*\(\s*\)/.test(sql),
    hasVar: /\{\{\s*var\s*\(/.test(sql),
    hasMacroCall: [...macroCall],
  };
}

/**
 * Expand refs/sources/vars in a toy compile step (education, not SQL).
 *
 * Args:
 *   sql: Model body.
 *   vars: Project vars.
 *   target: Active target name.
 * Returns:
 *   Compiled pseudo-SQL with placeholders resolved.
 */
export function compileSql(
  sql: string,
  vars: Record<string, string>,
  target: string,
): string {
  let out = sql;
  out = out.replace(
    /\{\{\s*ref\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g,
    (_m, name: string) => `"${target}"."${name}"`,
  );
  out = out.replace(
    /\{\{\s*source\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g,
    (_m, s: string, t: string) => `"${target}"."${s}.${t}"`,
  );
  out = out.replace(
    /\{\{\s*var\(\s*['"]([^'"]+)['"](?:\s*,\s*[^}]*)?\)\s*\}\}/g,
    (_m, name: string) => vars[name] ?? '',
  );
  out = out.replace(/\{\%\s*if\s+is_incremental\s*\(\s*\)\s*\%\}/g, '-- if is_incremental()');
  out = out.replace(/\{\%\s*endif\s*\%\}/g, '-- endif');
  out = out.replace(/\{\{.*?\}\}/g, '/* jinja */');
  return out;
}

/**
 * Validate that model SQL refs only declared upstreams (when provided).
 *
 * Args:
 *   sql: Model body.
 *   allowedRefs: Known model ids.
 *   allowedSources: Known source ids.
 * Returns:
 *   List of problems (empty when clean).
 */
export function validateRefs(
  sql: string,
  allowedRefs: Iterable<string>,
  allowedSources: Iterable<string>,
): string[] {
  const p = parseSql(sql);
  const refs = new Set(allowedRefs);
  const srcs = new Set(allowedSources);
  const problems: string[] = [];
  for (const r of p.refs) {
    if (!refs.has(r)) problems.push(`unknown ref: ${r}`);
  }
  for (const s of p.sourceRefs) {
    if (!srcs.has(s)) problems.push(`unknown source: ${s}`);
  }
  return problems;
}
