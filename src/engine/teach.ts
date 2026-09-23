/**
 * Short "Why" teaching blocks after dbt commands.
 * Goal: the learner should finish able to reason about dbt, not just type commands.
 */

function block(title: string, lines: string[]): string {
  return ['', `── Why: ${title} ──`, ...lines.map((l) => `  ${l}`)].join('\n');
}

/**
 * Return a teaching block for a raw terminal command.
 *
 * Args:
 *   raw: Command string.
 * Returns:
 *   Multi-line teaching text, or null.
 */
export function whyBlock(raw: string): string | null {
  const cmd = raw.trim().toLowerCase();
  if (!cmd.startsWith('dbt ')) return null;

  if (/\bbuild\b/.test(cmd)) {
    return block('dbt build', [
      'build = run + tests in one topological pass. Prefer it on the critical path.',
      'Tests attached to a model run right after that model materializes.',
      'A failing test marks the gate red; it does not silently rewrite parents.',
    ]);
  }

  if (/\brun\b/.test(cmd) && /status:modified/.test(cmd)) {
    return block('status:modified+ (slim CI)', [
      'Rebuild what changed plus its descendants — not the whole warehouse.',
      'This is the standard PR check in large analytics repos.',
      'Requires a reliable state/manifest comparison (prod artifacts).',
    ]);
  }

  if (/\brun\b/.test(cmd) && /@/.test(cmd)) {
    return block('@model (neighborhood)', [
      '@model = model + parents + children + parents of children.',
      'Use it when one model’s change fans out both upstream contracts and downstream marts.',
    ]);
  }

  if (/\brun\b/.test(cmd) && /\+/.test(cmd)) {
    return block('+model / model+', [
      '`+model` pulls ancestors so dependencies exist before the model runs.',
      '`model+` rebuilds consumers after you change a source or staging model.',
      'Without `+`, a lone mart fails if staging is missing — that is the usual newbie trap.',
    ]);
  }

  if (/\brun\b/.test(cmd) && /exclude|tag:|path:|source:/.test(cmd)) {
    return block('selection grammar', [
      'Selectors union; `--exclude` subtracts. `tag:` / `path:` / `source:` scale past model names.',
      'Pick one organizing principle (layer path OR tags) and stick to it in a real repo.',
    ]);
  }

  if (/\brun\b/.test(cmd) && /full-refresh/.test(cmd)) {
    return block('incremental --full-refresh', [
      'First incremental run creates the table; later runs append/merge only new data.',
      '--full-refresh rebuilds the relation from scratch (schema drift, backfills, bad watermark).',
      'Wrong incremental strategy silently under-counts history — know your watermark.',
    ]);
  }

  if (/\brun\b/.test(cmd)) {
    return block('dbt run', [
      'Materializes selected models in topological order. Upstream relations must already exist',
      'unless you selected them with `+`. Views need sources; tables write results.',
    ]);
  }

  if (/\btest\b/.test(cmd)) {
    return block('dbt test', [
      'Runs generic/custom tests on built models. Tests do not materialize anything.',
      'unique / not_null are row-level contracts; relationships check join integrity.',
    ]);
  }

  if (/\bls\b|\blist\b/.test(cmd)) {
    return block('dbt ls', [
      'Lists nodes in a selection without touching the warehouse.',
      'Lineage first, warehouse second — always confirm what *would* run before you run it.',
    ]);
  }

  return null;
}
