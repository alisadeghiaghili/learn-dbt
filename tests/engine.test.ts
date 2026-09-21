import { describe, expect, it } from 'vitest';
import { createProject } from '../src/engine/project';
import { executeCommand } from '../src/engine/commands';
import { evaluateGoal } from '../src/engine/compare';
import { demoShopSpec } from '../src/levels';
import { getLevel } from '../src/levels';
import { sandboxSpec } from '../src/levels/sandbox';

describe('executeCommand', () => {
  it('lists models without building', () => {
    let p = createProject(demoShopSpec());
    const res = executeCommand('dbt ls', p);
    p = res.project;
    expect(res.logs.some((l) => l.text.includes('stg_orders'))).toBe(true);
    expect(Object.values(p.nodes).every((n) => n.status === 'pending')).toBe(true);
    expect(p.commandsIssued).toContain('dbt ls');
  });

  it('fails mart without ancestors', () => {
    let p = createProject(demoShopSpec());
    p = executeCommand('dbt run --select fct_orders', p).project;
    expect(p.nodes.fct_orders.status).toBe('error');
  });

  it('+fct_orders builds required upstream', () => {
    let p = createProject(demoShopSpec());
    p = executeCommand('dbt run --select +fct_orders', p).project;
    expect(p.nodes.stg_orders.status).toBe('success');
    expect(p.nodes.int_order_payments.status).toBe('success');
    expect(p.nodes.fct_orders.status).toBe('success');
    expect(p.nodes.dim_customers.status).toBe('pending');
  });

  it('dbt build runs tests after materialization', () => {
    let p = createProject(demoShopSpec());
    p = executeCommand('dbt build --select +fct_orders', p).project;
    const fct = p.nodes.fct_orders;
    expect(fct.status).toBe('success');
    expect(fct.tests.every((t) => t.passed === true)).toBe(true);
  });

  it('ephemeral models do not require a warehouse relation but succeed', () => {
    let p = createProject(demoShopSpec());
    p = executeCommand('dbt run --select +fct_orders', p).project;
    expect(p.nodes.int_order_payments.materialization).toBe('ephemeral');
    expect(p.nodes.int_order_payments.status).toBe('success');
  });

  it('unknown command errors', () => {
    const p = createProject(demoShopSpec());
    const res = executeCommand('git status', p);
    expect(res.error).toBeTruthy();
  });
});

describe('levels solvable by canonical solution', () => {
  const cases = [
    'intro_run_one',
    'intro_run_ancestors',
    'intro_run_descendants',
    'intro_build_vs_run',
    'sel_at',
    'sel_tag',
    'sel_path',
    'sel_exclude',
    'sel_modified',
    'mat_ephemeral',
    'mat_incremental',
    'mat_missing_upstream',
  ];

  for (const id of cases) {
    it(`solves ${id}`, () => {
      const level = getLevel(id);
      expect(level, `level ${id} missing`).toBeTruthy();
      let p = createProject(level!.start);
      for (const cmd of level!.solution) {
        const res = executeCommand(cmd, p, level!.goal);
        p = res.project;
      }
      const goal = evaluateGoal(p, level!.goal);
      expect(goal.solved, `${id}: ${goal.reasons.join('; ')}`).toBe(true);
      expect(p.commandCount).toBeLessThanOrEqual(level!.solution.length);
    });
  }

  it('intro_ls solves via mustRunCommand', () => {
    const level = getLevel('intro_ls')!;
    let p = createProject(level.start);
    p = executeCommand(level.solution[0], p, level.goal).project;
    expect(evaluateGoal(p, level.goal).solved).toBe(true);
  });

  it('sel_source solves via selectionEquals/includes', () => {
    const level = getLevel('sel_source')!;
    let p = createProject(level.start);
    p = executeCommand(level.solution[0], p, level.goal).project;
    const goal = evaluateGoal(p, level.goal);
    expect(goal.solved, goal.reasons.join('; ')).toBe(true);
  });
});

describe('sandbox', () => {
  it('creates a project with an extra intermediate model', () => {
    const p = createProject(sandboxSpec());
    expect(p.nodes.int_customer_order_summary).toBeTruthy();
  });
});
