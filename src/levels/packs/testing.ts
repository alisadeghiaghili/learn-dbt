import type { LevelDef } from '../../engine/types';

const shop = {
  sources: [
    { id: 'raw.orders', loaded: true },
    { id: 'raw.customers', loaded: true },
  ],
  nodes: [
    {
      id: 'stg_orders',
      layer: 'staging' as const,
      materialization: 'view' as const,
      sourceRefs: ['raw.orders'],
      sql: "select * from {{ source('raw', 'orders') }}",
    },
    {
      id: 'stg_customers',
      layer: 'staging' as const,
      materialization: 'view' as const,
      sourceRefs: ['raw.customers'],
      sql: "select * from {{ source('raw', 'customers') }}",
    },
    {
      id: 'fct_orders',
      layer: 'mart' as const,
      materialization: 'table' as const,
      refs: ['stg_orders'],
      sql: "select * from {{ ref('stg_orders') }}",
    },
    {
      id: 'dim_customers',
      layer: 'mart' as const,
      materialization: 'table' as const,
      refs: ['stg_customers', 'fct_orders'],
      sql: "select * from {{ ref('stg_customers') }} join {{ ref('fct_orders') }} using (customer_id)",
    },
    {
      id: 'seed_country_codes',
      layer: 'seed' as const,
      materialization: 'seed' as const,
    },
  ],
};

/**
 * Testing, contracts, snapshots, freshness.
 */
export const testingLevels: LevelDef[] = [
  {
    id: 'test_unique',
    sequence: 'testing',
    name: 'Primary key is a contract',
    objective:
      'Add a **unique** test on `stg_orders.order_id`.\n\n`add test unique stg_orders col=order_id`',
    hint: 'add test unique stg_orders col=order_id',
    solution: ['add test unique stg_orders col=order_id'],
    start: shop,
    goal: {
      testsDefined: [{ model: 'stg_orders', type: 'unique', column: 'order_id' }],
    },
    learning: [
      'Grain without a unique test is a wish. unique() enforces one row per key.',
      'Put PK tests in staging — fail early, before marts cache the lie.',
    ],
    fieldNotes: ['Duplicate order_id in staging has shipped wrong GMV more times than schema changes.'],
  },
  {
    id: 'test_not_null',
    sequence: 'testing',
    name: 'Required fields',
    objective:
      'Add **not_null** on `fct_orders.order_id` (and keep unique on staging).\n\n`add test not_null fct_orders col=order_id`',
    hint: 'add test not_null fct_orders col=order_id',
    solution: ['add test not_null fct_orders col=order_id'],
    start: {
      ...shop,
      nodes: shop.nodes.map((n) =>
        n.id === 'stg_orders'
          ? {
              ...n,
              tests: [{ type: 'unique' as const, column: 'order_id', severity: 'error' as const }],
            }
          : n,
      ),
    },
    goal: {
      testsDefined: [
        { model: 'stg_orders', type: 'unique', column: 'order_id' },
        { model: 'fct_orders', type: 'not_null', column: 'order_id' },
      ],
    },
    learning: [
      'not_null protects measures and join keys from silent aggregation drops.',
      'Null keys do not fail SQL — they fail dashboards quietly.',
    ],
  },
  {
    id: 'test_relationships',
    sequence: 'testing',
    name: 'Referential integrity',
    objective:
      'Add a **relationships** test: `dim_customers.customer_id` → `stg_customers.customer_id`.\n\n`add test relationships dim_customers col=customer_id to=stg_customers`',
    hint: 'add test relationships dim_customers col=customer_id to=stg_customers',
    solution: ['add test relationships dim_customers col=customer_id to=stg_customers'],
    start: shop,
    goal: {
      testsDefined: [{ model: 'dim_customers', type: 'relationships', column: 'customer_id' }],
    },
    learning: [
      'relationships() is a foreign key check across models.',
      'Fan-out and orphan FKs are the classic fact-table disasters.',
    ],
  },
  {
    id: 'test_accepted_values',
    sequence: 'testing',
    name: 'Enumerate the domain',
    objective:
      'Add **accepted_values** on `fct_orders.status` with `config=placed|shipped|canceled`.\n\n' +
      '`add test accepted_values fct_orders col=status config=placed|shipped|canceled`',
    hint: 'add test accepted_values fct_orders col=status config=placed|shipped|canceled',
    solution: ['add test accepted_values fct_orders col=status config=placed|shipped|canceled'],
    start: shop,
    goal: {
      testsDefined: [{ model: 'fct_orders', type: 'accepted_values', column: 'status' }],
    },
    learning: [
      'If the business enum is closed, the test should be too.',
      'Open enums (free text) need different tests — do not fake safety.',
    ],
  },
  {
    id: 'test_severity',
    sequence: 'testing',
    name: 'warn vs error',
    objective:
      'Keep unique as **error**, but make relationships **warn** so CI does not hard-block dirty CRM data.\n\n' +
      '`add test relationships dim_customers col=customer_id to=stg_customers severity=warn`',
    hint: 'add test relationships dim_customers col=customer_id to=stg_customers severity=warn',
    solution: ['add test relationships dim_customers col=customer_id to=stg_customers severity=warn'],
    start: {
      ...shop,
      nodes: shop.nodes.map((n) =>
        n.id === 'stg_orders'
          ? { ...n, tests: [{ type: 'unique' as const, column: 'order_id', severity: 'error' as const }] }
          : n,
      ),
    },
    goal: {
      testsDefined: [{ model: 'dim_customers', type: 'relationships', column: 'customer_id' }],
    },
    learning: [
      'error blocks the build; warn is visible but non-fatal.',
      'Severity is a product decision: what is allowed to be slightly wrong overnight?',
    ],
    fieldNotes: ['Never mark revenue-critical tests warn “so CI is green”. That is how trust dies.'],
  },
  {
    id: 'test_contract',
    sequence: 'testing',
    name: 'Model contracts',
    objective:
      'Enforce a **contract** on `fct_orders` and declare columns `order_id,customer_id,amount`.\n\n' +
      '`set config fct_orders contract=true cols=order_id,customer_id,amount`',
    hint: 'set config fct_orders contract=true cols=order_id,customer_id,amount',
    solution: ['set config fct_orders contract=true cols=order_id,customer_id,amount'],
    start: shop,
    goal: {
      contracts: ['fct_orders'],
    },
    learning: [
      'Contracts freeze the interface (name/type) between teams.',
      'Breaking a contract should fail CI, not surprise BI.',
    ],
    fieldNotes: ['Contracts turn “it ran” into “it still matches the promise”.'],
  },
  {
    id: 'test_build_gates',
    sequence: 'testing',
    name: 'build is the gate',
    objective: 'Run `dbt build --select +fct_orders` so tests execute in the same pass as models.',
    hint: 'dbt build --select +fct_orders',
    solution: ['dbt build --select +fct_orders'],
    start: {
      ...shop,
      nodes: shop.nodes.map((n) =>
        n.id === 'stg_orders'
          ? { ...n, tests: [{ type: 'unique' as const, column: 'order_id', severity: 'error' as const }] }
          : n,
      ),
    },
    goal: {
      builtMode: 'atLeast',
      built: ['stg_orders', 'fct_orders'],
      testsPassed: ['stg_orders.unique'],
    },
    learning: ['dbt build interleaves run+test in DAG order — this is your merge gate.'],
  },
  {
    id: 'snap_scd',
    sequence: 'testing',
    name: 'Snapshots (SCD)',
    objective:
      'Create a snapshot `snap_customers` and run `dbt snapshot`.\n\n`new snapshot snap_customers` then `dbt snapshot`',
    hint: 'new snapshot snap_customers',
    solution: ['new snapshot snap_customers', 'dbt snapshot'],
    start: {
      ...shop,
      nodes: shop.nodes.filter((n) => n.id !== 'seed_country_codes'),
    },
    goal: {
      snapshots: ['snap_customers'],
      builtMode: 'atLeast',
    },
    learning: [
      'Models show current state. Snapshots record history (SCD type 2).',
      'Use timestamp or check strategy to detect changes.',
      'Dimensions that change slowly (customer segment) need snapshots.',
    ],
  },
  {
    id: 'snap_seed',
    sequence: 'testing',
    name: 'Seeds are data files',
    objective: 'Materialize the seed `seed_country_codes` with `dbt seed`.',
    hint: 'dbt seed',
    solution: ['dbt seed'],
    start: shop,
    goal: {
      built: ['seed_country_codes'],
      builtMode: 'atLeast',
    },
    learning: [
      'Seeds are small CSVs versioned in git — lookup tables, plan data.',
      'Do not put million-row extracts in seeds; that is an extract job.',
    ],
  },
  {
    id: 'snap_freshness',
    sequence: 'testing',
    name: 'Source freshness',
    objective: 'Run `dbt source freshness` and reason about SLA on raw feeds.',
    hint: 'dbt source freshness',
    solution: ['dbt source freshness'],
    start: shop,
    goal: { mustRunCommand: 'freshness' },
    learning: [
      'Freshness asks: is raw data late? Not: is the model correct.',
      'Set warn/error thresholds per feed from the actual SLA.',
    ],
    fieldNotes: ['A green model over stale raw is a silent wrong number.'],
  },
];
