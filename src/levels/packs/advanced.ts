import type { LevelDef } from '../../engine/types';
import { incidentDrills } from '../../engine/incidents';

/** Production incident drills (diagnose + fix). */
export const incidentLevels: LevelDef[] = incidentDrills.map((d) => ({
  id: d.id,
  sequence: d.sequence,
  name: d.name,
  objective: `${d.symptom}\n\n${d.objective}`,
  hint: d.hint,
  solution: d.solution,
  start: { ...d.start, incidentId: d.id },
  goal: d.goal,
  learning: d.learning,
  fieldNotes: d.fieldNotes,
  dialog: [
    {
      title: 'Incident drill',
      body:
        'You are on call. Symptom first, then root cause, then a minimal fix.\n\n' +
        'Use `diagnose <keywords>` to record your root-cause note (graded).',
    },
  ],
}));

/**
 * Advanced Jinja: set/if/for, macro args.
 */
export const advancedJinjaLevels: LevelDef[] = [
  {
    id: 'jinja_set_if',
    sequence: 'advanced',
    name: 'set + if',
    objective:
      'Write model SQL that uses `{% set %}` and `{% if %}`.\n\n' +
      "`edit model stg_orders sql={% set threshold = 0 %} select * from {{ ref('x') }} {% if threshold >= 0 %} where id > 0 {% endif %}`",
    hint: 'edit model stg_orders with {% set %} and {% if %}',
    solution: [
      "edit model stg_orders sql={% set threshold = 0 %} select 1 as id {% if threshold >= 0 %} where 1=1 {% endif %}",
    ],
    start: {
      nodes: [{ id: 'stg_orders', layer: 'staging', materialization: 'view', refs: [] }],
    },
    goal: {
      sqlRequires: { stg_orders: 'set' },
    },
    learning: [
      '`{% set %}` names a value once; stop repeating magic strings.',
      '`{% if %}` is for compile-time branching (flags, target types) — not row filters.',
    ],
  },
  {
    id: 'jinja_for',
    sequence: 'advanced',
    name: 'for loops in SQL',
    objective:
      'Use `{% for %}` to emit a column list without copy-paste.\n\n' +
      "Edit fct_orders sql to include a `{% for c in ['a','b'] %}` loop.",
    hint: 'edit model with {% for %}',
    solution: [
      "edit model fct_orders sql=select {% for c in ['a','b'] %} {{ c }}, {% endfor %} 1 as x from {{ ref('stg_orders') }} ref=stg_orders",
    ],
    start: {
      nodes: [
        {
          id: 'stg_orders',
          layer: 'staging',
          materialization: 'view',
          refs: [],
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
      sqlRequires: { fct_orders: 'for' },
    },
    learning: [
      'for-unrolled SQL is generated SQL — great for pivots, dangerous to debug.',
      'Prefer macros over 40-line Jinja in a model.',
    ],
  },
  {
    id: 'jinja_macro_args',
    sequence: 'advanced',
    name: 'Macro arguments',
    objective:
      'Define `cents_to_dollars` with args `amount`.\n\n`macro add cents_to_dollars args=amount amount / 100.0`',
    hint: 'macro add cents_to_dollars args=amount amount / 100.0',
    solution: ['macro add cents_to_dollars args=amount amount / 100.0'],
    start: { nodes: [] },
    goal: {
      macroArgs: { cents_to_dollars: ['amount'] },
    },
    learning: [
      'Macros without args are constants with extra steps.',
      'Document arg meaning in the macro docstring (real projects).',
    ],
  },
  {
    id: 'jinja_is_incremental',
    sequence: 'advanced',
    name: 'is_incremental() block',
    objective:
      'SQL must contain `is_incremental` to gate the incremental filter.\n\n' +
      'Edit `fct_orders` sql to include `{% if is_incremental() %}`.',
    hint: 'edit model fct_orders sql with is_incremental',
    solution: [
      "edit model fct_orders sql=select * from {{ ref('stg_orders') }} {% if is_incremental() %} where updated_at > (select max(updated_at) from {{ this }}) {% endif %} mat=incremental strategy=merge unique=order_id",
    ],
    start: {
      nodes: [
        {
          id: 'stg_orders',
          layer: 'staging',
          materialization: 'view',
          refs: [],
        },
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
      sqlContains: { fct_orders: 'is_incremental' },
      incrementalStrategies: { fct_orders: 'merge' },
    },
    learning: [
      'is_incremental() is false on first run / full-refresh — that is the feature.',
      'Watermark = max(updated_at) is a pattern; choose it consciously.',
    ],
  },
  {
    id: 'jinja_packages.yml',
    sequence: 'advanced',
    name: 'Pin packages',
    objective: 'Install `dbt_utils` and treat it as a versioned dependency (discipline drill).',
    hint: 'deps dbt_utils',
    solution: ['deps dbt_utils'],
    start: { nodes: [] },
    goal: { packagesInstalled: ['dbt_utils'] },
    learning: ['packages.yml without a version pin is a production incident class.'],
    fieldNotes: ['CI should fail when package lock changes without review.'],
  },
];

/**
 * Unit / singular tests + graded capstone assessment.
 */
export const assessmentLevels: LevelDef[] = [
  {
    id: 'test_singular',
    sequence: 'assessment',
    name: 'Singular SQL test',
    objective:
      'Add a **singular** test on `fct_orders` with a custom SQL body.\n\n' +
      '`add test singular fct_orders sql=select 1 from {{ ref(fct_orders) }} where 1=1`',
    hint: 'add test singular fct_orders sql=select 1',
    solution: ['add test singular fct_orders sql=select 1 as ok'],
    start: {
      nodes: [{ id: 'fct_orders', layer: 'mart', materialization: 'table', refs: [] }],
    },
    goal: {
      testsDefined: [{ model: 'fct_orders', type: 'singular' }],
    },
    learning: [
      'Singular tests are one-off SQL assertions (anomalies, cross-model invariants).',
      'When the third copy appears, promote to a generic test or macro.',
    ],
  },
  {
    id: 'test_unit',
    sequence: 'assessment',
    name: 'Unit test on fixtures',
    objective:
      'Add a **unit** test on `fct_orders` with fixture `order_fixtures`.\n\n' +
      '`add test unit fct_orders fixture=order_fixtures`',
    hint: 'add test unit fct_orders fixture=order_fixtures',
    solution: ['add test unit fct_orders fixture=order_fixtures'],
    start: {
      nodes: [{ id: 'fct_orders', layer: 'mart', materialization: 'table', refs: [] }],
    },
    goal: {
      testsDefined: [{ model: 'fct_orders', type: 'unit' }],
    },
    learning: [
      'Unit tests lock transformation logic on tiny fixtures — fast CI feedback.',
      'They do not replace data tests; they protect code semantics.',
    ],
  },
  {
    id: 'grade_capstone',
    sequence: 'assessment',
    name: 'GRADED: pipeline + incident response',
    objective:
      'Part A — pipeline: staging→fact with merge incremental + unique/not_null + contract + exposure + docs.\n' +
      'Part B — respond: diagnose a grain issue and enforce unique.\n' +
      'Part C — CI: `ci save` then `ci restore` + `status:modified+`.\n\n' +
      'This level is the exam. No shortcut commands.',
    hint: 'follow parts A–C',
    solution: [
      'new model stg_orders layer=staging mat=view',
      'edit model stg_orders source=raw.orders',
      'new model fct_orders layer=mart mat=incremental',
      'edit model fct_orders ref=stg_orders mat=incremental strategy=merge unique=order_id sql=select * from {{ ref(stg_orders) }} {% if is_incremental() %} where 1=1 {% endif %}',
      'add test unique fct_orders col=order_id',
      'add test not_null fct_orders col=order_id',
      'add test unit fct_orders fixture=orders_fx',
      'set config fct_orders contract=true cols=order_id,amount owner=analytics-eng desc=Order grain',
      'exposure add exec_kpi type=dashboard ref=fct_orders',
      'dbt docs generate',
      'diagnose grain unique order_id fanout',
      'ci save',
      'ci restore',
      'dbt run --select status:modified+',
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
        { model: 'fct_orders', type: 'unit' },
      ],
      contracts: ['fct_orders'],
      exposures: ['exec_kpi'],
      docsBuilt: true,
      minDiagnoses: 1,
      diagnosesInclude: ['grain'],
      ciSaved: true,
      mustRunCommand: 'status:modified',
      sqlContains: { fct_orders: 'is_incremental' },
    },
    learning: [
      'Definition of done in production analytics engineering.',
      'If you cannot explain grain, tests, strategy, consumer, and CI — you are not done.',
    ],
    fieldNotes: [
      'This capstone is the interview loop for a mid-level analytics engineer.',
    ],
    dialog: [
      {
        title: 'Graded capstone',
        body:
          'Three parts: **build**, **diagnose**, **CI**.\n\n' +
          'All goal checks must pass. Partial work is partial credit in your head — the level only unlocks at 100%.',
      },
    ],
  },
];
