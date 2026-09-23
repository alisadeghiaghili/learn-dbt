import { describe, expect, it } from 'vitest';
import { coachLine, currentStepIndex, formatSteps, solutionProgress } from '../src/engine/coach';
import { whyBlock } from '../src/engine/teach';
import { createProject } from '../src/engine/project';
import { executeCommand } from '../src/engine/commands';
import { getLevel } from '../src/levels';
import { sandboxLevel } from '../src/levels/sandbox';

describe('coach / sticky checklist', () => {
  it('lists official solution commands as not-run initially', () => {
    const level = getLevel('intro_run_ancestors')!;
    const p = createProject(level.start);
    const steps = solutionProgress(p, level);
    expect(steps).toHaveLength(level.solution.length);
    expect(steps[0].done).toBe(false);
    expect(currentStepIndex(steps)).toBe(0);
    expect(coachLine(p, level)).toBe(`Next: ${level.solution[0]}`);
  });

  it('wrong command keeps progress and points at official step', () => {
    const level = getLevel('intro_run_ancestors')!;
    let p = createProject(level.start);
    p = executeCommand('dbt run --select fct_orders', p, level.goal).project;
    const coach = coachLine(p, level);
    expect(coach).toBeTruthy();
    expect(coach).toContain('dbt run --select +fct_orders');
    expect(formatSteps(p, level)).toContain('now');
  });

  it('does not rewind a completed step after a later wrong command', () => {
    const level = getLevel('sel_exclude')!;
    // simulate multi-issuance path on a single-step level: issue official then wrong
    let p = createProject(level.start);
    const official = level.solution[0];
    p = executeCommand(official, p).project; // no goal → not solved yet
    p = executeCommand('dbt ls', p).project;
    const steps = solutionProgress(p, level);
    expect(steps[0].done).toBe(true);
    expect(steps[0].note).toContain('already completed');
  });

  it('marks steps done when the goal is solved', () => {
    const level = getLevel('intro_run_one')!;
    let p = createProject(level.start);
    p = executeCommand(level.solution[0], p, level.goal).project;
    const steps = solutionProgress(p, level);
    expect(steps.every((s) => s.done)).toBe(true);
    expect(coachLine(p, level)).toBeNull();
  });

  it('sandbox coach guides without a solution checklist', () => {
    const p = createProject(sandboxLevel.start);
    expect(solutionProgress(p, sandboxLevel)).toEqual([]);
    expect(coachLine(p, sandboxLevel)).toContain('Sandbox');
  });

  it('why blocks teach after dbt commands', () => {
    expect(whyBlock('dbt run --select +fct_orders')).toContain('Why');
    expect(whyBlock('help')).toBeNull();
  });
});
