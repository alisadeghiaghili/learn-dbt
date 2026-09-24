/**
 * Production incident drills — one broken scenario per entry.
 * Learner must diagnose (keywords) and fix (commands checked via goals).
 */

export interface IncidentDrill {
  id: string;
  sequence: string;
  name: string;
  symptom: string;
  /** Keywords that a solid diagnosis must mention. */
  diagnosisKeywords: string[];
  objective: string;
  hint: string;
  solution: string[];
  start: import('./types').ProjectSpec;
  goal: import('./types').GoalSpec;
  learning: string[];
  fieldNotes?: string[];
}

const brokenMissingUpstream = {
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
      materialization: 'table' as const,
      refs: ['stg_orders'],
    },
  ],
};

export const incidentDrills: IncidentDrill[] = [
  {
    id: 'inc_01_missing_upstream',
    sequence: 'incidents',
    name: 'INC-01 mart fails: missing relation',
    symptom:
      'Dashboard team reports `dbt run --select fct_orders` errors with missing upstream.\n' +
      'What is the root cause? Record it, then fix the run.',
    diagnosisKeywords: ['upstream', 'staging'],
    objective:
      '`diagnose missing upstream staging` then run with `+` so parents exist.\n\n' +
      'Minimum: diagnose + `dbt run --select +fct_orders`',
    hint: 'diagnose missing upstream staging',
    solution: [
      'diagnose missing upstream staging',
      'dbt run --select +fct_orders',
    ],
    start: brokenMissingUpstream,
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['upstream'],
      builtMode: 'atLeast',
      built: ['stg_orders', 'fct_orders'],
    },
    learning: [
      'First question: which relation is missing, and whose job builds it?',
      'Never “fix” by rebuilding the world without understanding blast radius.',
    ],
    fieldNotes: ['Page the owner of the missing relation, not the whole data platform.'],
  },
  {
    id: 'inc_02_dup_grain',
    sequence: 'incidents',
    name: 'INC-02 double-counted revenue',
    symptom: 'Finance says GMV is ~2x. Grain looks wrong on `fct_orders`.',
    diagnosisKeywords: ['grain', 'unique'],
    objective:
      'Diagnose grain/duplicate keys and add `unique` on `order_id` to enforce PK.\n\n' +
      '`diagnose grain unique order_id` · `add test unique fct_orders col=order_id`',
    hint: 'diagnose grain unique order_id',
    solution: [
      'diagnose grain unique order_id',
      'add test unique fct_orders col=order_id',
    ],
    start: brokenMissingUpstream,
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['grain'],
      testsDefined: [{ model: 'fct_orders', type: 'unique', column: 'order_id' }],
    },
    learning: [
      '2x revenue is almost always duplicated keys from a join fan-out.',
      'If the grain is wrong, every measure is wrong. Fix grain before charts.',
    ],
  },
  {
    id: 'inc_03_null_keys',
    sequence: 'incidents',
    name: 'INC-03 join drops rows',
    symptom: 'Customer counts shrink after joining orders to customers. Null keys suspected.',
    diagnosisKeywords: ['null'],
    objective: 'Diagnose null join keys and add `not_null` on `order_id`.',
    hint: 'diagnose null keys',
    solution: ['diagnose null keys', 'add test not_null fct_orders col=order_id'],
    start: brokenMissingUpstream,
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['null'],
      testsDefined: [{ model: 'fct_orders', type: 'not_null', column: 'order_id' }],
    },
    learning: ['Nulls silently shrink inner joins. not_null is cheaper than a war room.'],
  },
  {
    id: 'inc_04_stale_incremental',
    sequence: 'incidents',
    name: 'INC-04 incremental under-counts',
    symptom: 'Yesterday’s incremental `fct_orders` missed late-arriving orders.',
    diagnosisKeywords: ['incremental', 'watermark'],
    objective:
      'Diagnose incremental watermark and switch strategy to `merge` with unique key.\n\n' +
      '`diagnose incremental watermark late` · `set config fct_orders strategy=merge unique=order_id`',
    hint: 'diagnose incremental watermark late',
    solution: [
      'diagnose incremental watermark late',
      'set config fct_orders strategy=merge unique=order_id',
    ],
    start: {
      ...brokenMissingUpstream,
      nodes: brokenMissingUpstream.nodes.map((n) =>
        n.id === 'fct_orders'
          ? { ...n, materialization: 'incremental' as const, incrementalStrategy: 'append' as const }
          : n,
      ),
    },
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['incremental'],
      incrementalStrategies: { fct_orders: 'merge' },
    },
    learning: [
      'append never fixes mistakes. merge upserts on a key — required for late facts.',
      'Watermark bugs are silent. Add a freshness/count assertion.',
    ],
  },
  {
    id: 'inc_05_contract_break',
    sequence: 'incidents',
    name: 'INC-05 BI broke on column rename',
    symptom: 'Looker tile exploded after `fct_orders.amount` → `net_amount`. No contract in place.',
    diagnosisKeywords: ['contract', 'interface'],
    objective: 'Diagnose interface break and enforce a contract with declared columns.',
    hint: 'diagnose contract interface break',
    solution: [
      'diagnose contract interface break',
      'set config fct_orders contract=true cols=order_id,amount',
    ],
    start: brokenMissingUpstream,
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['contract'],
      contracts: ['fct_orders'],
    },
    learning: ['Renaming a mart column is a breaking API change. Contracts make that loud.'],
  },
  {
    id: 'inc_06_undefined_jinja',
    sequence: 'incidents',
    name: 'INC-06 compile error: macro missing',
    symptom: 'CI failed with “macro cents_to_dollars is not defined”.',
    diagnosisKeywords: ['macro', 'jinja'],
    objective: 'Diagnose missing macro and define `cents_to_dollars`.',
    hint: 'diagnose macro jinja missing',
    solution: ['diagnose macro jinja missing', 'macro add cents_to_dollars amount / 100.0'],
    start: brokenMissingUpstream,
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['macro'],
      macrosDefined: ['cents_to_dollars'],
    },
    learning: ['Compile errors are project-graph errors. Fix Jinja before touching the warehouse.'],
  },
  {
    id: 'inc_07_circular_ref',
    sequence: 'incidents',
    name: 'INC-07 circular dependency',
    symptom: 'dbt refuses to compile: cycle between `a` and `b`.',
    diagnosisKeywords: ['cycle', 'circular'],
    objective:
      'Diagnose circular refs and break the cycle by pointing `b` at staging instead of `a`.',
    hint: 'diagnose circular cycle',
    solution: [
      'diagnose circular cycle',
      'new model a layer=intermediate mat=view',
      'new model b layer=mart mat=table',
      'edit model a ref=b',
      'edit model b ref=a',
    ],
    start: {
      nodes: [
        { id: 'a', layer: 'intermediate', materialization: 'view', refs: ['b'] },
        { id: 'b', layer: 'mart', materialization: 'table', refs: ['a'] },
      ],
    },
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['cycle'],
    },
    learning: ['A DAG cannot contain a cycle by definition. Extract shared logic to staging.'],
  },
  {
    id: 'inc_08_source_stale',
    sequence: 'incidents',
    name: 'INC-08 green models on stale raw',
    symptom: 'Models are green but numbers look like last week. Freshness never checked.',
    diagnosisKeywords: ['freshness', 'stale'],
    objective: 'Diagnose stale source and run `dbt source freshness`.',
    hint: 'diagnose freshness stale source',
    solution: ['diagnose freshness stale source', 'dbt source freshness'],
    start: brokenMissingUpstream,
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['fresh'],
      mustRunCommand: 'freshness',
    },
    learning: ['Green models over stale raw = silent wrong answers. Freshness is a separate SLA.'],
  },
  {
    id: 'inc_09_severity_swallows',
    sequence: 'incidents',
    name: 'INC-09 warn let bad data ship',
    symptom: 'relationship test was severity=warn; orphan FKs reached production dashboards.',
    diagnosisKeywords: ['severity', 'warn'],
    objective: 'Diagnose severity misuse and add relationships as `error`.',
    hint: 'diagnose severity warn',
    solution: [
      'diagnose severity warn',
      'add test relationships fct_orders col=customer_id to=stg_orders severity=error',
    ],
    start: brokenMissingUpstream,
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['severity'],
      testsDefined: [{ model: 'fct_orders', type: 'relationships' }],
    },
    learning: ['warn is for noisy signals. Integrity of facts is not noisy.'],
  },
  {
    id: 'inc_10_wrong_target',
    sequence: 'incidents',
    name: 'INC-10 wrote to prod schema',
    symptom: 'Someone ran a backfill against prod target from a laptop.',
    diagnosisKeywords: ['target', 'prod'],
    objective: 'Diagnose env mix-up and `target use dev` before any run.',
    hint: 'diagnose target prod credentials',
    solution: ['diagnose target prod credentials', 'target use dev'],
    start: { ...brokenMissingUpstream, target: 'prod' },
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['target'],
      mustRunCommand: 'target use dev',
    },
    learning: ['Profiles are identity. Laptop → dev. Always.'],
  },
  {
    id: 'inc_11_ephemeral_leak',
    sequence: 'incidents',
    name: 'INC-11 analysts need the intermediate',
    symptom: 'Team wants to query `int_…` but it is ephemeral and does not exist.',
    diagnosisKeywords: ['ephemeral'],
    objective: 'Diagnose ephemeral misuse and materialize as `table`.',
    hint: 'diagnose ephemeral missing relation',
    solution: [
      'diagnose ephemeral missing relation',
      'set config int_order_payments mat=table',
    ],
    start: {
      nodes: [
        {
          id: 'int_order_payments',
          layer: 'intermediate',
          materialization: 'ephemeral',
          refs: [],
        },
      ],
    },
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['ephemeral'],
      materializations: { int_order_payments: 'table' },
    },
    learning: ['If a human queries it, it is not ephemeral.'],
  },
  {
    id: 'inc_12_exposure_unknown',
    sequence: 'incidents',
    name: 'INC-12 blast radius unknown',
    symptom: 'Executive dashboard broke; nobody knew it depended on `mart_revenue`.',
    diagnosisKeywords: ['exposure', 'consumer'],
    objective: 'Diagnose missing exposure and declare it.',
    hint: 'diagnose exposure consumer missing',
    solution: [
      'diagnose exposure consumer missing',
      'exposure add exec_kpi type=dashboard ref=mart_revenue',
    ],
    start: {
      nodes: [
        { id: 'mart_revenue', layer: 'mart', materialization: 'table', refs: [] },
      ],
    },
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['exposure'],
      exposures: ['exec_kpi'],
    },
    learning: ['Undeclared consumers are unmanaged risk.'],
  },
  {
    id: 'inc_13_no_unique_incr',
    sequence: 'incidents',
    name: 'INC-13 merge without key',
    symptom: 'merge incremental with no unique_key duplicates rows every hour.',
    diagnosisKeywords: ['unique', 'merge'],
    objective: 'Diagnose merge key gap and set `unique=order_id`.',
    hint: 'diagnose merge unique key',
    solution: ['diagnose merge unique key', 'set config fct_orders strategy=merge unique=order_id'],
    start: {
      nodes: [
        {
          id: 'fct_orders',
          layer: 'mart',
          materialization: 'incremental',
          incrementalStrategy: 'merge',
          refs: [],
        },
      ],
    },
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['unique'],
      incrementalStrategies: { fct_orders: 'merge' },
    },
    learning: ['merge without a key is append with extra steps.'],
  },
  {
    id: 'inc_14_snapshot_missing',
    sequence: 'incidents',
    name: 'INC-14 lost customer history',
    symptom: 'Segment changes overwrote the dimension; no SCD history.',
    diagnosisKeywords: ['snapshot', 'history'],
    objective: 'Diagnose missing snapshot and create + run one.',
    hint: 'diagnose snapshot history',
    solution: ['diagnose snapshot history', 'new snapshot snap_customers', 'dbt snapshot'],
    start: brokenMissingUpstream,
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['snapshot'],
      snapshots: ['snap_customers'],
    },
    learning: ['Current-state models cannot answer “what did we believe last quarter?”'],
  },
  {
    id: 'inc_15_test_gap_fk',
    sequence: 'incidents',
    name: 'INC-15 orphan foreign keys',
    symptom: 'Refunds reference orders that do not exist.',
    diagnosisKeywords: ['relationship', 'foreign'],
    objective: 'Diagnose FK gap and add relationships test.',
    hint: 'diagnose relationship foreign key',
    solution: [
      'diagnose relationship foreign key',
      'add test relationships fct_orders col=customer_id to=stg_orders',
    ],
    start: brokenMissingUpstream,
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['relation'],
      testsDefined: [{ model: 'fct_orders', type: 'relationships' }],
    },
    learning: ['Orphan FKs corrupt every join-based metric.'],
  },
  {
    id: 'inc_16_layer_violation',
    sequence: 'incidents',
    name: 'INC-16 mart reads raw',
    symptom: 'Source vendor rename broke a mart that skipped staging.',
    diagnosisKeywords: ['staging', 'layer', 'raw'],
    objective: 'Diagnose layer violation and move the dependency to staging.',
    hint: 'diagnose layer staging raw',
    solution: ['diagnose layer staging raw', 'edit model fct_orders ref=stg_orders'],
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
      minDiagnoses: 1,
      diagnosesInclude: ['staging'],
      refs: { fct_orders: ['stg_orders'] },
    },
    learning: ['Layering is change management.'],
  },
  {
    id: 'inc_17_hardcoded_date',
    sequence: 'incidents',
    name: 'INC-17 backfill blocked by hard-coded date',
    symptom: 'Model has `where dt >= 2024-01-01` baked in; finance needs 2023.',
    diagnosisKeywords: ['var', 'hard'],
    objective: 'Diagnose hard-coded config and introduce a `var`.',
    hint: 'diagnose var hard-coded date',
    solution: ['diagnose var hard-coded date', 'var start_date=2023-01-01'],
    start: brokenMissingUpstream,
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['var'],
      varsSet: { start_date: '2023-01-01' },
    },
    learning: ['Dates in models belong in vars/config, not string literals.'],
  },
  {
    id: 'inc_18_unpinned_pkg',
    sequence: 'incidents',
    name: 'INC-18 package drift broke CI',
    symptom: 'dbt_utils major upgrade changed a macro return type overnight.',
    diagnosisKeywords: ['package', 'pin'],
    objective: 'Diagnose unpinned package and (re)install a named package as discipline.',
    hint: 'diagnose package pin version',
    solution: ['diagnose package pin version', 'deps dbt_utils'],
    start: brokenMissingUpstream,
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['package'],
      packagesInstalled: ['dbt_utils'],
    },
    learning: ['Unpinned deps are a Friday deploy with extra betrayal.'],
  },
  {
    id: 'inc_19_docs_absent',
    sequence: 'incidents',
    name: 'INC-19 tribal knowledge mart',
    symptom: 'Nobody can explain `mart_kpi_x`. No docs, no owner.',
    diagnosisKeywords: ['docs', 'owner'],
    objective: 'Diagnose docs/ownership gap and generate docs after setting owner+desc.',
    hint: 'diagnose docs owner missing',
    solution: [
      'diagnose docs owner missing',
      'set config mart_kpi_x owner=analytics-eng desc=KPI mart order grain',
      'dbt docs generate',
    ],
    start: {
      nodes: [
        { id: 'mart_kpi_x', layer: 'mart', materialization: 'table', refs: [] },
      ],
    },
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['docs'],
      docsBuilt: true,
    },
    learning: ['If only one person can explain a mart, it is already down.'],
  },
  {
    id: 'inc_20_ci_no_state',
    sequence: 'incidents',
    name: 'INC-20 full rebuilds every PR',
    symptom: 'CI rebuilds the entire warehouse per PR (4h). No state artifact.',
    diagnosisKeywords: ['state', 'slim', 'ci'],
    objective:
      'Diagnose missing CI state and create one with `ci save` after marking a change.\n\n' +
      'Then `ci restore` + `dbt run --select status:modified+` is the intended workflow.',
    hint: 'diagnose state slim ci',
    solution: [
      'diagnose state slim ci',
      'ci save',
      'ci restore',
      'dbt run --select status:modified+',
    ],
    start: {
      ...brokenMissingUpstream,
      nodes: brokenMissingUpstream.nodes.map((n) => ({ ...n, modified: n.id === 'fct_orders' })),
    },
    goal: {
      minDiagnoses: 1,
      diagnosesInclude: ['state'],
      ciSaved: true,
      mustRunCommand: 'status:modified',
    },
    learning: [
      'Slim CI = restore prod state + build modified+downstream only.',
      'Without an artifact you cannot diff against prod.',
    ],
    fieldNotes: ['A 4-hour CI is a process smell, not a compute bill.'],
  },
];
