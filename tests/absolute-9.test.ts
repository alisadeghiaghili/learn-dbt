import { describe, expect, it } from 'vitest';
import { createProject } from '../src/engine/project';
import { executeCommand } from '../src/engine/commands';
import { evaluateGoal } from '../src/engine/compare';
import { allLevels, getLevel } from '../src/levels';
import { auditProject } from '../src/engine/audit';
import { gradeQuiz, quizBank, reviewQueue } from '../src/engine/quiz';

const SEQS = ['mega', 'quiz', 'fidelity'];

describe('absolute-9 packs', () => {
  const pack = allLevels.filter((l) => SEQS.includes(l.sequence));

  it('volume: mega + quiz + fidelity', () => {
    expect(pack.filter((l) => l.sequence === 'mega').length).toBeGreaterThanOrEqual(8);
    expect(pack.filter((l) => l.sequence === 'quiz').length).toBeGreaterThanOrEqual(4);
    expect(pack.filter((l) => l.sequence === 'fidelity').length).toBeGreaterThanOrEqual(2);
    expect(quizBank.length).toBeGreaterThanOrEqual(25);
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

describe('audit engine', () => {
  it('flags layer and naming violations', () => {
    const p = createProject({
      nodes: [
        { id: 'bad_name', layer: 'staging', materialization: 'view', sourceRefs: [] },
        {
          id: 'fct_x',
          layer: 'mart',
          materialization: 'table',
          sourceRefs: ['raw.orders'],
          refs: [],
        },
      ],
      sources: [{ id: 'raw.orders', loaded: true }],
    });
    const issues = auditProject(p);
    expect(issues.some((i) => i.code === 'naming' && i.modelId === 'bad_name')).toBe(true);
    expect(issues.some((i) => i.code === 'layer' && i.modelId === 'fct_x')).toBe(true);
  });
});

describe('quiz + review', () => {
  it('grades answers and tracks misses', () => {
    const g = gradeQuiz('q_grain', 0);
    expect(g.correct).toBe(true);
    const bad = gradeQuiz('q_grain', 2);
    expect(bad.correct).toBe(false);
    const q = reviewQueue();
    expect(q[0]?.id).toBe('q_grain');
  });
});

describe('mega project size', () => {
  it('has a realistic commerce DAG', () => {
    const level = getLevel('mega_orient')!;
    expect(Object.keys(level.start.nodes).length).toBeGreaterThanOrEqual(28);
    expect(level.start.sources?.length).toBeGreaterThanOrEqual(6);
  });
});
