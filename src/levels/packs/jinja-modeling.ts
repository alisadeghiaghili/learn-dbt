import type { LevelDef } from '../../engine/types';

const base = {
  sources: [{ id: 'raw.orders', loaded: true }],
  nodes: [
    {
      id: 'stg_orders',
      layer: 'staging' as const,
      materialization: 'view' as const,
      sourceRefs: ['raw.orders'],
    },
    {
      id: 'fct_orders',
      layer: 'mart' as const,
      materialization: 'incremental' as const,
      refs: ['stg_orders'],
      incrementalStrategy: 'append' as const,
      uniqueKey: 'order_id',
    },
    {
      id: 'dim_customers',
      layer: 'mart' as const,
      materialization: 'table' as const,
      refs: ['stg_orders'],
      owner: 'analytics-eng',
    },
    {
      id: 'mart_revenue',
      layer: 'mart' as const,
      materialization: 'table' as const,
      refs: ['fct_orders'],
    },
  ],
};

/**
 * Jinja, macros, packages, vars, exposures, docs.
 */
export const jinjaLevels: LevelDef[] = [
  {
    id: 'jinja_var',
    sequence: 'jinja',
    name: 'vars() for runtime config',
    objective: 'Set `start_date=2024-01-01` with `var start_date=2024-01-01` — then compile and use it in SQL.',
    hint: 'var start_date=2024-01-01',
    solution: ['var start_date=2024-01-01'],
    start: base,
    goal: { varsSet: { start_date: '2024-01-01' } },
    learning: [
      'vars are CLI/CI-configurable inputs — not secrets.',
      'Hard-coded dates in models make backfills a rewrite project.',
    ],
  },
  {
    id: 'jinja_macro',
    sequence: 'jinja',
    name: 'Macro = reusable SQL',
    objective: 'Define macro `cents_to_dollars` with `macro add cents_to_dollars amount / 100.0`.',
    hint: 'macro add cents_to_dollars amount / 100.0',
    solution: ['macro add cents_to_dollars amount / 100.0'],
    start: base,
    goal: { macrosDefined: ['cents_to_dollars'] },
    learning: [
      'Macros package transformation logic you refuse to copy-paste.',
      'If two models share 10 lines of cleaning, it is a macro.',
    ],
  },
  {
    id: 'jinja_use_macro',
    sequence: 'jinja',
    name: 'Call the macro in a model',
    objective:
      'Update `fct_orders` SQL to call the macro: must contain `cents_to_dollars`.\n\n' +
      '`edit model fct_orders ref=stg_orders sql=select cents_to_dollars from {{ ref(stg_orders) }}`',
    hint: 'edit model fct_orders with sql containing cents_to_dollars',
    solution: [
      'macro add cents_to_dollars amount / 100.0',
      'edit model fct_orders sql=select {{ cents_to_dollars }} as amount from {{ ref(stg_orders) }} ref=stg_orders',
    ],
    start: base,
    goal: {
      macrosDefined: ['cents_to_dollars'],
      sqlContains: { fct_orders: 'cents_to_dollars' },
    },
    learning: ['Macro call sites create implicit dependencies the DAG may not show as edges.'],
  },
  {
    id: 'jinja_package',
    sequence: 'jinja',
    name: 'Packages',
    objective: 'Install `dbt_utils` with `deps dbt_utils` (or `dbt deps dbt_utils`).',
    hint: 'deps dbt_utils',
    solution: ['deps dbt_utils'],
    start: base,
    goal: { packagesInstalled: ['dbt_utils'] },
    learning: [
      'Prefer well-tested packages over homemade tests/macro sprawl.',
      'Pin package versions in packages.yml in real projects.',
    ],
    fieldNotes: ['Unpinned dbt_utils in prod is a supply-chain incident waiting for a Tuesday.'],
  },
  {
    id: 'jinja_incr_strategy',
    sequence: 'jinja',
    name: 'Incremental strategy',
    objective: 'Set `fct_orders` strategy to **merge** with unique key `order_id`.',
    hint: 'set config fct_orders strategy=merge unique=order_id',
    solution: ['set config fct_orders strategy=merge unique=order_id'],
    start: base,
    goal: {
      incrementalStrategies: { fct_orders: 'merge' },
    },
    learning: [
      'append is one-way (good for logs). merge upserts on unique key (good for orders).',
      'delete+insert replaces a window. microbatch isolates time slices.',
      'Wrong strategy = duplicate facts or lost updates.',
    ],
  },
  {
    id: 'jinja_exposure',
    sequence: 'jinja',
    name: 'Exposures',
    objective:
      'Declare exposure `exec_kpi_dashboard` depending on `mart_revenue`.\n\n`exposure add exec_kpi_dashboard type=dashboard ref=mart_revenue`',
    hint: 'exposure add exec_kpi_dashboard type=dashboard ref=mart_revenue',
    solution: ['exposure add exec_kpi_dashboard type=dashboard ref=mart_revenue'],
    start: base,
    goal: { exposures: ['exec_kpi_dashboard'] },
    learning: [
      'Exposures document consumers (BI, ML, app) at the end of the DAG.',
      'When a mart breaks, exposure = who gets paged.',
    ],
  },
  {
    id: 'jinja_docs',
    sequence: 'jinja',
    name: 'Documentation',
    objective:
      'Describe models then run `dbt docs generate`.\n\n`set config fct_orders desc=Orders fact table at order grain` then `dbt docs generate`',
    hint: 'set config fct_orders desc=... then dbt docs generate',
    solution: [
      'set config fct_orders desc=Orders fact table at order grain',
      'dbt docs generate',
    ],
    start: base,
    goal: { docsBuilt: true },
    learning: [
      'docs generate builds the lineage catalog from your project.',
      'Undocumented marts become tribal knowledge — and then a single point of failure.',
    ],
  },
  {
    id: 'jinja_compile_vars',
    sequence: 'jinja',
    name: 'Compile with vars',
    objective: 'Set var and compile — see `{{ var() }}` resolve in output.',
    hint: 'var region=eu then dbt compile',
    solution: ['var region=eu', 'dbt compile'],
    start: {
      ...base,
      nodes: base.nodes.map((n) =>
        n.id === 'fct_orders'
          ? { ...n, sql: "select * from {{ ref('stg_orders') }} where region = {{ var('region') }}" }
          : n,
      ),
    },
    goal: {
      varsSet: { region: 'eu' },
      mustRunCommand: 'compile',
    },
    learning: ['Compile is the debugger for Jinja. If compile is wrong, the warehouse cannot save you.'],
  },
];

/**
 * Modeling theory + production ops (targets, slim CI already covered, capstone).
 */
export const modelingLevels: LevelDef[] = [
  {
    id: 'model_layers',
    sequence: 'modeling',
    name: 'Layer boundaries',
    objective:
      'Ensure `fct_orders` refs only `stg_orders` (staging) — not raw sources.\n\nEdit refs if needed.',
    hint: 'edit model fct_orders ref=stg_orders',
    solution: ['edit model fct_orders ref=stg_orders'],
    start: {
      sources: [{ id: 'raw.orders', loaded: true }],
      nodes: [
        {
          id: 'stg_orders',
          layer: 'staging',
          materialization: 'view',
          sourceRefs: ['raw.orders'],
        },
        {
          id: 'fct_orders',
          layer: 'mart',
          materialization: 'table',
          sourceRefs: ['raw.orders'],
          refs: [],
        },
      ],
    },
    goal: {
      refs: { fct_orders: ['stg_orders'] },
    },
    learning: [
      'marts must not read raw — staging is the contract with the source world.',
      'Layering is what makes renames and source swaps survivable.',
    ],
  },
  {
    id: 'model_fact_dim',
    sequence: 'modeling',
    name: 'Fact vs dimension',
    objective:
      'Create `dim_customers` (table) from `stg_customers` and keep `fct_orders` at **order grain**.\n\n' +
      '`new model dim_customers layer=mart mat=table` + `edit model dim_customers ref=stg_customers mat=table`',
    hint: 'new model dim_customers layer=mart mat=table',
    solution: [
      'new model dim_customers layer=mart mat=table',
      'edit model dim_customers ref=stg_customers mat=table',
    ],
    start: {
      sources: [
        { id: 'raw.orders', loaded: true },
        { id: 'raw.customers', loaded: true },
      ],
      nodes: [
        {
          id: 'stg_orders',
          layer: 'staging',
          materialization: 'view',
          sourceRefs: ['raw.orders'],
        },
        {
          id: 'stg_customers',
          layer: 'staging',
          materialization: 'view',
          sourceRefs: ['raw.customers'],
        },
        {
          id: 'fct_orders',
          layer: 'mart',
          materialization: 'table',
          refs: ['stg_orders'],
        },
      ],
    },
    goal: {
      modelsExist: ['dim_customers'],
      refs: { dim_customers: ['stg_customers'] },
    },
    learning: [
      'Facts are events/measures at a clear grain. Dimensions are who/what/context.',
      'Mixing both in one table (OBT) is a tradeoff — do it deliberately.',
    ],
    fieldNotes: ['Ask “what is the grain?” in every model PR. No grain, no merge.'],
  },
  {
    id: 'model_owner',
    sequence: 'modeling',
    name: 'Ownership',
    objective: 'Set owner `analytics-eng` on `dim_customers` via `set config dim_customers owner=analytics-eng`.',
    hint: 'set config dim_customers owner=analytics-eng',
    solution: ['set config dim_customers owner=analytics-eng'],
    start: {
      sources: [{ id: 'raw.customers', loaded: true }],
      nodes: [
        {
          id: 'dim_customers',
          layer: 'mart',
          materialization: 'table',
          refs: [],
          sourceRefs: ['raw.customers'],
        },
      ],
    },
    goal: { modelsExist: ['dim_customers'] },
    learning: ['Unowned models rot. Ownership is an operational requirement.'],
  },
  {
    id: 'ops_target',
    sequence: 'modeling',
    name: 'Targets and environments',
    objective: 'Switch to prod target: `target use prod`.',
    hint: 'target use prod',
    solution: ['target use prod'],
    start: base,
    goal: { mustRunCommand: 'target use prod' },
    learning: [
      'dev/staging/prod are schemas (or projects), not feelings.',
      'Never point dbt at prod credentials to “test quickly”.',
    ],
  },
  {
    id: 'capstone_pipeline',
    sequence: 'modeling',
    name: 'Capstone: analytics pipeline',
    objective:
      'Build a full path: staging (source) → fact (merge incremental) → mart with tests → exposure → docs.\n\n' +
      'Minimum checks: model exists with refs, incremental strategy merge, unique test, exposure, docs generated.',
    hint: 'stg + fct + tests + exposure + docs',
    solution: [
      'new model stg_orders layer=staging mat=view',
      'edit model stg_orders source=raw.orders',
      'new model fct_orders layer=mart mat=incremental',
      'edit model fct_orders ref=stg_orders mat=incremental strategy=merge unique=order_id',
      'add test unique fct_orders col=order_id',
      'add test not_null fct_orders col=order_id',
      'exposure add exec_kpi type=dashboard ref=fct_orders',
      'set config fct_orders desc=Order grain fact',
      'dbt docs generate',
      'dbt build --select +fct_orders',
    ],
    start: {
      sources: [{ id: 'raw.orders', loaded: true }],
      nodes: [],
    },
    goal: {
      modelsExist: ['stg_orders', 'fct_orders'],
      refs: { fct_orders: ['stg_orders'] },
      incrementalStrategies: { fct_orders: 'merge' },
      testsDefined: [
        { model: 'fct_orders', type: 'unique', column: 'order_id' },
        { model: 'fct_orders', type: 'not_null', column: 'order_id' },
      ],
      exposures: ['exec_kpi'],
      docsBuilt: true,
    },
    learning: [
      'This is the weekly job of an analytics engineer — end to end.',
      'Grain, tests, strategy, consumer, docs — all five are the definition of done.',
    ],
    fieldNotes: [
      'Capstone interview drill: walk someone through why each piece exists. If you cannot, you typed commands, not owned a pipeline.',
    ],
  },
];
