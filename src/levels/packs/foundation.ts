import type { LevelDef } from '../../engine/types';

const emptyShop = {
  sources: [
    { id: 'raw.orders', loaded: true },
    { id: 'raw.customers', loaded: true },
    { id: 'raw.payments', loaded: true },
  ],
  nodes: [] as never[],
};

/**
 * Foundation: writing models, refs, grain, staging rules.
 */
export const foundationLevels: LevelDef[] = [
  {
    id: 'found_create_model',
    sequence: 'foundation',
    name: 'Create a staging model',
    objective:
      'Create `stg_orders` as a **view** that selects from `raw.orders` using `source()`.\n\n' +
      'Command shape:\n`new model stg_orders layer=staging mat=view sql=select * from {{ source(raw,orders) }}`\n\n' +
      'Or: `new model stg_orders layer=staging mat=view` then `edit model stg_orders source=raw.orders`',
    hint: 'edit model stg_orders source=raw.orders',
    solution: ['new model stg_orders layer=staging mat=view', 'edit model stg_orders source=raw.orders'],
    start: emptyShop,
    goal: {
      modelsExist: ['stg_orders'],
      materializations: { stg_orders: 'view' },
      refs: { stg_orders: [] },
    },
    learning: [
      'Staging models are 1:1 with source tables and only rename/clean.',
      'source() declares lineage to raw tables; ref() is for models you own.',
      'Views are the default for staging: cheap, always fresh, no rebuild cost.',
    ],
    fieldNotes: [
      'If staging does more than light cleaning, it is not staging — push logic to intermediate.',
    ],
    dialog: [
      {
        title: 'Grain first',
        body: 'Before you write SQL: what is one row? Staging `orders` should be **one row per order_id**. Ambiguous grain is how double-counted revenue ships.',
      },
      {
        title: 'Why view',
        body: 'Staging reads raw + cleans columns. Materializing it as a table freezes cleaning logic until you re-run. Views stay honest with the raw feed.',
      },
    ],
  },
  {
    id: 'found_ref_model',
    sequence: 'foundation',
    name: 'Build on ref()',
    objective:
      'Create `fct_orders` (table) that **references** `stg_orders` with `ref()`.\n\n`edit model fct_orders ref=stg_orders mat=table` after `new model fct_orders layer=mart mat=table`',
    hint: 'edit model fct_orders ref=stg_orders mat=table',
    solution: [
      'new model fct_orders layer=mart mat=table',
      'edit model fct_orders ref=stg_orders mat=table',
    ],
    start: {
      ...emptyShop,
      nodes: [
        {
          id: 'stg_orders',
          layer: 'staging',
          materialization: 'view',
          sourceRefs: ['raw.orders'],
          sql: 'select * from {{ source("raw", "orders") }}',
        },
      ],
    },
    goal: {
      modelsExist: ['fct_orders'],
      refs: { fct_orders: ['stg_orders'] },
    },
    learning: [
      'ref() is the only portable way to point at another model.',
      'Never hard-code relation names — ref() enables rename + cross-env schemas.',
      'dbt builds a DAG from these refs; that DAG is your blast-radius map.',
    ],
    fieldNotes: ['A model without ref/source is a black box — code review should reject it.'],
  },
  {
    id: 'found_compile',
    sequence: 'foundation',
    name: 'Compile before you trust',
    objective: 'Run `dbt compile` and read the expanded SQL. Jinja becomes real relations.',
    hint: 'dbt compile',
    solution: ['dbt compile'],
    start: {
      ...emptyShop,
      nodes: [
        {
          id: 'stg_orders',
          layer: 'staging',
          materialization: 'view',
          sourceRefs: ['raw.orders'],
          sql: "select * from {{ source('raw', 'orders') }}",
        },
        {
          id: 'fct_orders',
          layer: 'mart',
          materialization: 'table',
          refs: ['stg_orders'],
          sql: "select * from {{ ref('stg_orders') }}",
        },
      ],
    },
    goal: { mustRunCommand: 'dbt compile' },
    learning: [
      'dbt does not execute your Jinja — the warehouse sees compiled SQL.',
      'Compile failures are lineage/config bugs, not warehouse bugs.',
      'Debug with compile + docs before blaming the platform.',
    ],
  },
  {
    id: 'found_staging_rules',
    sequence: 'foundation',
    name: 'Three staging models',
    objective:
      'Create staging views for orders, customers, payments — one per source table, each using `source()`.\n\n' +
      'Names: `stg_orders`, `stg_customers`, `stg_payments`.',
    hint: 'new/edit each staging model',
    solution: [
      'new model stg_orders layer=staging mat=view',
      'edit model stg_orders source=raw.orders',
      'new model stg_customers layer=staging mat=view',
      'edit model stg_customers source=raw.customers',
      'new model stg_payments layer=staging mat=view',
      'edit model stg_payments source=raw.payments',
    ],
    start: emptyShop,
    goal: {
      modelsExist: ['stg_orders', 'stg_customers', 'stg_payments'],
      materializations: {
        stg_orders: 'view',
        stg_customers: 'view',
        stg_payments: 'view',
      },
    },
    learning: [
      'One staging model per source table. Do not join here.',
      'Naming: stg_<source>_<table> keeps ownership obvious.',
      'Joins belong in intermediate — that is the layer contract.',
    ],
    fieldNotes: [
      'When two teams join in staging, lineage becomes unreadable in a quarter.',
    ],
  },
  {
    id: 'found_why_table',
    sequence: 'foundation',
    name: 'When marts are tables',
    objective:
      'Materialize `fct_orders` as a **table** (not view) because it is expensive and shared by many BI tools.\n\n`set config fct_orders mat=table`',
    hint: 'set config fct_orders mat=table',
    solution: ['new model fct_orders layer=mart mat=table', 'edit model fct_orders ref=stg_orders mat=table', 'set config fct_orders mat=table'],
    start: {
      ...emptyShop,
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
          materialization: 'view',
          refs: ['stg_orders'],
        },
      ],
    },
    goal: {
      materializations: { fct_orders: 'table' },
      refs: { fct_orders: ['stg_orders'] },
    },
    learning: [
      'Table = pay once to materialize, cheap to read. Good for hot marts.',
      'View = free to maintain, cost moves to query time. Good for simple transforms.',
      'Choose by access pattern and SLA, not by habit.',
    ],
  },
];
