import type { LevelDef, ProjectState } from './types';

export interface SolutionStepStatus {
  command: string;
  done: boolean;
  note: string;
}

function normalizeCmd(cmd: string): string {
  return cmd.trim().replace(/\s+/g, ' ');
}

function dbtSubcommand(cmd: string): string | null {
  const t = normalizeCmd(cmd).split(' ');
  if (t[0] !== 'dbt' || !t[1]) return null;
  return t[1];
}

/**
 * Map each official solution command to a sticky completion flag.
 * A step stays done after it was issued (learn-dvc sticky checklist):
 * a later wrong command must not rewind earlier ticks.
 *
 * Args:
 *   project: Current project state (commandsIssued drives stickiness).
 *   level: Active level (null/undefined → empty list).
 * Returns:
 *   One status per solution command, in order.
 */
export function solutionProgress(
  project: ProjectState,
  level: Pick<LevelDef, 'solution'> | null | undefined,
): SolutionStepStatus[] {
  const solution = level?.solution ?? [];
  if (!solution.length) return [];

  const seen = new Set<string>();
  for (const c of project.commandsIssued) {
    seen.add(normalizeCmd(c));
  }

  return solution.map((command, index) => stepStatus(project, command, index, seen));
}

function stepStatus(
  project: ProjectState,
  command: string,
  index: number,
  issued: Set<string>,
): SolutionStepStatus {
  const cmd = normalizeCmd(command);

  if (project.solved) {
    return { command: cmd, done: true, note: 'goal satisfied' };
  }

  // Sticky: if this official command was already issued, keep the tick.
  if (issued.has(cmd)) {
    return { command: cmd, done: true, note: 'already completed' };
  }

  // Prefix-sticky for later steps only after earlier official commands ran.
  const priorIssued = project.commandsIssued
    .map(normalizeCmd)
    .filter((c) => c === cmd);
  if (priorIssued.length) {
    return { command: cmd, done: true, note: 'already completed' };
  }

  const sub = dbtSubcommand(cmd);
  if (sub) {
    const similar = project.commandsIssued.find((c) => dbtSubcommand(c) === sub);
    if (similar) {
      return {
        command: cmd,
        done: false,
        note: `wrong attempt kept — official step still: try again`,
      };
    }
  }

  const isFirstPending = true; // caller highlights current; note only
  void index;
  void isFirstPending;
  return { command: cmd, done: false, note: 'not run yet' };
}

/**
 * Index of the first unfinished solution step (-1 when none).
 *
 * Args:
 *   steps: Progress list.
 * Returns:
 *   Index of current step.
 */
export function currentStepIndex(steps: SolutionStepStatus[]): number {
  return steps.findIndex((s) => !s.done);
}

/**
 * One-line coach after a command / for the `steps` meta-command.
 *
 * Args:
 *   project: Current project state.
 *   level: Active level.
 * Returns:
 *   Coach line, or null when nothing useful to say.
 */
export function coachLine(
  project: ProjectState,
  level: Pick<LevelDef, 'solution' | 'id'> | null | undefined,
): string | null {
  const steps = solutionProgress(project, level);
  if (!steps.length) {
    return project.solved ? null : 'Sandbox mode — type `help` for commands.';
  }

  const idx = currentStepIndex(steps);
  if (idx < 0) {
    return project.solved
      ? null
      : 'Solution commands were issued but the goal is still open. Type `show goal` to inspect.';
  }

  const next = steps[idx];
  const lastWrong = project.commandsIssued.length
    ? normalizeCmd(project.commandsIssued[project.commandsIssued.length - 1])
    : null;
  const wrongAttempt =
    lastWrong && lastWrong !== next.command && !project.solved && project.commandsIssued.length
      ? `Progress kept. Still on: ${next.command}`
      : null;

  return wrongAttempt ?? `Next: ${next.command}`;
}

/**
 * Multi-line checklist text for the terminal `steps` command.
 *
 * Args:
 *   project: Current project state.
 *   level: Active level.
 * Returns:
 *   Human-readable checklist.
 */
export function formatSteps(
  project: ProjectState,
  level: Pick<LevelDef, 'solution' | 'id'> | null | undefined,
): string {
  const steps = solutionProgress(project, level);
  if (!steps.length) {
    return 'No solution steps (sandbox). Type `help` for dbt commands.';
  }
  const cur = currentStepIndex(steps);
  const lines = steps.map((s, i) => {
    const mark = s.done ? '✓' : i === cur ? '▶' : '○';
    const chip = i === cur && !s.done ? '  [now]' : '';
    return `${mark} ${s.command}${chip}    — ${s.note}`;
  });
  const coach = coachLine(project, level);
  if (coach) lines.push('', coach);
  return lines.join('\n');
}
