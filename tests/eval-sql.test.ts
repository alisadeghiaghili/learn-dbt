import { describe, expect, it } from 'vitest';
import { createProject } from '../src/engine/project';
import { executeCommand } from '../src/engine/commands';
import { evaluateGoal } from '../src/engine/compare';
import { allLevels } from '../src/levels';
import { evalSql, scoreSqlTransfer } from '../src/engine/evalSql';
import { dueForReview, gradeQuiz, recordQuizMiss } from '../src/engine/quiz';

describe('mini SQL evaluator', () => {
  const rels = {
    orders: [
      { id: 0, order_id: 0, amount: 10, status: 'placed' },
      { id: 1, order_id: 1, amount: 20, status: 'placed' },
      { id: 2, order_id: 2, amount: 30, status: 'canceled' },
    ],
  };

  it('evaluates SELECT * FROM', () => {
    const r = evalSql('select * from orders', rels);
    expect(r.rows).toHaveLength(3);
    expect(r.error).toBeUndefined();
  });

  it('evaluates WHERE filter', () => {
    const r = evalSql("select * from orders where status = 'placed'", rels);
    expect(r.rows).toHaveLength(2);
  });

  it('evaluates COUNT(*)', () => {
    const r = evalSql('select count(*) from orders', rels);
    expect(r.rows[0]).toEqual({ count: 3 });
  });

  it('evaluates SUM(amount)', () => {
    const r = evalSql('select sum(amount) from orders', rels);
    expect(r.rows[0]).toEqual({ sum: 60 });
  });
});

describe('scoresql transfer rubric', () => {
  it('scores real SQL high', () => {
    const sql = "select order_id, amount from {{ ref('stg_orders') }} where amount > 0";
    const r = scoreSqlTransfer(sql, [
      { id: 'ref', label: 'ref', test: (s) => s.includes('ref('), points: 50 },
      { id: 'where', label: 'where', test: (s) => /where/i.test(s), points: 50 },
    ]);
    expect(r.score).toBe(100);
    expect(r.missing).toEqual([]);
  });

  it('scores weak SQL low', () => {
    const r = scoreSqlTransfer('select * from x', [
      { id: 'ref', label: 'ref', test: (s) => s.includes('ref('), points: 50 },
      { id: 'where', label: 'where', test: (s) => /where/i.test(s), points: 50 },
    ]);
    expect(r.score).toBe(0);
    expect(r.missing).toEqual(['ref', 'where']);
  });
});

describe('transfer packs solvable', () => {
  for (const level of allLevels.filter((l) => l.sequence === 'transfer')) {
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

describe('spaced review schedule', () => {
  it('missed items are due immediately', () => {
    recordQuizMiss('q_grain');
    const due = dueForReview().map((q) => q.id);
    expect(due).toContain('q_grain');
    gradeQuiz('q_grain', 0);
  });
});
