/**
 * Extended Jinja/SQL analysis for teaching advanced constructs.
 */

export interface JinjaFeatures {
  hasSet: boolean;
  hasIf: boolean;
  hasFor: boolean;
  hasMacroCall: string[];
  hasMacroDef: boolean;
  macroArgs: string[];
}

/**
 * Detect Jinja control structures in a SQL/macro body.
 *
 * Args:
 *   sql: Source text.
 * Returns:
 *   Feature flags for goal checks.
 */
export function jinjaFeatures(sql: string): JinjaFeatures {
  const macroCalls = new Set<string>();
  for (const m of sql.matchAll(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g)) {
    const name = m[1]!;
    if (!['ref', 'source', 'var', 'config', 'is_incremental', 'this', 'target'].includes(name)) {
      macroCalls.add(name);
    }
  }
  const def = sql.match(/\{%-?\s*macro\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/);
  const args = def?.[2]
    ? def[2]
        .split(',')
        .map((s) => s.trim().split('=')[0]!.trim())
        .filter(Boolean)
    : [];

  return {
    hasSet: /\{%-?\s*set\s+/.test(sql),
    hasIf: /\{%-?\s*if\s+/.test(sql),
    hasFor: /\{%-?\s*for\s+/.test(sql),
    hasMacroCall: [...macroCalls],
    hasMacroDef: Boolean(def),
    macroArgs: args,
  };
}

/**
 * Detect which required construct is present in a model body.
 *
 * Args:
 *   sql: Model SQL.
 *   need: Required construct.
 * Returns:
 *   True when present.
 */
export function sqlRequires(sql: string, need: 'for' | 'if' | 'set' | 'macro'): boolean {
  const f = jinjaFeatures(sql);
  if (need === 'for') return f.hasFor;
  if (need === 'if') return f.hasIf;
  if (need === 'set') return f.hasSet;
  return f.hasMacroCall.length > 0 || f.hasMacroDef;
}
