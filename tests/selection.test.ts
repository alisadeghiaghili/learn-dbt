import { describe, expect, it } from 'vitest';
import { createProject } from '../src/engine/project';
import { expandSelector, resolveSelection } from '../src/engine/selection';
import { ancestors, descendants, buildGraph, topoSort } from '../src/engine/graph';
import { demoShopSpec } from '../src/levels';

function project() {
  return createProject(demoShopSpec());
}

describe('graph', () => {
  it('computes ancestors of a mart', () => {
    const p = project();
    const { parents } = buildGraph(p);
    const anc = ancestors('fct_orders', parents);
    expect(anc.has('stg_orders')).toBe(true);
    expect(anc.has('int_order_payments')).toBe(true);
    expect(anc.has('raw.orders')).toBe(true);
    expect(anc.has('fct_orders')).toBe(false);
  });

  it('computes descendants of staging', () => {
    const p = project();
    const { children } = buildGraph(p);
    const desc = descendants('stg_orders', children);
    expect(desc.has('fct_orders')).toBe(true);
    expect(desc.has('dim_customers')).toBe(true);
    expect(desc.has('stg_customers')).toBe(false);
  });

  it('topologically sorts dependencies first', () => {
    const p = project();
    const { parents } = buildGraph(p);
    const order = topoSort(['fct_orders', 'stg_orders', 'int_order_payments'], parents);
    expect(order.indexOf('stg_orders')).toBeLessThan(order.indexOf('int_order_payments'));
    expect(order.indexOf('int_order_payments')).toBeLessThan(order.indexOf('fct_orders'));
  });
});

describe('selection', () => {
  it('selects exact model', () => {
    const p = project();
    expect([...expandSelector('stg_orders', p)].sort()).toEqual(['stg_orders']);
  });

  it('+model includes ancestors', () => {
    const p = project();
    const sel = expandSelector('+fct_orders', p);
    expect(sel.has('fct_orders')).toBe(true);
    expect(sel.has('stg_orders')).toBe(true);
    expect(sel.has('dim_customers')).toBe(false);
  });

  it('model+ includes descendants', () => {
    const p = project();
    const sel = expandSelector('stg_orders+', p);
    expect(sel.has('stg_orders')).toBe(true);
    expect(sel.has('fct_orders')).toBe(true);
    expect(sel.has('stg_customers')).toBe(false);
  });

  it('+model+ includes both sides', () => {
    const p = project();
    const sel = expandSelector('+stg_orders+', p);
    expect(sel.has('raw.orders')).toBe(true);
    expect(sel.has('mart_daily_revenue')).toBe(true);
  });

  it('@model includes parents of children', () => {
    const p = project();
    const sel = expandSelector('@fct_orders', p);
    // children of fct_orders: dim_customers, mart_daily_revenue
    // parents of those children include stg_customers, stg_payments
    expect(sel.has('fct_orders')).toBe(true);
    expect(sel.has('dim_customers')).toBe(true);
    expect(sel.has('mart_daily_revenue')).toBe(true);
    expect(sel.has('stg_customers')).toBe(true);
    expect(sel.has('stg_payments')).toBe(true);
  });

  it('tag: selects tagged nodes only', () => {
    const p = project();
    const sel = expandSelector('tag:finance', p);
    expect([...sel].sort()).toEqual(['fct_orders', 'int_order_payments', 'mart_daily_revenue']);
  });

  it('path: selects staging folder', () => {
    const p = project();
    const sel = expandSelector('path:models/staging', p);
    expect([...sel].sort()).toEqual(['stg_customers', 'stg_orders', 'stg_payments']);
  });

  it('source:table selects source; source:name+ expands downstream', () => {
    const p = project();
    expect([...expandSelector('source:raw.payments', p)]).toEqual(['raw.payments']);
    const desc = expandSelector('source:raw.payments+', p);
    expect(desc.has('stg_payments')).toBe(true);
    expect(desc.has('mart_daily_revenue')).toBe(true);
  });

  it('exclude removes from union', () => {
    const p = project();
    const sel = resolveSelection(['+dim_customers'], ['mart_daily_revenue'], p);
    expect(sel).not.toContain('mart_daily_revenue');
    expect(sel).toContain('dim_customers');
    expect(sel).toContain('stg_orders');
  });
});
