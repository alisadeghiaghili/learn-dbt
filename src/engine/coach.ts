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
 * Map each official solution command to a completion flag so the Goal
 * panel can list commands verbatim (same UX as learn-dvc coach).
 *
 * Args:
 *   project: Current project state.
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

  return solution.map((command) => stepStatus(project, command));
}

function stepStatus(project: ProjectState, command: string): SolutionStepStatus {
  const cmd = normalizeCmd(command);

  if (project.solved) {
    return { command: cmd, done: true, note: 'goal satisfied' };
  }

  const issuedExact = project.commandsIssued.some((c) => normalizeCmd(c) === cmd);
  if (issuedExact) {
    return {
      command: cmd,
      done: false,
      note: 'issued — goal still open (try `show goal`)',
    };
  }

  const sub = dbtSubcommand(cmd);
  if (sub) {
    const similar = project.commandsIssued.find((c) => dbtSubcommand(c) === sub);
    if (similar) {
      return {
        command: cmd,
        done: false,
        note: `you ran: ${normalizeCmd(similar)}`,
      };
    }
  }

  return { command: cmd, done: false, note: 'not run yet' };
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

  const next = steps.find((s) => !s.done);
  if (!next) {
    return project.solved
      ? null
      : 'Solution commands were issued but the goal is still open. Type `show goal` to inspect.';
  }

  if (next.note.startsWith('you ran:')) {
    return `Not solved yet. Official step: ${next.command}  (${next.note})`;
  }
  return `Next: ${next.command}`;
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
  const lines = steps.map((s) => {
    const mark = s.done ? '✓' : '○';
    return `${mark} ${s.command}    — ${s.note}`;
  });
  const coach = coachLine(project, level);
  if (coach) lines.push('', coach);
  return lines.join('\n');
}
