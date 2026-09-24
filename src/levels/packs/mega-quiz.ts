import type { LevelDef } from '../../engine/types';
import { quizBank } from '../../engine/quiz';

function shop40() {
  const sources = [
    'raw.orders',
    'raw.order_items',
    'raw.customers',
    'raw.products',
    'raw.payments',
    'raw.shipments',
    'raw.refunds',
    'raw.web_events',
  ].map((id) => ({ id, loaded: true }));

  const stagingPairs: [string, string][] = [
    ['stg_orders', 'raw.orders'],
    ['stg_order_items', 'raw.order_items'],
    ['stg_customers', 'raw.customers'],
    ['stg_products', 'raw.products'],
    ['stg_payments', 'raw.payments'],
    ['stg_shipments', 'raw.shipments'],
    ['stg_refunds', 'raw.refunds'],
    ['stg_web_events', 'raw.web_events'],
  ];
  const staging = stagingPairs.map(([id, src]) => ({
    id,
    layer: 'staging' as const,
    materialization: 'view' as const,
    sourceRefs: [src],
    owner: 'analytics-eng',
  }));

  const intermediatePairs: [string, string[]][] = [
    ['int_order_totals', ['stg_orders', 'stg_order_items']],
    ['int_customer_order_summary', ['stg_customers', 'stg_orders']],
    ['int_payment_pivot', ['stg_payments', 'stg_orders']],
    ['int_refund_rates', ['stg_refunds', 'stg_orders']],
    ['int_shipment_latency', ['stg_shipments', 'stg_orders']],
    ['int_product_affinity', ['stg_order_items', 'stg_products']],
    ['int_session_facts', ['stg_web_events']],
    ['int_customer_ltv', ['stg_customers', 'stg_orders', 'stg_payments']],
  ];
  const intermediate = intermediatePairs.map(([id, refs]) => ({
    id,
    layer: 'intermediate' as const,
    materialization: 'view' as const,
    refs,
    owner: 'analytics-eng',
  }));

  const martTriples: [string, string[], 'table' | 'incremental' | 'seed'][] = [
    ['fct_orders', ['int_order_totals'], 'table'],
    ['fct_order_line', ['stg_order_items', 'int_order_totals'], 'table'],
    ['fct_payments', ['int_payment_pivot'], 'incremental'],
    ['fct_refunds', ['int_refund_rates'], 'table'],
    ['fct_shipments', ['int_shipment_latency'], 'table'],
    ['fct_web_sessions', ['int_session_facts'], 'table'],
    ['dim_customers', ['int_customer_order_summary', 'int_customer_ltv'], 'table'],
    ['dim_products', ['stg_products', 'int_product_affinity'], 'table'],
    ['dim_dates', [], 'seed'],
    ['mart_revenue_daily', ['fct_orders', 'fct_payments'], 'table'],
    ['mart_margin', ['fct_order_line', 'fct_refunds'], 'table'],
    ['mart_fulfillment', ['fct_shipments'], 'table'],
    ['mart_cohort_retention', ['dim_customers', 'fct_orders'], 'table'],
    ['mart_product_perf', ['dim_products', 'fct_order_line'], 'table'],
    ['mart_exec_scorecard', ['mart_revenue_daily', 'mart_margin'], 'table'],
  ];
  const marts = martTriples.map(([id, refs, mat]) => ({
    id,
    layer: (mat === 'seed' ? 'seed' : 'mart') as 'seed' | 'mart',
    materialization: mat,
    refs,
    owner: 'analytics-eng',
    description: 'Grain documented in the model header.',
  }));

  return {
    sources,
    nodes: [...staging, ...intermediate, ...marts],
  };
}

/**
 * Mega-project drills on a realistic ~35 node warehouse.
 */
export const megaLevels: LevelDef[] = [
  {
    id: 'mega_orient',
    sequence: 'mega',
    name: 'MEGA: orient in a real DAG',
    objective:
      'A 35-node commerce warehouse is loaded. List the marts layer only.\n\n`dbt ls --select path:models/marts`',
    hint: 'dbt ls --select path:models/marts',
    solution: ['dbt ls --select path:models/marts'],
    start: shop40(),
    goal: {
      mustRunCommand: 'path:models/marts',
      selectionIncludes: ['fct_orders', 'mart_exec_scorecard'],
    },
    learning: [
      'In big repos, path/tag selection is how you find the blast radius.',
      'Start from the consumer question, walk up the DAG.',
    ],
    fieldNotes: ['First 10 minutes on a new repo: ls the marts, read exposures, then SQL.'],
  },
  {
    id: 'mega_revenue_blast',
    sequence: 'mega',
    name: 'MEGA: revenue blast radius',
    objective:
      'Payment schema changed. Rebuild **everything downstream** of `stg_payments`.\n\n' +
      'Other parents (e.g. `stg_orders`) are already materialized in the warehouse.\n\n' +
      '`dbt run --select stg_payments+`',
    hint: 'dbt run --select stg_payments+',
    solution: ['dbt run --select stg_payments+'],
    start: {
      ...shop40(),
      nodes: shop40().nodes.map((n) => {
        const cold = ['stg_web_events', 'int_session_facts', 'fct_web_sessions'].includes(n.id);
        return {
          ...n,
          status: (cold ? 'pending' : 'success') as 'pending' | 'success',
          hasRelation: !cold,
        };
      }),
    },
    goal: {
      builtMode: 'atLeast',
      built: [
        'stg_payments',
        'int_payment_pivot',
        'int_customer_ltv',
        'fct_payments',
        'mart_revenue_daily',
        'mart_exec_scorecard',
      ],
      notBuilt: ['stg_web_events', 'fct_web_sessions'],
    },
    learning: [
      'Downstream selection is blast radius — never rebuild the world.',
      'Multi-parent models still need their *other* parents to exist (prod state).',
      'Note what is NOT selected: unrelated domains stay cold.',
    ],
  },
  {
    id: 'mega_exec_path',
    sequence: 'mega',
    name: 'MEGA: exec scorecard path',
    objective:
      'Build the full upstream path for `mart_exec_scorecard` only.\n\n`dbt build --select +mart_exec_scorecard`',
    hint: 'dbt build --select +mart_exec_scorecard',
    solution: ['dbt build --select +mart_exec_scorecard'],
    start: shop40(),
    goal: {
      builtMode: 'atLeast',
      built: ['mart_exec_scorecard', 'mart_revenue_daily', 'mart_margin', 'fct_orders'],
      notBuilt: ['fct_web_sessions', 'mart_cohort_retention', 'mart_product_perf'],
    },
    learning: [
      'Ancestor selection on the top consumer builds exactly the critical path.',
      'build runs tests along the path — the exec SLI bundle.',
    ],
  },
  {
    id: 'mega_finance_slice',
    sequence: 'mega',
    name: 'MEGA: finance tag slice',
    objective:
      'Tag `mart_revenue_daily` and `mart_margin` with `finance`, then build `+tag:finance`.\n\n' +
      '1) `set config mart_revenue_daily tags=finance`\n2) `set config mart_margin tags=finance`\n3) `dbt run --select +tag:finance`',
    hint: 'tag both marts then +tag:finance',
    solution: [
      'set config mart_revenue_daily tags=finance',
      'set config mart_margin tags=finance',
      'dbt run --select +tag:finance',
    ],
    start: shop40(),
    goal: {
      builtMode: 'atLeast',
      built: ['mart_revenue_daily', 'mart_margin', 'fct_orders'],
    },
    learning: ['Tags create operational slices for domains and SLA tiers.'],
  },
  {
    id: 'mega_exclude_web',
    sequence: 'mega',
    name: 'MEGA: rebuild all except web',
    objective:
      'Full rebuild except the web analytics subtree (pipelines delayed).\n\n' +
      '`dbt run --select path:models --exclude stg_web_events+`',
    hint: 'exclude stg_web_events+',
    solution: ['dbt run --select path:models --exclude stg_web_events+'],
    start: shop40(),
    goal: {
      builtMode: 'atLeast',
      built: ['fct_orders', 'dim_customers', 'mart_revenue_daily'],
      notBuilt: ['fct_web_sessions', 'int_session_facts', 'stg_web_events'],
    },
    learning: ['Exclude is the incident lever when one domain is red.'],
    fieldNotes: ['Do not “fix” a warehouse by waiting for one stuck domain.'],
  },
  {
    id: 'mega_audit_clean',
    sequence: 'mega',
    name: 'MEGA: naming & layer audit',
    objective:
      'Run `audit` and fix every **error** (not warns).\n\nTypical fix: rename/re-layer a violator with `edit model`.\n\n' +
      'This project should already be clean — confirm with `audit`.',
    hint: 'audit',
    solution: ['audit'],
    start: shop40(),
    goal: {
      mustRunCommand: 'audit',
    },
    learning: [
      'Audits encode style guide: stg_/int_/fct_/dim_, layer boundaries, ownership.',
      'Style guide without enforcement is a wiki nobody reads.',
    ],
    fieldNotes: ['CI should run audit --strict on every PR.'],
  },
  {
    id: 'mega_audit_fix',
    sequence: 'mega',
    name: 'MEGA: fix a layer violation',
    objective:
      'A mart `fct_orders` was mistakenly pointed at `raw.orders`. Fix it to ref staging, then `audit` clean of layer errors.\n\n' +
      '`edit model fct_orders ref=stg_orders` · `audit`',
    hint: 'edit ref to stg_orders then audit',
    solution: ['edit model fct_orders ref=stg_orders', 'audit'],
    start: {
      ...shop40(),
      nodes: shop40().nodes.map((n) =>
        n.id === 'fct_orders'
          ? { ...n, sourceRefs: ['raw.orders'], refs: [] as string[] }
          : n,
      ),
    },
    goal: {
      refs: { fct_orders: ['stg_orders'] },
      mustRunCommand: 'audit',
    },
    learning: ['audit --strict must pass before merge.'],
  },
  {
    id: 'mega_owner_pass',
    sequence: 'mega',
    name: 'MEGA: ownership gap',
    objective:
      'Every mart needs an owner. Set `owner=analytics-eng` on `mart_exec_scorecard` if missing, then `audit`.\n\n' +
      '`set config mart_exec_scorecard owner=analytics-eng`',
    hint: 'set owner then audit',
    solution: ['set config mart_exec_scorecard owner=analytics-eng desc=Exec KPI scorecard', 'audit'],
    start: {
      ...shop40(),
      nodes: shop40().nodes.map((n) =>
        n.id === 'mart_exec_scorecard' ? { ...n, owner: undefined, description: undefined } : n,
      ),
    },
    goal: {
      mustRunCommand: 'audit',
      docsBuilt: false,
    },
    learning: ['owner + description are the runbook header of a mart.'],
  },
  {
    id: 'mega_sli_pack',
    sequence: 'mega',
    name: 'MEGA: SLI pack on the fact',
    objective:
      'Add unique + not_null on `fct_orders.order_id` in the mega warehouse.',
    hint: 'add test unique/not_null fct_orders',
    solution: [
      'add test unique fct_orders col=order_id',
      'add test not_null fct_orders col=order_id',
    ],
    start: shop40(),
    goal: {
      testsDefined: [
        { model: 'fct_orders', type: 'unique', column: 'order_id' },
        { model: 'fct_orders', type: 'not_null', column: 'order_id' },
      ],
    },
    learning: ['Facts get PK tests first. That is the minimum SLI set.'],
  },
  {
    id: 'mega_slim_ci',
    sequence: 'mega',
    name: 'MEGA: slim CI on mega project',
    objective:
      'Simulate a PR that changes `fct_payments` only: `ci save`, `ci restore`, `dbt run --select status:modified+`.\n\n' +
      'Mark the change first if needed via `set config fct_payments tags=pr`.',
    hint: 'ci save · ci restore · status:modified+',
    solution: [
      'set config fct_payments tags=pr',
      'ci save',
      'ci restore',
      'dbt run --select status:modified+',
    ],
    start: shop40(),
    goal: {
      ciSaved: true,
      mustRunCommand: 'status:modified',
    },
    learning: ['On 35+ models, slim CI is the difference between 2 minutes and 2 hours.'],
  },
];

/**
 * Conceptual exam levels driven by the quiz bank (understanding, not typing).
 */
export const quizLevels: LevelDef[] = [
  {
    id: 'quiz_pack_1',
    sequence: 'quiz',
    name: 'QUIZ: foundations (8 items)',
    objective:
      'Answer **8 questions correctly** via `quiz <id> <choiceIndex>`.\n\n' +
      'Type `quiz list` to see items. Example: `quiz q_grain 0`.\n\n' +
      'Wrong answers do not unlock the level. This is a real gate.',
    hint: 'quiz list',
    solution: quizBank
      .slice(0, 8)
      .map((q) => `quiz ${q.id} ${q.answer}`),
    start: { nodes: [] },
    goal: {
      quizCorrect: 8,
      mustRunCommand: 'quiz',
    },
    learning: [
      'These items lock mental models: grain, ref, layers, selection, build vs run.',
    ],
  },
  {
    id: 'quiz_pack_2',
    sequence: 'quiz',
    name: 'QUIZ: ops & warehouse (8 items)',
    objective:
      'Eight more **correct** answers on incremental, contracts, slim CI, partitions, snapshots.',
    hint: 'quiz list',
    solution: quizBank
      .slice(8, 16)
      .map((q) => `quiz ${q.id} ${q.answer}`),
    start: { nodes: [] },
    goal: {
      quizCorrect: 8,
      mustRunCommand: 'quiz',
    },
    learning: ['Interview bar: explain merge vs append without notes.'],
  },
  {
    id: 'quiz_pack_3',
    sequence: 'quiz',
    name: 'QUIZ: remaining bank (9+ correct)',
    objective: 'Finish with **9+ correct** on the rest of the bank. Use `review` to resurface weak items.',
    hint: 'review',
    solution: quizBank.slice(16).map((q) => `quiz ${q.id} ${q.answer}`),
    start: { nodes: [] },
    goal: {
      quizCorrect: 9,
      mustRunCommand: 'quiz',
    },
    learning: ['`review` is spaced repetition — weak items float to the top.'],
    fieldNotes: ['Re-run `review` tomorrow. That is how knowledge sticks.'],
  },
  {
    id: 'review_weak',
    sequence: 'quiz',
    name: 'REVIEW: weak items first',
    objective:
      'Type `review` (list adaptive queue), then answer **one** item correctly with `quiz`.\n\n' +
      'Requires `quizCorrect >= 1` and `review` issued.',
    hint: 'review',
    solution: ['review', 'quiz q_grain 0'],
    start: { nodes: [] },
    goal: {
      quizCorrect: 1,
      mustRunCommand: 'review',
    },
    learning: [
      'Spaced repetition from your own mistakes beats random re-reading.',
    ],
  },
];

function legacyProject() {
  const base = shop40();
  const extra: typeof base.nodes = [];
  // Generate 70 more models with a few deliberate legacy violations.
  for (let i = 0; i < 40; i++) {
    extra.push({
      id: `stg_sys_${i}`,
      layer: 'staging' as const,
      materialization: 'view' as const,
      sourceRefs: ['raw.orders'],
      owner: 'legacy-team',
    });
  }
  for (let i = 0; i < 20; i++) {
    extra.push({
      id: `int_sys_${i}`,
      layer: 'intermediate' as const,
      materialization: 'view' as const,
      refs: [`stg_sys_${i}`, `stg_sys_${(i + 1) % 40}`],
      owner: 'legacy-team',
    });
  }
  for (let i = 0; i < 10; i++) {
    extra.push({
      id: `mart_sys_${i}`,
      layer: 'mart' as const,
      materialization: 'table' as const,
      refs: [`int_sys_${i}`],
      owner: 'legacy-team',
      description: 'Legacy mart.',
    });
  }
  // Legacy violations
  const bad = [
    {
      id: 'orders_clean', // missing stg_ prefix
      layer: 'staging' as const,
      materialization: 'view' as const,
      sourceRefs: ['raw.orders'],
    },
    {
      id: 'fct_raw_leak', // mart reads source
      layer: 'mart' as const,
      materialization: 'table' as const,
      sourceRefs: ['raw.payments'],
      refs: [] as string[],
    },
  ];
  return {
    ...base,
    nodes: [...base.nodes, ...extra, ...bad],
  };
}

export const legacyLevels: LevelDef[] = [
  {
    id: 'legacy_count',
    sequence: 'mega',
    name: 'MEGA: 100+ model repo',
    objective:
      'The legacy warehouse is loaded (~110 models). Count marts with `dbt ls --select path:models/marts`.',
    hint: 'dbt ls --select path:models/marts',
    solution: ['dbt ls --select path:models/marts'],
    start: legacyProject(),
    goal: {
      mustRunCommand: 'path:models/marts',
    },
    learning: [
      'At 100+ models, tribal knowledge dies. Selection + docs + audit are survival tools.',
    ],
    fieldNotes: ['Repos this size need automated style gates in CI.'],
  },
  {
    id: 'legacy_audit_fix',
    sequence: 'mega',
    name: 'MEGA: fix legacy layer leak',
    objective:
      '`audit` flags `fct_raw_leak` (mart reads sources). Fix the layer violation and audit again.\n\n' +
      '`edit model fct_raw_leak ref=stg_payments` · `audit`',
    hint: 'edit model fct_raw_leak ref=stg_payments then audit',
    solution: ['edit model fct_raw_leak ref=stg_payments', 'audit'],
    start: {
      ...legacyProject(),
      nodes: legacyProject().nodes.map((n) =>
        n.id === 'fct_raw_leak'
          ? { ...n, sourceRefs: ['raw.payments'], refs: [] as string[] }
          : n,
      ),
    },
    goal: {
      maxAuditErrors: 0,
      refs: { fct_raw_leak: ['stg_payments'] },
      mustRunCommand: 'audit',
    },
    learning: ['audit --strict on every PR is how 100-model repos stay navigable.'],
  },
  {
    id: 'legacy_data_grain',
    sequence: 'mega',
    name: 'MEGA: data-level grain failure',
    objective:
      '`fct_orders` has **duplicate order_id** in the warehouse (dup_key corruption).\n\n' +
      'Add `unique` on `order_id`, run `dbt test --select fct_orders`, and watch it FAIL on data.\n\n' +
      'Then understand: you cannot “fix” this with a command — the upstream dedupe is the real fix.',
    hint: 'add test unique fct_orders col=order_id',
    solution: [
      'add test unique fct_orders col=order_id',
      'dbt test --select fct_orders',
    ],
    start: {
      nodes: [
        {
          id: 'fct_orders',
          layer: 'mart',
          materialization: 'table',
          refs: [],
          owner: 'ae',
          corruption: 'dup_key',
        },
      ],
    },
    goal: {
      testsDefined: [{ model: 'fct_orders', type: 'unique', column: 'order_id' }],
      mustRunCommand: 'test',
    },
    learning: [
      'This is the authenticity gap most tutorials ignore: tests must fail on bad data.',
      'Our simulator now evaluates rows — unique on dup_key FAILS.',
    ],
    fieldNotes: ['If your tests always pass, you do not have tests.'],
  },
];
export const fidelityLevels: LevelDef[] = [
  {
    id: 'fid_contract_cols',
    sequence: 'fidelity',
    name: 'FIDELITY: contract columns',
    objective:
      'Declare contract columns `order_id,amount` on `fct_orders` and set description with grain.\n\n' +
      'Then `audit` should warn about missing unique until you add it.',
    hint: 'set config fct_orders contract=true cols=order_id,amount',
    solution: [
      'set config fct_orders contract=true cols=order_id,amount desc=One row per order_id grain',
      'add test unique fct_orders col=order_id',
    ],
    start: {
      nodes: [
        { id: 'fct_orders', layer: 'mart', materialization: 'table', refs: [], owner: 'ae' },
      ],
    },
    goal: {
      contracts: ['fct_orders'],
      testsDefined: [{ model: 'fct_orders', type: 'unique', column: 'order_id' }],
    },
    learning: [
      'Contract = names/types. unique = grain. Both are interface.',
      'Compile fidelity: declared columns must appear in the model body.',
    ],
  },
  {
    id: 'fid_compile_sql',
    sequence: 'fidelity',
    name: 'FIDELITY: compile with declared cols',
    objective:
      'Write SQL that selects `order_id` and `amount` (must contain both names) with a ref(), then compile.\n\n' +
      'Contract check compares declaredColumns to sql text.',
    hint: 'edit sql with order_id,amount then dbt compile',
    solution: [
      "edit model fct_orders sql=select order_id, amount from {{ ref('stg_orders') }} ref=stg_orders",
      'set config fct_orders contract=true cols=order_id,amount',
      'dbt compile',
    ],
    start: {
      nodes: [
        {
          id: 'stg_orders',
          layer: 'staging',
          materialization: 'view',
          sourceRefs: [],
        },
        {
          id: 'fct_orders',
          layer: 'mart',
          materialization: 'table',
          refs: ['stg_orders'],
          sql: 'select 1 as x',
        },
      ],
    },
    goal: {
      contracts: ['fct_orders'],
      sqlContains: { fct_orders: 'order_id' },
      mustRunCommand: 'compile',
    },
    learning: [
      'If sql does not mention a declared column, the contract is aspirational.',
    ],
  },
];
