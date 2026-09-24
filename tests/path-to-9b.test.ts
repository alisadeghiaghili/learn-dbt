import { describe, expect, it } from 'vitest';
import { createProject } from '../src/engine/project';
import { executeCommand } from '../src/engine/commands';
import { evaluateGoal, scoreRubric } from '../src/engine/compare';
import { allLevels, getLevel } from '../src/levels';

const SEQS = ['warehouse', 'design', 'exam'];

describe('path-to-9 final packs', () => {
  const pack = allLevels.filter((l) => SEQS.includes(l.sequence));

  it('volume: warehouse + design + exams', () => {
    expect(pack.filter((l) => l.sequence === 'warehouse').length).toBeGreaterThanOrEqual(5);
    expect(pack.filter((l) => l.sequence === 'design').length).toBeGreaterThanOrEqual(4);
    expect(pack.filter((l) => l.sequence === 'exam').length).toBeGreaterThanOrEqual(2);
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

describe('exam rubric score', () => {
  it('scores a completed exam_01', () => {
    const level = getLevel('exam_01_sprint')!;
    let p = createProject(level.start);
    for (const cmd of level.solution) {
      p = executeCommand(cmd, p, level.goal).project;
    }
    const score = scoreRubric(p, level.goal, level.rubric!);
    expect(score.max).toBe(100);
    expect(score.earned).toBe(100);
    expect(score.items.every((i) => i.hit)).toBe(true);
  });
});

describe('warehouse config', () => {
  it('sets partition and cluster', () => {
    let p = createProject({
      warehouse: 'bq',
      nodes: [{ id: 'f', layer: 'mart', materialization: 'table' }],
    });
    p = executeCommand('warehouse bq', p).project;
    p = executeCommand('set config f partition=event_date cluster=customer_id wh=bq', p).project;
    expect(p.nodes.f?.partitionBy).toBe('event_date');
    expect(p.nodes.f?.clusterBy).toBe('customer_id');
    expect(p.warehouse).toBe('bq');
  });
});
