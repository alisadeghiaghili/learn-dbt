import type { LevelDef } from '../../engine/types';

/**
 * Craft pack: push mental models and production judgment to "excellent".
 * SQL syntax craft is out of scope — companion course learn-sql.
 */
export const craftLevels: LevelDef[] = [
  {
    id: 'craft_interview_grain',
    sequence: 'craft',
    name: 'CRAFT: answer the grain question',
    objective:
      'Interview drill. Create `fct_orders` with description that states **one row = one order_id**.\n\n' +
      '`set config fct_orders desc=One row per order_id; measures amount` · `scoresql fct_orders`',
    hint: 'set config desc=... then scoresql',
    solution: [
      'set config fct_orders desc=One row per order_id; measures amount owner=analytics-eng',
      'add test unique fct_orders col=order_id',
      'scoresql fct_orders',
    ],
    start: {
      nodes: [
        {
          id: 'fct_orders',
          layer: 'mart',
          materialization: 'table',
          refs: [],
          owner: 'analytics-eng',
          sql: "select order_id, amount from {{ ref('stg_orders') }} where amount > 0",
        },
      ],
    },
    goal: {
      testsDefined: [{ model: 'fct_orders', type: 'unique', column: 'order_id' }],
      minTransferScore: 80,
    },
    learning: [
      'If you cannot state grain in one sentence, you cannot own the model.',
      'unique test is the executable form of that sentence.',
    ],
    fieldNotes: [
      'Senior bar: grain + PK test + who consumes it, in under 60 seconds.',
    ],
  },
  {
    id: 'craft_jinja_production',
    sequence: 'craft',
    name: 'CRAFT: production macro + incremental',
    objective:
      'Combine macro args, incremental strategy, and is_incremental filter — the production trio.\n\n' +
      '1) `macro add cents_to_dollars args=amount amount / 100.0`\n' +
      '2) edit fct_orders sql with is_incremental + merge strategy',
    hint: 'macro args + is_incremental + merge',
    solution: [
      'macro add cents_to_dollars args=amount amount / 100.0',
      "edit model fct_orders sql=select order_id, {{ cents_to_dollars(amount) }} as amount from {{ ref('stg_orders') }} {% if is_incremental() %} where updated_at > (select max(updated_at) from {{ this }}) {% endif %} mat=incremental strategy=merge unique=order_id",
    ],
    start: {
      nodes: [
        { id: 'stg_orders', layer: 'staging', materialization: 'view', sourceRefs: [] },
        {
          id: 'fct_orders',
          layer: 'mart',
          materialization: 'incremental',
          refs: ['stg_orders'],
          sql: "select * from {{ ref('stg_orders') }}",
        },
      ],
    },
    goal: {
      macroArgs: { cents_to_dollars: ['amount'] },
      incrementalStrategies: { fct_orders: 'merge' },
      sqlContains: { fct_orders: 'is_incremental' },
    },
    learning: [
      'This trio is what separates a tutorial model from a shippable one.',
      'SQL inside is learn-sql; the *shape* is learn-dbt.',
    ],
  },
  {
    id: 'craft_sli_bundle',
    sequence: 'craft',
    name: 'CRAFT: SLI bundle on a fact',
    objective:
      'Ship the minimum SLI set on `fct_orders`: unique + not_null + relationships to staging, then `dbt build`.',
    hint: 'three tests then build',
    solution: [
      'add test unique fct_orders col=order_id',
      'add test not_null fct_orders col=order_id',
      'add test relationships fct_orders col=customer_id to=stg_orders',
      'dbt build --select +fct_orders',
    ],
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
          refs: ['stg_orders'],
          owner: 'ae',
        },
      ],
    },
    goal: {
      testsDefined: [
        { model: 'fct_orders', type: 'unique', column: 'order_id' },
        { model: 'fct_orders', type: 'not_null', column: 'order_id' },
        { model: 'fct_orders', type: 'relationships' },
      ],
      testsPassed: ['fct_orders.unique'],
    },
    learning: [
      'SLI bundle = grain + required fields + referential integrity.',
      'Anything less is not “production ready”, it is “ran once”.',
    ],
  },
  {
    id: 'craft_incident_severity',
    sequence: 'craft',
    name: 'CRAFT: severity is a product call',
    objective:
      'CRM is dirty. Add relationships as **warn**, unique as **error**, and explain why via `diagnose`.',
    hint: 'severity=warn on relationships',
    solution: [
      'add test unique fct_orders col=order_id severity=error',
      'add test relationships fct_orders col=customer_id to=stg_orders severity=warn',
      'diagnose severity product risk crm dirty warn relationships',
    ],
    start: {
      sources: [{ id: 'raw.orders', loaded: true }],
      nodes: [
        { id: 'stg_orders', layer: 'staging', materialization: 'view', sourceRefs: ['raw.orders'] },
        {
          id: 'fct_orders',
          layer: 'mart',
          materialization: 'table',
          refs: ['stg_orders'],
        },
      ],
    },
    goal: {
      testsDefined: [
        { model: 'fct_orders', type: 'unique', column: 'order_id' },
        { model: 'fct_orders', type: 'relationships' },
      ],
      minDiagnoses: 1,
      diagnosesInclude: ['severity'],
    },
    learning: [
      'Severity is a risk decision. Money grain = error. Messy CRM = warn.',
    ],
    fieldNotes: ['Write the severity rationale in the PR. Future you will ask.'],
  },
  {
    id: 'craft_blast_walkthrough',
    sequence: 'craft',
    name: 'CRAFT: explain blast radius',
    objective:
      'Change is coming to `stg_payments`. Record a diagnosis that names the blast radius, then rebuild with `stg_payments+`.\n\n' +
      'Diagnosis must mention downstream/blast.',
    hint: 'diagnose blast then stg_payments+',
    solution: [
      'diagnose blast radius downstream stg_payments consumers',
      'new model stg_payments layer=staging mat=view',
      'edit model stg_payments source=raw.payments',
      'new model mart_revenue layer=mart mat=table',
      'edit model mart_revenue ref=stg_payments mat=table',
      'dbt run --select stg_payments+',
    ],
    start: {
      sources: [{ id: 'raw.payments', loaded: true }],
      nodes: [],
    },
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['blast'],
      builtMode: 'atLeast',
      built: ['stg_payments', 'mart_revenue'],
    },
    learning: [
      'Excellent engineers narrate blast radius before they type dbt run.',
    ],
  },
  {
    id: 'craft_handoff',
    sequence: 'craft',
    name: 'CRAFT: handoff packet',
    objective:
      'Finish a handoff: owner + description + contract + exposure + docs generate.\n\n' +
      'That packet is what a senior leaves behind.',
    hint: 'owner, desc, contract, exposure, docs',
    solution: [
      'new model fct_orders layer=mart mat=table',
      'set config fct_orders owner=analytics-eng desc=One row per order_id contract=true cols=order_id,amount',
      'add test unique fct_orders col=order_id',
      'exposure add exec_dash type=dashboard ref=fct_orders',
      'dbt docs generate',
    ],
    start: {
      nodes: [],
    },
    goal: {
      modelsExist: ['fct_orders'],
      contracts: ['fct_orders'],
      exposures: ['exec_dash'],
      docsBuilt: true,
      testsDefined: [{ model: 'fct_orders', type: 'unique', column: 'order_id' }],
    },
    learning: [
      'Handoff = ownership + grain + interface + consumer + map.',
      'If a teammate cannot take over in 30 minutes, the packet failed.',
    ],
    fieldNotes: ['This is the “senior enough to go on vacation” checklist.'],
  },
];
