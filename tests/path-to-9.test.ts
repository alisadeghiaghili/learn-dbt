import { describe, expect, it } from 'vitest';
import { createProject } from '../src/engine/project';
import { executeCommand } from '../src/engine/commands';
import { evaluateGoal } from '../src/engine/compare';
import { allLevels } from '../src/levels';
import { jinjaFeatures } from '../src/engine/jinja';

const SEQS = ['advanced', 'incidents', 'assessment'];

describe('path-to-9 packs solvable', () => {
  const pack = allLevels.filter((l) => SEQS.includes(l.sequence));

  it('volume covers advanced + 20 incidents + graded capstone', () => {
    expect(pack.filter((l) => l.sequence === 'incidents').length).toBe(20);
    expect(pack.filter((l) => l.sequence === 'advanced').length).toBeGreaterThanOrEqual(5);
    expect(pack.some((l) => l.id === 'grade_capstone')).toBe(true);
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

describe('jinja features', () => {
  it('detects set/if/for', () => {
    const f = jinjaFeatures("{% set x = 1 %}{% if x %}{% for i in y %}{{ i }}{% endfor %}{% endif %}");
    expect(f.hasSet).toBe(true);
    expect(f.hasIf).toBe(true);
    expect(f.hasFor).toBe(true);
  });
});

describe('diagnose + ci', () => {
  it('records diagnosis and saves/restores state', () => {
    let p = createProject({
      nodes: [{ id: 'a', layer: 'mart', materialization: 'table', modified: true }],
    });
    p = executeCommand('diagnose grain unique fanout', p).project;
    p = executeCommand('ci save', p).project;
    expect(p.diagnoses.length).toBe(1);
    expect(p.ciState).toBeTruthy();
    p = executeCommand('ci restore', p, { minDiagnoses: 1, diagnosesInclude: ['grain'], ciSaved: true }).project;
    expect(p.solved).toBe(true);
  });
});
