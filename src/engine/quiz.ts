/**
 * Conceptual quiz bank + adaptive spaced review (localStorage).
 * These grade understanding, not just command typing.
 */

export interface QuizItem {
  id: string;
  topic: string;
  q: string;
  choices: string[];
  /** 0-based index of the correct choice. */
  answer: number;
  why: string;
}

export const quizBank: QuizItem[] = [
  {
    id: 'q_grain',
    topic: 'grain',
    q: 'What is the grain of a model?',
    choices: [
      'One row = one business entity/event (e.g. one order)',
      'The SQL join order',
      'The warehouse cluster key',
      'The dbt version',
    ],
    answer: 0,
    why: 'Grain is the meaning of one row. Wrong grain double-counts measures.',
  },
  {
    id: 'q_ref',
    topic: 'refs',
    q: 'Why ref() instead of hard-coding a table name?',
    choices: [
      'It is faster SQL',
      'Portable lineage + env schemas; dbt builds the DAG from it',
      'It encrypts the query',
      'It replaces tests',
    ],
    answer: 1,
    why: 'ref() is the dependency edge. Hard-coded names break lineage and renames.',
  },
  {
    id: 'q_staging',
    topic: 'layers',
    q: 'Staging models should…',
    choices: [
      'Join three domains and compute KPIs',
      'Be 1:1 with a source table, light cleaning/renaming only',
      'Be materialized as incrementals always',
      'Read other staging models',
    ],
    answer: 1,
    why: 'Staging is a clean interface to raw. Joins belong in intermediate/mart.',
  },
  {
    id: 'q_plus',
    topic: 'selection',
    q: '`dbt run --select +fct_orders` runs:',
    choices: [
      'Only fct_orders',
      'fct_orders and all descendants',
      'fct_orders and all ancestors',
      'All models tagged orders',
    ],
    answer: 2,
    why: 'Left + = ancestors (parents). Right + = descendants.',
  },
  {
    id: 'q_build',
    topic: 'tests',
    q: 'Difference between dbt run and dbt build?',
    choices: [
      'build only compiles',
      'build runs models then their tests in DAG order',
      'run tests, build materializes',
      'There is no difference',
    ],
    answer: 1,
    why: 'build = run + test interleaved. That is the merge gate.',
  },
  {
    id: 'q_incr',
    topic: 'incremental',
    q: 'When is merge the right incremental strategy?',
    choices: [
      'Immutable log events with no updates',
      'Upserts on a unique key (late-arriving facts)',
      'Always — merge is best',
      'When the table is a view',
    ],
    answer: 1,
    why: 'append never corrects; merge upserts on key; delete+insert replaces a window.',
  },
  {
    id: 'q_ephemeral',
    topic: 'materializations',
    q: 'Ephemeral models…',
    choices: [
      'Create a table in prod',
      'Compile to CTEs — no relation to query later',
      'Are snapshots',
      'Skip lineage',
    ],
    answer: 1,
    why: 'If analysts must query it, do not make it ephemeral.',
  },
  {
    id: 'q_contract',
    topic: 'contracts',
    q: 'A model contract primarily…',
    choices: [
      'Speeds up queries',
      'Freezes the column interface so BI/ML break loudly in CI',
      'Backfills data',
      'Replaces unique tests',
    ],
    answer: 1,
    why: 'Contracts are the API of your mart. Breaking them is a version bump.',
  },
  {
    id: 'q_freshness',
    topic: 'freshness',
    q: 'Green models over stale raw data means…',
    choices: [
      'Everything is fine',
      'You can still ship wrong numbers — check source freshness separately',
      'Tests failed',
      'The DAG has a cycle',
    ],
    answer: 1,
    why: 'Freshness is an SLA on feeds, orthogonal to transform success.',
  },
  {
    id: 'q_exposure',
    topic: 'exposures',
    q: 'Exposures document…',
    choices: [
      'Package versions',
      'Downstream consumers (BI, ML, apps) and blast radius',
      'Warehouse cost',
      'Git branches',
    ],
    answer: 1,
    why: 'If you do not declare consumers, you cannot page the right people.',
  },
  {
    id: 'q_slim',
    topic: 'ci',
    q: 'Slim CI means…',
    choices: [
      'Fewer tests in CI',
      'Restore prod state artifact + build only modified+downstream',
      'Skip documentation',
      'Use a smaller warehouse',
    ],
    answer: 1,
    why: 'Full rebuilds per PR do not scale. Diff against state.',
  },
  {
    id: 'q_factdim',
    topic: 'modeling',
    q: 'Customer attributes for segmentation belong in…',
    choices: ['The order fact table', 'A dimension (dim_customers)', 'A seed CSV', 'A macro'],
    answer: 1,
    why: 'Facts = events/measures. Dimensions = who/what/context.',
  },
  {
    id: 'q_snapshot',
    topic: 'snapshots',
    q: 'Snapshots are for…',
    choices: [
      'Faster marts',
      'SCD history of slowly changing dimensions',
      'Unit tests',
      'Package installs',
    ],
    answer: 1,
    why: 'Models show now. Snapshots answer “what did we believe last quarter?”',
  },
  {
    id: 'q_null',
    topic: 'tests',
    q: 'not_null tests protect you from…',
    choices: [
      'Slow queries',
      'Silent inner-join row drops and null measures',
      'Jinja errors',
      'Unpinned packages',
    ],
    answer: 1,
    why: 'Nulls shrink joins and sum() quietly.',
  },
  {
    id: 'q_unique',
    topic: 'tests',
    q: 'A unique test on order_id asserts…',
    choices: [
      'order_id is sorted',
      'One row per order_id (grain/PK)',
      'order_id is never null',
      'order_id exists in customers',
    ],
    answer: 1,
    why: 'unique = primary key semantics for analytics grain.',
  },
  {
    id: 'q_relationships',
    topic: 'tests',
    q: 'relationships test checks…',
    choices: [
      'Table sizes',
      'Foreign key integrity between models',
      'Column types',
      'Macro arguments',
    ],
    answer: 1,
    why: 'Orphan FKs corrupt every join-based metric.',
  },
  {
    id: 'q_partition',
    topic: 'warehouse',
    q: 'On BigQuery, partitioning a fact table primarily reduces…',
    choices: [
      'Model compile time',
      'Bytes scanned (cost) for date filters',
      'dbt deps time',
      'Git commit size',
    ],
    answer: 1,
    why: 'BQ cost is bytes scanned. Partition on the filter you always use.',
  },
  {
    id: 'q_jinja_if',
    topic: 'jinja',
    q: '{% if is_incremental() %} is for…',
    choices: [
      'Row-level filters in SQL where clause only when incremental',
      'Choosing materialization',
      'Installing packages',
      'Declaring sources',
    ],
    answer: 0,
    why: 'is_incremental() is false on first run/full-refresh — perfect for watermark filters.',
  },
  {
    id: 'q_macro',
    topic: 'jinja',
    q: 'You should extract a macro when…',
    choices: [
      'Always, even for one line',
      'The same cleaning SQL is copied across models',
      'The model is a table',
      'Tests fail',
    ],
    answer: 1,
    why: 'DRY transformation logic. One source of truth for cleaning.',
  },
  {
    id: 'q_layer_violation',
    topic: 'layers',
    q: 'A mart that joins raw.orders directly is a problem because…',
    choices: [
      'SQL will not run',
      'Vendor schema renames bypass staging and break marts unexpectedly',
      'It is slower',
      'dbt forbids it in CE',
    ],
    answer: 1,
    why: 'Layering is change management, not aesthetics.',
  },
  {
    id: 'q_watermark',
    topic: 'incremental',
    q: 'A common incremental watermark is…',
    choices: [
      'max(updated_at) from the target relation',
      'min(order_id)',
      'count(*)',
      'random()',
    ],
    answer: 0,
    why: 'Pull rows newer than what you already have. Late facts need merge or backfill.',
  },
  {
    id: 'q_docs',
    topic: 'docs',
    q: 'dbt docs generate builds…',
    choices: [
      'A warehouse table',
      'A lineage catalog from your project metadata + descriptions',
      'A git tag',
      'A package lock',
    ],
    answer: 1,
    why: 'Docs are the map new hires use. Undocumented marts become tribal knowledge.',
  },
  {
    id: 'q_owner',
    topic: 'ops',
    q: 'Ownership metadata matters because…',
    choices: [
      'It looks professional',
      'You must know who to page when a mart is red',
      'dbt Cloud requires it',
      'It replaces tests',
    ],
    answer: 1,
    why: 'Unowned models rot and incidents stall.',
  },
  {
    id: 'q_severity',
    topic: 'tests',
    q: 'When should a relationships test be severity=warn?',
    choices: [
      'For money metrics',
      'When upstream is known-noisy (e.g. CRM) and you accept signal without hard block',
      'Never',
      'Always',
    ],
    answer: 1,
    why: 'Severity is a product risk decision, not a convenience.',
  },
  {
    id: 'q_state',
    topic: 'ci',
    q: 'state:modified compares your project to…',
    choices: [
      'Last git commit only',
      'A prod state artifact (manifest) from ci save',
      'The seed folder',
      'The exposure list',
    ],
    answer: 1,
    why: 'Without an artifact there is nothing reliable to diff against.',
  },
];

export interface ReviewState {
  /** Missed quiz ids → wrong count. */
  misses: Record<string, number>;
  /** Last review timestamp per id. */
  seenAt: Record<string, number>;
  /** Earned score history. */
  scores: { id: string; earned: number; max: number; at: number }[];
}

const KEY = 'learn-dbt:review';

export function loadReview(): ReviewState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as ReviewState;
  } catch {
    /* ignore */
  }
  return { misses: {}, seenAt: {}, scores: [] };
}

export function saveReview(st: ReviewState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch {
    /* ignore */
  }
}

export function recordQuizMiss(id: string): ReviewState {
  const st = loadReview();
  st.misses[id] = (st.misses[id] ?? 0) + 1;
  st.seenAt[id] = Date.now();
  saveReview(st);
  return st;
}

export function recordQuizHit(id: string): ReviewState {
  const st = loadReview();
  st.seenAt[id] = Date.now();
  if (st.misses[id] && st.misses[id] > 0) st.misses[id] -= 1;
  if (st.misses[id] === 0) delete st.misses[id];
  saveReview(st);
  return st;
}

/** Weak items first (spaced review). */
export function reviewQueue(bank: QuizItem[] = quizBank): QuizItem[] {
  const st = loadReview();
  return [...bank].sort((a, b) => {
    const ma = st.misses[a.id] ?? 0;
    const mb = st.misses[b.id] ?? 0;
    if (ma !== mb) return mb - ma;
    const sa = st.seenAt[a.id] ?? 0;
    const sb = st.seenAt[b.id] ?? 0;
    // Spaced: older seen items come first among equals
    return sa - sb;
  });
}

/**
 * Items due for retrieval practice (missed, or not seen in 1+ days).
 */
export function dueForReview(bank: QuizItem[] = quizBank): QuizItem[] {
  const st = loadReview();
  const now = Date.now();
  const day = 86400000;
  return reviewQueue(bank).filter((q) => {
    const seen = st.seenAt[q.id] ?? 0;
    const miss = st.misses[q.id] ?? 0;
    return miss > 0 || !seen || now - seen > day;
  });
}

/**
 * Grade a quiz answer.
 */
export function gradeQuiz(id: string, choice: number): { correct: boolean; why: string; item: QuizItem } {
  const item = quizBank.find((q) => q.id === id) ?? quizBank[0]!;
  const correct = item.answer === choice;
  if (correct) recordQuizHit(id);
  else recordQuizMiss(id);
  return { correct, why: item.why, item };
}
