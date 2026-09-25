import { describe, expect, it } from 'vitest';
import { createProject } from '../src/engine/project';
import { executeCommand } from '../src/engine/commands';
import { evaluateGoal } from '../src/engine/compare';
import { allLevels } from '../src/levels';

describe('craft pack solvable', () => {
  const pack = allLevels.filter((l) => l.sequence === 'craft');
  it('has interview/handoff depth', () => {
    expect(pack.length).toBeGreaterThanOrEqual(5);
  });

  for (const level of pack) {
    it(`solves ${level.id}`, () => {
      let p = createProject(level.start);
      for (const cmd of level.solution) {
        p = executeCommand(cmd, p, level.goal).project;
      }
      const goal = evaluateGoal(p, level.goal);
      expect(goal.solved, `${level.id}: ${goal.reasons.join('; ')}`).toBe(true);
    });
  }
});
