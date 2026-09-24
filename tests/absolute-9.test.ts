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

describe('data-level tests (authenticity)', () => {
  it('unique test FAILS on duplicate keys', () => {
    let p = createProject({
      nodes: [
        {
          id: 'fct_orders',
          layer: 'mart',
          materialization: 'table',
          refs: [],
          corruption: 'dup_key',
          tests: [{ type: 'unique', column: 'order_id', severity: 'error' }],
        },
      ],
    });
    p = executeCommand('dbt build --select fct_orders', p).project;
    const t = p.nodes.fct_orders!.tests[0]!;
    expect(t.passed).toBe(false);
  });

  it('not_null FAILS on null keys', () => {
    let p = createProject({
      nodes: [
        {
          id: 'fct_orders',
          layer: 'mart',
          materialization: 'table',
          refs: [],
          corruption: 'null_key',
          tests: [{ type: 'not_null', column: 'order_id', severity: 'error' }],
        },
      ],
    });
    p = executeCommand('dbt build --select fct_orders', p).project;
    expect(p.nodes.fct_orders!.tests[0]!.passed).toBe(false);
  });

  it('unique test PASSES on clean rows', () => {
    let p = createProject({
      nodes: [
        {
          id: 'fct_orders',
          layer: 'mart',
          materialization: 'table',
          refs: [],
          tests: [{ type: 'unique', column: 'order_id', severity: 'error' }],
        },
      ],
    });
    p = executeCommand('dbt build --select fct_orders', p).project;
    expect(p.nodes.fct_orders!.tests[0]!.passed).toBe(true);
  });

  it('quiz gate requires correct answers', () => {
    const level = allLevels.find((l) => l.id === 'quiz_pack_1')!;
    let p = createProject(level.start);
    p = executeCommand('quiz list', p, level.goal).project;
    expect(evaluateGoal(p, level.goal).solved).toBe(false);
    for (const cmd of level.solution) {
      p = executeCommand(cmd, p, level.goal).project;
    }
    expect(p.quizCorrect).toBe(8);
    expect(evaluateGoal(p, level.goal).solved).toBe(true);
  });
});

describe('legacy mega repo', () => {
  it('has 100+ nodes and audit flags violations', () => {
    const level = getLevel('legacy_count')!;
    expect(level.start.nodes.length).toBeGreaterThanOrEqual(100);
  });
});
