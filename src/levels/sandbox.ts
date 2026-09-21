import type { LevelDef } from '../engine/types';
import { demoShopSpec } from './index';

/**
 * Sandbox project — slightly larger free-play DAG.
 */
export function sandboxSpec() {
  const base = demoShopSpec();
  return {
    ...base,
    nodes: [
      ...base.nodes,
      {
        id: 'int_customer_order_summary' as string,
        layer: 'intermediate' as const,
        materialization: 'view' as const,
        refs: ['stg_customers', 'fct_orders'],
        path: 'models/intermediate/int_customer_order_summary.sql',
        tags: ['core'],
      },
    ],
  };
}

export const sandboxLevel: LevelDef = {
  id: 'sandbox',
  sequence: 'sandbox',
  name: 'Sandbox',
  objective:
    'Free play. Type `help` for commands. Try selection operators against the demo shop DAG.',
  hint: 'help',
  solution: [],
  start: sandboxSpec(),
  goal: { builtMode: 'none' },
};
