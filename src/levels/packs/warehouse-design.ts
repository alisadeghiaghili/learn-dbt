import type { LevelDef } from '../../engine/types';

/**
 * Warehouse physical design: partition/cluster/merge strategy per dialect.
 */
export const warehouseLevels: LevelDef[] = [
  {
    id: 'wh_bq_partition',
    sequence: 'warehouse',
    name: 'BigQuery partition by date',
    objective:
      'On BigQuery, large facts should be **partitioned** by event date.\n\n' +
      'Set partition on `fct_orders`: `set config fct_orders partition=event_date wh=bq`',
    hint: 'set config fct_orders partition=event_date wh=bq',
    solution: ['warehouse bq', 'set config fct_orders partition=event_date wh=bq'],
    start: {
      warehouse: 'bq',
      nodes: [{ id: 'fct_orders', layer: 'mart', materialization: 'table', refs: [] }],
    },
    goal: {
      partitionBy: { fct_orders: 'event_date' },
      warehouseIs: 'bq',
    },
    learning: [
      'Partitioning cuts scanned bytes — the unit of BigQuery cost.',
      'Partition on the filter you always use (usually a date).',
    ],
    fieldNotes: ['Unpartitioned “SELECT * WHERE date=…” is how teams get $40k invoices.'],
  },
  {
    id: 'wh_bq_cluster',
    sequence: 'warehouse',
    name: 'BigQuery clustering',
    objective: 'Cluster `fct_orders` by `customer_id` for point lookups.',
    hint: 'set config fct_orders cluster=customer_id',
    solution: ['set config fct_orders cluster=customer_id'],
    start: {
      warehouse: 'bq',
      nodes: [
        {
          id: 'fct_orders',
          layer: 'mart',
          materialization: 'table',
          refs: [],
          partitionBy: 'event_date',
        },
      ],
    },
    goal: {
      clusterBy: { fct_orders: 'customer_id' },
    },
    learning: [
      'Clustering sorts within partitions — good for high-cardinality equality filters.',
      'Order columns by cardinality (high → low) in real BQ configs.',
    ],
  },
  {
    id: 'wh_snowflake_merge',
    sequence: 'warehouse',
    name: 'Snowflake merge keys',
    objective:
      'On Snowflake, incremental merge needs a **unique key** and merge strategy.\n\n' +
      '`warehouse snowflake` · `set config fct_orders strategy=merge unique=order_id wh=snowflake`',
    hint: 'set config fct_orders strategy=merge unique=order_id wh=snowflake',
    solution: [
      'warehouse snowflake',
      'set config fct_orders strategy=merge unique=order_id wh=snowflake',
    ],
    start: {
      warehouse: 'snowflake',
      nodes: [
        {
          id: 'fct_orders',
          layer: 'mart',
          materialization: 'incremental',
          incrementalStrategy: 'append',
          refs: [],
        },
      ],
    },
    goal: {
      incrementalStrategies: { fct_orders: 'merge' },
      warehouseIs: 'snowflake',
    },
    learning: [
      'Snowflake MERGE is upsert on match keys — wrong key = duplicates or lost updates.',
      'append is only safe for immutable event logs.',
    ],
  },
  {
    id: 'wh_redshift_sort',
    sequence: 'warehouse',
    name: 'Redshift dist/sort mindset',
    objective:
      'Declare warehouse `redshift` and cluster (sort) `fct_orders` by `event_date`.\n\n' +
      '`warehouse redshift` · `set config fct_orders cluster=event_date`',
    hint: 'warehouse redshift',
    solution: ['warehouse redshift', 'set config fct_orders cluster=event_date'],
    start: {
      warehouse: 'redshift',
      nodes: [{ id: 'fct_orders', layer: 'mart', materialization: 'table', refs: [] }],
    },
    goal: {
      warehouseIs: 'redshift',
      clusterBy: { fct_orders: 'event_date' },
    },
    learning: [
      'Redshift performance is distribution + sort keys — mental cousin of BQ cluster.',
      'Same logical model, different physical layer. Config is warehouse-specific.',
    ],
  },
  {
    id: 'wh_strategy_matrix',
    sequence: 'warehouse',
    name: 'Strategy × warehouse matrix',
    objective:
      'Set strategy `delete+insert` on a windowed incremental (billing month).\n\n' +
      '`set config fct_invoices strategy=delete+insert unique=invoice_id`',
    hint: 'set config fct_invoices strategy=delete+insert',
    solution: ['set config fct_invoices strategy=delete+insert unique=invoice_id'],
    start: {
      nodes: [
        {
          id: 'fct_invoices',
          layer: 'mart',
          materialization: 'incremental',
          refs: [],
        },
      ],
    },
    goal: {
      incrementalStrategies: { fct_invoices: 'delete+insert' },
    },
    learning: [
      'merge: keyed upsert. append: logs. delete+insert: replace a window. microbatch: time slices.',
      'Choose by idempotency, not by blog posts.',
    ],
    fieldNotes: ['Billing restatements are almost always delete+insert over the invoice month.'],
  },
  {
    id: 'wh_snapshot_config',
    sequence: 'warehouse',
    name: 'Snapshot config block',
    objective:
      'Configure a timestamp snapshot with `unique_key=customer_id` and `updated_at`.\n\n' +
      '`new snapshot snap_customers` · `set config snap_customers snap=timestamp snapconfig=unique_key=customer_id,updated_at=updated_at`',
    hint: 'set config snap_customers snap=timestamp snapconfig=...',
    solution: [
      'new snapshot snap_customers',
      'set config snap_customers snap=timestamp snapconfig=unique_key=customer_id,updated_at=updated_at',
    ],
    start: { nodes: [] },
    goal: {
      snapshots: ['snap_customers'],
      snapshotConfigs: { snap_customers: 'unique_key' },
    },
    learning: [
      'timestamp strategy: track row changes via updated_at + unique_key.',
      'check strategy: column list hash when there is no updated_at.',
    ],
  },
];

/**
 * Open-ended design: requirement text → correct DAG shape.
 */
export const designLevels: LevelDef[] = [
  {
    id: 'design_staging_mart',
    sequence: 'design',
    name: 'DESIGN: raw → staging → mart',
    objective:
      'Requirement: “We have raw.orders. Need a cleaned staging model and one mart for daily GMV.”\n\n' +
      'Create **at least**: `stg_orders` (staging) + `fct_daily_gmv` (mart) and wire refs properly.',
    hint: 'new model stg_orders layer=staging + new model fct_daily_gmv layer=mart',
    solution: [
      'new model stg_orders layer=staging mat=view',
      'edit model stg_orders source=raw.orders',
      'new model fct_daily_gmv layer=mart mat=table',
      'edit model fct_daily_gmv ref=stg_orders mat=table',
    ],
    start: {
      sources: [{ id: 'raw.orders', loaded: true }],
      nodes: [],
    },
    goal: {
      modelsExist: ['stg_orders', 'fct_daily_gmv'],
      designLayers: { staging: 1, mart: 1 },
      refs: { fct_daily_gmv: ['stg_orders'] },
      minTransferScore: 75,
    },
    learning: [
      'Every design question starts with grain and layers.',
      'staging 1:1 with source; mart answers a business question.',
    ],
    fieldNotes: ['In a design interview, draw the DAG before you write SQL.'],
  },
  {
    id: 'design_dim_fact',
    sequence: 'design',
    name: 'DESIGN: customer dimension',
    objective:
      'Requirement: “Marketing needs customer attributes for segmentation alongside orders.”\n\n' +
      'Design `stg_customers` + `dim_customers` and keep `fct_orders` at order grain (separate fact).',
    hint: 'dim from stg_customers, fact stays orders',
    solution: [
      'new model stg_customers layer=staging mat=view',
      'edit model stg_customers source=raw.customers',
      'new model dim_customers layer=mart mat=table',
      'edit model dim_customers ref=stg_customers mat=table',
      'new model fct_orders layer=mart mat=table',
      'edit model fct_orders ref=stg_customers mat=table',
    ],
    start: {
      sources: [
        { id: 'raw.customers', loaded: true },
        { id: 'raw.orders', loaded: true },
      ],
      nodes: [],
    },
    goal: {
      modelsExist: ['dim_customers', 'fct_orders', 'stg_customers'],
      designLayers: { staging: 1, mart: 2 },
    },
    learning: [
      'Do not stuff customer attributes into the order fact — that is a dimension.',
      'Facts and dims join on keys; each owns its grain.',
    ],
  },
  {
    id: 'design_intermediate',
    sequence: 'design',
    name: 'DESIGN: intermediate reshape',
    objective:
      'Requirement: “Payments arrive as multiple rows per order; finance wants one row per order with totals.”\n\n' +
      'Use an **intermediate** model to pivot/aggregate, then a mart on top.',
    hint: 'int_order_payments then fct_orders',
    solution: [
      'new model stg_orders layer=staging mat=view',
      'edit model stg_orders source=raw.orders',
      'new model int_order_payments layer=intermediate mat=ephemeral',
      'edit model int_order_payments ref=stg_orders mat=ephemeral',
      'new model fct_orders layer=mart mat=table',
      'edit model fct_orders ref=int_order_payments mat=table',
    ],
    start: {
      sources: [{ id: 'raw.orders', loaded: true }],
      nodes: [],
    },
    goal: {
      designLayers: { staging: 1, intermediate: 1, mart: 1 },
      modelsExist: ['int_order_payments', 'fct_orders'],
      minTransferScore: 90,
    },
    learning: [
      'Intermediate is for reshapes too heavy for staging.',
      'If nobody queries the intermediate, keep it ephemeral.',
    ],
  },
  {
    id: 'design_exposure_sli',
    sequence: 'design',
    name: 'DESIGN: consumer + SLI',
    objective:
      'Requirement: “Exec dashboard must not silently break. Need a revenue mart from orders.”\n\n' +
      'Create staging + `mart_revenue` + exposure + a unique test (SLI).',
    hint: 'stg + mart + exposure + unique test',
    solution: [
      'new model stg_orders layer=staging mat=view',
      'edit model stg_orders source=raw.orders',
      'new model mart_revenue layer=mart mat=table',
      'edit model mart_revenue ref=stg_orders mat=table',
      'add test unique mart_revenue col=date_key',
      'exposure add exec_dash type=dashboard ref=mart_revenue',
    ],
    start: {
      sources: [{ id: 'raw.orders', loaded: true }],
      nodes: [],
    },
    goal: {
      modelsExist: ['mart_revenue'],
      designLayers: { mart: 1 },
      exposures: ['exec_dash'],
      testsDefined: [{ model: 'mart_revenue', type: 'unique' }],
    },
    learning: [
      'A mart without a consumer declaration is unowned risk.',
      'SLI = the test that would catch the last incident.',
    ],
  },
  {
    id: 'design_full_layer_cake',
    sequence: 'design',
    name: 'DESIGN: full layer cake',
    objective:
      'Requirement: “Orders + payments + customers → finance mart with history.”\n\n' +
      'Minimum design: staging×2, intermediate×1, mart×1, snapshot×1.',
    hint: 'staging, intermediate, mart, snapshot',
    solution: [
      'new model stg_orders layer=staging mat=view',
      'edit model stg_orders source=raw.orders',
      'new model stg_customers layer=staging mat=view',
      'edit model stg_customers source=raw.customers',
      'new model int_order_customer layer=intermediate mat=view',
      'edit model int_order_customer ref=stg_orders mat=view',
      'new model fct_orders layer=mart mat=table',
      'edit model fct_orders ref=int_order_customer mat=table',
      'new snapshot snap_customers',
    ],
    start: {
      sources: [
        { id: 'raw.orders', loaded: true },
        { id: 'raw.customers', loaded: true },
      ],
      nodes: [],
    },
    goal: {
      designLayers: { staging: 2, intermediate: 1, mart: 1 },
      snapshots: ['snap_customers'],
    },
    learning: [
      'This is the standard analytics engineering layer cake.',
      'Snapshots ride beside models — history is not a model materialization.',
    ],
    fieldNotes: ['Whiteboard this in 3 minutes and you pass most AE design screens.'],
  },
];

/**
 * Timed graded exams with rubric points shown in the UI.
 */
export const examLevels: LevelDef[] = [
  {
    id: 'exam_01_sprint',
    sequence: 'exam',
    name: 'EXAM 1 — 3-minute sprint',
    timeLimitSec: 180,
    rubric: [
      { id: 'model_staging', label: 'Staging model created', points: 25 },
      { id: 'model_mart', label: 'Mart with ref()', points: 25 },
      { id: 'test_unique', label: 'unique test on PK', points: 25 },
      { id: 'docs', label: 'docs generate', points: 25 },
    ],
    objective:
      'TIMED (3 min). From empty project: staging from raw.orders, mart with ref, unique test, docs generate.\n\n' +
      'Score is shown after solve — rubric is 100 points.',
    hint: 'stg → fct → unique → docs',
    solution: [
      'new model stg_orders layer=staging mat=view',
      'edit model stg_orders source=raw.orders',
      'new model fct_orders layer=mart mat=table',
      'edit model fct_orders ref=stg_orders mat=table',
      'add test unique fct_orders col=order_id',
      'dbt docs generate',
    ],
    start: {
      sources: [{ id: 'raw.orders', loaded: true }],
      nodes: [],
      deadlineSeconds: 180,
    },
    goal: {
      modelsExist: ['stg_orders', 'fct_orders'],
      refs: { fct_orders: ['stg_orders'] },
      testsDefined: [{ model: 'fct_orders', type: 'unique', column: 'order_id' }],
      docsBuilt: true,
    },
    learning: [
      'Time pressure exposes whether you know the path or only recognize it.',
    ],
  },
  {
    id: 'exam_02_production',
    sequence: 'exam',
    name: 'EXAM 2 — production readiness',
    timeLimitSec: 300,
    rubric: [
      { id: 'model_grain', label: 'fact + dim grain', points: 20 },
      { id: 'test_pack', label: 'unique + not_null', points: 20 },
      { id: 'contract', label: 'model contract', points: 20 },
      { id: 'ci', label: 'ci save/restore + slim', points: 20 },
      { id: 'diag', label: 'diagnosis note', points: 20 },
    ],
    objective:
      'TIMED (5 min). Build production-ready pipeline: fact+dim, tests, contract, ci save/restore, status:modified+, diagnose one issue.\n\n' +
      '100-point rubric in the result dialog.',
    hint: 'fact/dim → tests → contract → ci → diagnose',
    solution: [
      'new model stg_orders layer=staging mat=view',
      'edit model stg_orders source=raw.orders',
      'new model stg_customers layer=staging mat=view',
      'edit model stg_customers source=raw.customers',
      'new model fct_orders layer=mart mat=table',
      'edit model fct_orders ref=stg_orders mat=table',
      'new model dim_customers layer=mart mat=table',
      'edit model dim_customers ref=stg_customers mat=table',
      'add test unique fct_orders col=order_id',
      'add test not_null fct_orders col=order_id',
      'set config fct_orders contract=true cols=order_id,amount',
      'diagnose grain unique order_id',
      'ci save',
      'ci restore',
      'dbt run --select status:modified+',
    ],
    start: {
      sources: [
        { id: 'raw.orders', loaded: true },
        { id: 'raw.customers', loaded: true },
      ],
      nodes: [],
      deadlineSeconds: 300,
      warehouse: 'bq',
    },
    goal: {
      modelsExist: ['stg_orders', 'stg_customers', 'fct_orders', 'dim_customers'],
      designLayers: { staging: 2, mart: 2 },
      testsDefined: [
        { model: 'fct_orders', type: 'unique', column: 'order_id' },
        { model: 'fct_orders', type: 'not_null', column: 'order_id' },
      ],
      contracts: ['fct_orders'],
      minDiagnoses: 1,
      ciSaved: true,
      mustRunCommand: 'status:modified',
    },
    learning: [
      'This is the bar for “ready to own a production DAG”.',
    ],
    fieldNotes: ['If you need the full 5 minutes, rehearse the path again tomorrow.'],
  },
];
