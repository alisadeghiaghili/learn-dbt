import { describe, expect, it } from 'vitest';
import { createProject } from '../src/engine/project';
import { executeCommand } from '../src/engine/commands';
import { evaluateGoal } from '../src/engine/compare';
import { allLevels } from '../src/levels';
import { parseSql, compileSql } from '../src/engine/sql';

describe('curriculum packs solvable by canonical solution', () => {
  const packs = allLevels.filter((l) =>
    ['foundation', 'testing', 'jinja', 'modeling'].includes(l.sequence),
  );

  it('packs contain expected volume', () => {
    expect(packs.length).toBeGreaterThanOrEqual(20);
  });

  for (const level of packs) {
    it(`solves ${level.id}`, () => {
      let p = createProject(level.start);
      for (const cmd of level.solution) {
        p = executeCommand(cmd, p, level.goal).project;
      }
      const goal = evaluateGoal(p, level.goal);
      expect(goal.solved, `${level.id}: ${goal.reasons.join('; ')}`).toBe(true);
    });
  }

  it('every pack level has learning objectives', () => {
    for (const level of packs) {
      expect(level.learning?.length ?? 0, level.id).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('sql parse/compile', () => {
  it('extracts ref and source lineage', () => {
    const p = parseSql("select * from {{ ref('stg_orders') }} join {{ source('raw', 'orders') }}");
    expect(p.refs).toEqual(['stg_orders']);
    expect(p.sourceRefs).toEqual(['raw.orders']);
  });

  it('compiles refs and vars', () => {
    const out = compileSql("select * from {{ ref('x') }} where d = {{ var('start_date') }}", {
      start_date: '2024-01-01',
    }, 'dev');
    expect(out).toContain('"dev"."x"');
    expect(out).toContain('2024-01-01');
  });
});

describe('authoring commands', () => {
  it('creates model and derives refs from sql', () => {
    let p = createProject({
      nodes: [{ id: 'stg', layer: 'staging', materialization: 'view' }],
    });
    p = executeCommand(
      `new model fct layer=mart mat=table sql=select * from {{ ref('stg') }}`,
      p,
    ).project;
    expect(p.nodes.fct?.refs).toEqual(['stg']);
  });

  it('rejects unknown refs at edit time', () => {
    let p = createProject({ nodes: [] });
    p = executeCommand('new model a layer=staging mat=view', p).project;
    const res = executeCommand("edit model a sql=select * from {{ ref('missing') }}", p);
    expect(res.logs.some((l) => l.kind === 'err')).toBe(true);
  });
});
