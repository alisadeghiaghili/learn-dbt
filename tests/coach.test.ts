import { describe, expect, it } from 'vitest';
import { coachLine, formatSteps, solutionProgress } from '../src/engine/coach';
import { createProject } from '../src/engine/project';
import { executeCommand } from '../src/engine/commands';
import { getLevel } from '../src/levels';
import { sandboxLevel } from '../src/levels/sandbox';

describe('coach / solution checklist', () => {
  it('lists official solution commands as not-run initially', () => {
    const level = getLevel('intro_run_ancestors')!;
    const p = createProject(level.start);
    const steps = solutionProgress(p, level);
    expect(steps).toHaveLength(level.solution.length);
    expect(steps[0].done).toBe(false);
    expect(steps[0].command).toBe('dbt run --select +fct_orders');
    expect(coachLine(p, level)).toBe(`Next: ${level.solution[0]}`);
  });

  it('after a wrong command, still points at the official next step', () => {
    const level = getLevel('intro_run_ancestors')!;
    let p = createProject(level.start);
    p = executeCommand('dbt run --select fct_orders', p, level.goal).project;
    const coach = coachLine(p, level);
    expect(coach).toBeTruthy();
    expect(coach).toContain('dbt run --select +fct_orders');
    expect(formatSteps(p, level)).toContain('dbt run --select +fct_orders');
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
});
