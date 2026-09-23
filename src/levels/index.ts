import type { LevelDef, LevelDialogSlide, ProjectSpec } from '../engine/types';
import { foundationLevels } from './packs/foundation';
import { testingLevels } from './packs/testing';
import { jinjaLevels, modelingLevels } from './packs/jinja-modeling';

/** Shared e-commerce demo warehouse used by intro + selection levels. */
export function demoShopSpec(): ProjectSpec {
  return {
    sources: [
      { id: 'raw.orders', loaded: true },
      { id: 'raw.customers', loaded: true },
      { id: 'raw.payments', loaded: true },
    ],
    nodes: [
      {
        id: 'stg_orders',
        layer: 'staging',
        materialization: 'view',
        sourceRefs: ['raw.orders'],
        path: 'models/staging/stg_orders.sql',
        tests: [{ type: 'unique', column: 'order_id', severity: 'error' }],
      },
      {
        id: 'stg_customers',
        layer: 'staging',
        materialization: 'view',
        sourceRefs: ['raw.customers'],
        path: 'models/staging/stg_customers.sql',
        tests: [{ type: 'unique', column: 'customer_id', severity: 'error' }],
      },
      {
        id: 'stg_payments',
        layer: 'staging',
        materialization: 'view',
        sourceRefs: ['raw.payments'],
        path: 'models/staging/stg_payments.sql',
      },
      {
        id: 'int_order_payments',
        layer: 'intermediate',
        materialization: 'ephemeral',
        refs: ['stg_orders', 'stg_payments'],
        path: 'models/intermediate/int_order_payments.sql',
        tags: ['finance'],
      },
      {
        id: 'fct_orders',
        layer: 'mart',
        materialization: 'table',
        refs: ['stg_orders', 'int_order_payments'],
        path: 'models/marts/fct_orders.sql',
        tags: ['finance', 'core'],
        tests: [
          { type: 'not_null', column: 'order_id', severity: 'error' },
          { type: 'relationships', column: 'customer_id', to: 'stg_customers', severity: 'warn' },
        ],
      },
      {
        id: 'dim_customers',
        layer: 'mart',
        materialization: 'table',
        refs: ['stg_customers', 'fct_orders'],
        path: 'models/marts/dim_customers.sql',
        tags: ['core'],
      },
      {
        id: 'mart_daily_revenue',
        layer: 'mart',
        materialization: 'incremental',
        refs: ['fct_orders', 'stg_payments'],
        path: 'models/marts/mart_daily_revenue.sql',
        tags: ['finance'],
      },
    ],
  };
}

export const introLevels: LevelDef[] = [
  {
    id: 'intro_ls',
    sequence: 'intro',
    name: 'See the graph',
    objective:
      'List every node in the project with `dbt ls`. Nothing is built yet — you are looking at lineage, not warehouse tables.',
    hint: 'Run `dbt ls` with no selector.',
    solution: ['dbt ls'],
    start: demoShopSpec(),
    goal: {
      builtMode: 'none',
      mustRunCommand: 'dbt ls',
    },
    dialog: [
      {
        title: 'learn-dbt',
        body:
          'You are not moving commits. You are selecting and materializing a **dbt DAG**.\n\n' +
          'Sources sit on the left, staging models clean them, marts answer business questions.\n\n' +
          'Start by listing the project.',
      },
    ],
  },
  {
    id: 'intro_run_one',
    sequence: 'intro',
    name: 'Build one model',
    objective:
      'Materialize only `stg_orders`. Upstream sources already exist — you do not need to "run" them.',
    hint: 'dbt run --select stg_orders',
    solution: ['dbt run --select stg_orders'],
    start: demoShopSpec(),
    goal: {
      built: ['stg_orders'],
      builtMode: 'exactly',
    },
  },
  {
    id: 'intro_run_ancestors',
    sequence: 'intro',
    name: 'Plus means upstream',
    objective:
      'Build `fct_orders` with everything it depends on. A lone `dbt run --select fct_orders` fails because staging is not materialized.\n\nUse `+` on the left for ancestors. Follow the refs through the ephemeral intermediate.',
    hint: 'dbt run --select +fct_orders',
    solution: ['dbt run --select +fct_orders'],
    start: demoShopSpec(),
    goal: {
      built: ['stg_orders', 'stg_payments', 'int_order_payments', 'fct_orders'],
      builtMode: 'atLeast',
      notBuilt: ['dim_customers', 'mart_daily_revenue', 'stg_customers'],
    },
  },
  {
    id: 'intro_run_descendants',
    sequence: 'intro',
    name: 'Trailing plus is downstream',
    objective:
      'A tiny linear project: orders staging feeds a fact table, which feeds two marts.\n\nBuild `stg_orders` and everything that depends on it using a trailing `+`.',
    hint: 'dbt run --select stg_orders+',
    solution: ['dbt run --select stg_orders+'],
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
        },
        {
          id: 'dim_order_status',
          layer: 'mart',
          materialization: 'table',
          refs: ['fct_orders'],
        },
        {
          id: 'mart_kpis',
          layer: 'mart',
          materialization: 'table',
          refs: ['fct_orders'],
        },
      ],
    },
    goal: {
      built: ['stg_orders', 'fct_orders', 'dim_order_status', 'mart_kpis'],
      builtMode: 'exactly',
    },
  },
  {
    id: 'intro_build_vs_run',
    sequence: 'intro',
    name: 'build runs tests',
    objective:
      'Use `dbt build` (not `dbt run`) on `+fct_orders` so tests on `stg_orders` and `fct_orders` actually execute and pass.',
    hint: 'dbt build --select +fct_orders',
    solution: ['dbt build --select +fct_orders'],
    start: demoShopSpec(),
    goal: {
      built: ['stg_orders', 'int_order_payments', 'fct_orders'],
      builtMode: 'atLeast',
      testsPassed: ['stg_orders.unique', 'fct_orders.not_null'],
    },
  },
];

export const selectionLevels: LevelDef[] = [
  {
    id: 'sel_at',
    sequence: 'selection',
    name: 'The @ operator',
    objective:
      'Build the neighborhood of `fct_orders`: the model, its parents, its children, and parents of children.\n\n' +
      'That is `@fct_orders` — and it should include `dim_customers` and staging on both sides.',
    hint: 'dbt run --select @fct_orders',
    solution: ['dbt run --select @fct_orders'],
    start: demoShopSpec(),
    goal: {
      built: [
        'stg_orders',
        'stg_payments',
        'stg_customers',
        'int_order_payments',
        'fct_orders',
        'dim_customers',
        'mart_daily_revenue',
      ],
      builtMode: 'atLeast',
    },
  },
  {
    id: 'sel_tag',
    sequence: 'selection',
    name: 'Select by tag',
    objective:
      'Materialize every model tagged `finance`, including what they need to exist.\n\n' +
      '`tag:finance` alone is not enough if parents are unbuilt — combine with `+`.\n\n' +
      'Do not build `dim_customers` or `stg_customers`.',
    hint: 'dbt run --select +tag:finance',
    solution: ['dbt run --select +tag:finance'],
    start: demoShopSpec(),
    goal: {
      built: [
        'stg_orders',
        'stg_payments',
        'int_order_payments',
        'fct_orders',
        'mart_daily_revenue',
      ],
      builtMode: 'atLeast',
      notBuilt: ['dim_customers', 'stg_customers'],
    },
  },
  {
    id: 'sel_path',
    sequence: 'selection',
    name: 'Select by path',
    objective: 'Build only models under `models/staging`.',
    hint: 'dbt run --select path:models/staging',
    solution: ['dbt run --select path:models/staging'],
    start: demoShopSpec(),
    goal: {
      built: ['stg_orders', 'stg_customers', 'stg_payments'],
      builtMode: 'exactly',
    },
  },
  {
    id: 'sel_source',
    sequence: 'selection',
    name: 'Start from a source',
    objective:
      'List (do not build) everything downstream of source `raw.payments` using `source:raw.payments` with a trailing `+`.',
    hint: 'dbt ls --select source:raw.payments+',
    solution: ['dbt ls --select source:raw.payments+'],
    start: demoShopSpec(),
    goal: {
      builtMode: 'none',
      mustRunCommand: 'source:raw.payments+',
      selectionIncludes: ['stg_payments', 'int_order_payments', 'fct_orders', 'mart_daily_revenue'],
    },
  },
  {
    id: 'sel_exclude',
    sequence: 'selection',
    name: 'Union then exclude',
    objective:
      'Build the full project **except** `mart_daily_revenue`.\n\n' +
      'Use a broad selection and `--exclude`.',
    hint: 'dbt run --select +dim_customers --exclude mart_daily_revenue',
    solution: ['dbt run --select +dim_customers --exclude mart_daily_revenue'],
    start: demoShopSpec(),
    goal: {
      built: [
        'stg_orders',
        'stg_customers',
        'stg_payments',
        'int_order_payments',
        'fct_orders',
        'dim_customers',
      ],
      builtMode: 'exactly',
      notBuilt: ['mart_daily_revenue'],
    },
  },
  {
    id: 'sel_modified',
    sequence: 'selection',
    name: 'status:modified (slim CI)',
    objective:
      'Production already built the graph. Two models are flagged modified: `fct_orders` and `stg_payments`.\n\n' +
      'Unmodified models are already materialized in the warehouse.\n\n' +
      'Rebuild what changed **and what depends on it** — the slim CI pattern. Use `status:modified+`.',
    hint: 'dbt run --select status:modified+',
    solution: ['dbt run --select status:modified+'],
    start: {
      ...demoShopSpec(),
      nodes: demoShopSpec().nodes.map((n) => {
        const modified = n.id === 'fct_orders' || n.id === 'stg_payments';
        return {
          ...n,
          modified,
          // prod state: everything except modified nodes is already built
          status: modified ? ('pending' as const) : ('success' as const),
          hasRelation: true,
        };
      }),
    },
    goal: {
      built: [
        'stg_payments',
        'int_order_payments',
        'fct_orders',
        'dim_customers',
        'mart_daily_revenue',
      ],
      builtMode: 'atLeast',
      notBuilt: [],
      // unmodified upstream may stay success from prod; that's fine with atLeast
    },
  },
];

export const materializationLevels: LevelDef[] = [
  {
    id: 'mat_ephemeral',
    sequence: 'materialization',
    name: 'Ephemeral is not a table',
    objective:
      'Build `+fct_orders` and notice `int_order_payments` is ephemeral: it "succeeds" as inline CTE but never becomes a warehouse relation.\n\n' +
      'Goal still counts it as successfully processed. Observe the log line.',
    hint: 'dbt build --select +fct_orders',
    solution: ['dbt build --select +fct_orders'],
    start: demoShopSpec(),
    goal: {
      built: ['stg_orders', 'int_order_payments', 'fct_orders'],
      builtMode: 'atLeast',
    },
  },
  {
    id: 'mat_incremental',
    sequence: 'materialization',
    name: 'Incremental first run',
    objective:
      'Build the revenue mart path with `dbt build --select +mart_daily_revenue`. The incremental model creates its relation on first run.',
    hint: 'dbt build --select +mart_daily_revenue',
    solution: ['dbt build --select +mart_daily_revenue'],
    start: demoShopSpec(),
    goal: {
      built: ['stg_orders', 'stg_payments', 'int_order_payments', 'fct_orders', 'mart_daily_revenue'],
      builtMode: 'atLeast',
    },
  },
  {
    id: 'mat_missing_upstream',
    sequence: 'materialization',
    name: 'Why + exists',
    objective:
      'First try to understand the failure mode: running a mart without staging fails.\n\n' +
      'Now get `dim_customers` built successfully. You need its whole upstream.',
    hint: 'dbt run --select +dim_customers',
    solution: ['dbt run --select +dim_customers'],
    start: demoShopSpec(),
    goal: {
      built: ['dim_customers'],
      builtMode: 'atLeast',
    },
  },
];

const levelCoaching: Record<
  string,
  { learning: string[]; fieldNotes: string[]; dialog?: LevelDialogSlide[] }
> = {
  intro_ls: {
    learning: [
      'dbt ls prints lineage (nodes), not warehouse tables.',
      'Sources are declared relations; models are SELECTs you own.',
      'Layers: staging cleans, intermediate reshapes, marts answer questions.',
    ],
    fieldNotes: [
      'In production, start from lineage when debugging a wrong number — not from SQL files on disk.',
    ],
    dialog: [
      {
        title: 'What you are looking at',
        body:
          'Left → right: raw sources → staging views → intermediate (often ephemeral) → marts.\n\n' +
          'Nothing is materialized yet. `dbt ls` is read-only reconnaissance.',
      },
      {
        title: 'Why this matters',
        body:
          'If you cannot draw the DAG, you cannot reason about blast radius, cost, or test placement.\n\n' +
          'Type `dbt ls` to see the graph the compiler sees.',
      },
    ],
  },
  intro_run_one: {
    learning: [
      'dbt run --select <name> materializes exactly that node.',
      'Sources already exist — you do not “run” sources.',
      'Views are cheap rewrites; tables store results.',
    ],
    fieldNotes: [
      'When a dashboard is wrong, re-run the thinnest slice that owns the number — not the whole project.',
    ],
  },
  intro_run_ancestors: {
    learning: [
      '`+model` means “this node and all ancestors”.',
      'Ephemeral models compile inline but must still be processed for children to run.',
      'A missing upstream is an error — dbt does not magically build your parents.',
    ],
    fieldNotes: [
      'Interview ask: “What happens if you dbt run a mart without staging?” — answer with missing relations, not vibes.',
    ],
  },
  intro_run_descendants: {
    learning: [
      '`model+` means “this node and all descendants”.',
      'Use trailing + after changing a staging definition or source contract.',
    ],
    fieldNotes: [
      'Blast radius: changing stg_orders without rebuilding consumers ships stale marts.',
    ],
  },
  intro_build_vs_run: {
    learning: [
      'dbt run only materializes; dbt build runs then tests in order.',
      'unique / not_null are row contracts you can enforce in CI.',
    ],
    fieldNotes: [
      'Ship path: dbt build --select <critical> in CI before merge. Tests without a run are theater.',
    ],
  },
  sel_at: {
    learning: [
      '@model is the neighborhood: parents + children + parents of children.',
      'Useful when one model’s contract change ripples both ways on the DAG.',
    ],
    fieldNotes: [
      'When a join key changes, @ the model to rebuild both the upstream truth and all consumers that encode it.',
    ],
  },
  sel_tag: {
    learning: [
      'tag: groups models by domain (finance, growth, pii).',
      'Combine with + so dependencies exist: `+tag:finance`.',
    ],
    fieldNotes: ['Tags are for ownership and SLA tiers. If everything is tagged core, nothing is.'],
  },
  sel_path: {
    learning: [
      'path: mirrors your folder convention (models/staging/…).',
      'Path selection keeps layer boundaries honest.',
    ],
    fieldNotes: [
      'Repo layout is an API. Staging should only read sources; marts should not hit raw tables.',
    ],
  },
  sel_source: {
    learning: [
      'source: selects declared source nodes; + walks downstream consumers.',
      'You can list lineage from a raw table without building anything.',
    ],
    fieldNotes: [
      'When an upstream vendor schema changes, select source:x+ to see every model that will break.',
    ],
  },
  sel_exclude: {
    learning: [
      'Union selectors, then --exclude to carve out nodes.',
      'Exclude is how you skip expensive or broken subtrees mid-incident.',
    ],
    fieldNotes: [
      'During an incident: run everything except the known-red mart, then fix that mart in isolation.',
    ],
  },
  sel_modified: {
    learning: [
      'status:modified is the slim CI pattern with a state artifact.',
      'status:modified+ rebuilds changed models and their consumers only.',
    ],
    fieldNotes: [
      'Full rebuilds on every PR do not scale. State comparison is how serious teams do analytics CI.',
    ],
  },
  mat_ephemeral: {
    learning: [
      'Ephemeral = CTE inline, no warehouse relation.',
      'Good for cheap reshapes; bad if you need to query the intermediate directly.',
    ],
    fieldNotes: ['If analysts ask for the intermediate table, it should not have been ephemeral.'],
  },
  mat_incremental: {
    learning: [
      'Incremental models append/merge after the first build.',
      'Without a correct watermark you silently lose history.',
    ],
    fieldNotes: [
      'Know your late-arriving facts. Incremental without a strategy is a time bomb.',
    ],
  },
  mat_missing_upstream: {
    learning: [
      'Parents must be materialized (or selected with +) before children succeed.',
      'The + operator is not magic — it is explicit dependency selection.',
    ],
    fieldNotes: [
      '#1 onboarding failure in dbt. If someone says “dbt is broken”, check missing upstreams first.',
    ],
  },
};

export const allLevels: LevelDef[] = [
  ...introLevels,
  ...selectionLevels,
  ...materializationLevels,
  ...foundationLevels,
  ...testingLevels,
  ...jinjaLevels,
  ...modelingLevels,
].map((l) => ({
  ...l,
  ...(levelCoaching[l.id] ?? {}),
  dialog: levelCoaching[l.id]?.dialog ?? l.dialog,
  learning: l.learning ?? levelCoaching[l.id]?.learning,
  fieldNotes: l.fieldNotes ?? levelCoaching[l.id]?.fieldNotes,
}));

export const sequences: { id: string; title: string; about: string }[] = [
  {
    id: 'intro',
    title: 'Introduction',
    about: 'List, run, ancestors, descendants, build vs run.',
  },
  {
    id: 'selection',
    title: 'Selection grammar',
    about: '@, tags, paths, sources, exclude, slim CI.',
  },
  {
    id: 'materialization',
    title: 'Materializations',
    about: 'Ephemeral, incremental, missing upstreams.',
  },
  {
    id: 'foundation',
    title: 'Writing models',
    about: 'SQL, ref/source, grain, staging rules, tables vs views.',
  },
  {
    id: 'testing',
    title: 'Tests & contracts',
    about: 'unique, not_null, relationships, accepted_values, severity, SCD, freshness.',
  },
  {
    id: 'jinja',
    title: 'Jinja & packages',
    about: 'vars, macros, packages, incremental strategies, exposures, docs.',
  },
  {
    id: 'modeling',
    title: 'Modeling & ops',
    about: 'Layers, fact/dim, ownership, targets, capstone pipeline.',
  },
];

export function getLevel(id: string): LevelDef | undefined {
  return allLevels.find((l) => l.id === id);
}

export function levelsInSequence(seq: string): LevelDef[] {
  return allLevels.filter((l) => l.sequence === seq);
}

export function nextLevelId(id: string): string | undefined {
  const idx = allLevels.findIndex((l) => l.id === id);
  if (idx === -1 || idx === allLevels.length - 1) return undefined;
  return allLevels[idx + 1].id;
}
