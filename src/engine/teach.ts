/**
 * Short "Why" teaching blocks after dbt commands (learn-dvc teach pattern).
 */

const WHY_RUN = [
  '── Why: dbt run ──',
  'Materializes selected models in topological order. Upstream relations must already exist',
  'unless you selected them with `+`. Views only need their sources; tables write results.',
].join('\n');

const WHY_BUILD = [
  '── Why: dbt build ──',
  'build = run + test in dependency order. Use this when data quality gates matter.',
  'A failing test does not un-build parents — it marks that node\'s gate red.',
].join('\n');

const WHY_PLUS = [
  '── Why: `+model` vs `model+` ──',
  '`+model` pulls ancestors so dependencies exist first. `model+` rebuilds descendants',
  'after you change a source. `@model` is the neighborhood (parents, children, parents of children).',
].join('\n');

const WHY_SELECT = [
  '── Why: selection grammar ──',
  'Selectors are unioned; `--exclude` subtracts. `tag:`/`path:`/`source:` scale to big projects',
  'where typing model names does not. `status:modified+` is the slim CI pattern.',
].join('\n');

const WHY_EPHEMERAL = [
  '── Why: ephemeral ──',
  'Ephemeral models compile to CTEs — no warehouse relation. They still must "build" in the',
  'simulator so children can run. Cheaper, but invisible in the catalog.',
].join('\n');

const WHY_INCREMENTAL = [
  '── Why: incremental ──',
  'First run creates the table; later runs append/merge only new data. `--full-refresh` rebuilds.',
  'Wrong incremental strategy silently under-counts history — know your watermark.',
].join('\n');

/**
 * Return a Why block for a raw terminal command.
 *
 * Args:
 *   raw: Command string.
 * Returns:
 *   Multi-line teaching text, or null.
 */
export function whyBlock(raw: string): string | null {
  const cmd = raw.trim().toLowerCase();
  if (!cmd.startsWith('dbt ')) return null;
  if (/\bbuild\b/.test(cmd)) return [WHY_BUILD, WHY_SELECT].join('\n\n');
  if (/\brun\b/.test(cmd) && /status:modified/.test(cmd)) {
    return [WHY_SELECT, 'Slim CI: rebuild what changed plus consumers, not the whole warehouse.'].join('\n\n');
  }
  if (/\brun\b/.test(cmd) && /(@|\+|exclude|tag:|path:|source:)/.test(cmd)) {
    return [WHY_PLUS, WHY_SELECT].join('\n\n');
  }
  if (/\brun\b/.test(cmd) && /full-refresh|incremental/.test(cmd)) return WHY_INCREMENTAL;
  if (/\brun\b/.test(cmd) && /ephemeral/.test(cmd)) return WHY_EPHEMERAL;
  if (/\brun\b/.test(cmd)) return WHY_RUN;
  if (/\btest\b/.test(cmd)) return WHY_BUILD;
  if (/\bls\b|\blist\b/.test(cmd)) {
    return '── Why: dbt ls ──\nLists nodes in a selection without materializing. Lineage first, warehouse second.';
  }
  return null;
}
