# learn-dbt

**Live app:** https://alisadeghiaghili.github.io/learn-dbt/

An interactive dbt visualization and tutorial — sandbox, levels, and a command
terminal for learning dbt operations.

learn-dbt teaches dbt by rendering a **model DAG** and letting you type `dbt`
commands until the project state matches the goal.

Git and dbt do not share graph semantics. This is a sandbox for **selection,
materialization, tests, and lineage** — the parts of dbt that are hard to
learn from docs alone.

## Quick start

```bash
npm install
npm run dev
```

Open the printed local URL. Type `help` in the terminal, or click **Levels**.

```bash
npm test        # engine + level solutions
npm run typecheck
npm run build
```

Production build serves from `/learn-dbt/` (GitHub Pages project site). After every push to `main`, GitHub Actions runs tests and deploys `dist/` to Pages.

## Companion: SQL craft

**learn-dbt teaches dbt operations and analytics engineering judgment.**  
Deep SQL writing (joins, window functions, query plans, “write this query from scratch”) is **not** this course — use the companion **`learn-sql`** project (same machine: `Projects/learn-sql`).

Here you only write SQL where it carries **dbt structure** (`ref()`, grain columns, incremental filters). Full SQL fluency belongs in learn-sql.

## What you can do in the app

- **Sandbox** — free-play demo shop DAG
- **Levels** — objective, hint, goal DAG, command golf (cmds vs par)
- **Terminal** — `dbt ls | run | build | test | seed | compile | source freshness`
- **Meta** — `help`, `hint`, `levels`, `steps`, `why`, `show goal`, `hide goal`, `show solution`, `reset`, `undo`
- **Coach** — Goal panel lists official solution commands as a sticky checklist; current step gets an orange neon ring; after each run the terminal prints `Next: …` or `Progress kept. Still on: …`
- **Terminal** — bash-like Tab word completion, ghost remainder of the next command, ↑/↓ history, caret stays in the prompt
- **Progress** — solved levels persist in `localStorage` + cookie; in-progress level work survives mistakes via `sessionStorage`; share posts list what you learned
- **Celebration** — solving a level opens a success dialog with golf stats and share buttons for LinkedIn, X/Twitter, Facebook, plus a copyable permalink (`?level=<id>`)

### Selection grammar (the core curriculum)

| Selector | Meaning |
|----------|---------|
| `model` | exact node |
| `+model` | node and ancestors |
| `model+` | node and descendants |
| `+model+` | both directions |
| `@model` | node, ancestors, descendants, ancestors of descendants |
| `path:models/staging` | path prefix |
| `tag:finance` | tag filter |
| `source:raw.orders` | source (or `source:raw+` downstream) |
| `status:modified` | modified nodes (slim CI) |
| `--exclude model` | subtract from selection |

## Architecture

```
src/
  engine/     pure TypeScript simulator (no DOM)
    types.ts      domain types
    graph.ts      adjacency, ancestors, topo sort
    selection.ts  dbt node selector expansion
    project.ts    ProjectSpec → ProjectState
    commands.ts   terminal command interpreter
    compare.ts    level goal evaluation
  levels/     level definitions (start project, solution, goal)
  ui/         React shell: DAG canvas, terminal, level browser
tests/        vitest unit tests (selection + engine + levels)
```

### Level format

```ts
{
  id: 'intro_run_ancestors',
  sequence: 'intro',
  name: 'Plus means upstream',
  objective: '…',
  hint: 'dbt run --select +fct_orders',
  solution: ['dbt run --select +fct_orders'],
  start: { sources: [...], nodes: [...] },
  goal: {
    built: ['stg_orders', 'int_order_payments', 'fct_orders'],
    builtMode: 'atLeast',
    notBuilt: ['dim_customers'],
  },
}
```

Goal fields: `built` / `builtMode` (`exactly` | `atLeast` | `none`),
`notBuilt`, `testsPassed`, `materializations`, `refs`,
`mustRunCommand`, `selectionIncludes`, `selectionEquals`.

### Engine rules (simulator)

- Build order is topological over the selected subgraph.
- `+` pulls ancestors so dependencies exist before children run.
- A model with a missing upstream gets `status: error`.
- Ephemeral models compile inline and succeed without a relation.
- Incremental models update an existing relation unless `--full-refresh`.
- `dbt build` materializes then runs the node's tests in order.

## Curriculum map

| Sequence | Depth |
|----------|--------|
| Introduction | `ls` / `run` / `+` / `@` / `build` vs `run` |
| Selection grammar | tags, paths, sources, exclude, slim CI |
| Materializations | ephemeral, incremental, missing upstream |
| Writing models | grain, `ref()`/`source()`, staging rules, table vs view |
| Tests & contracts | unique, not_null, relationships, accepted_values, severity, contracts, SCD, seeds, freshness |
| Jinja & packages | vars, macros, packages, incremental strategies, exposures, docs |
| Modeling & ops | layers, fact/dim, ownership, targets, capstone pipeline |
| Advanced Jinja | set/if/for, macro args, is_incremental, package pinning |
| Incident drills | 20 production failures: diagnose root cause, minimal fix |
| Assessment | singular/unit tests + graded capstone (build, diagnose, CI) |
| Warehouse design | BQ partition/cluster, Snowflake merge, Redshift sort, snapshot config |
| Design drills | requirement sentence → correct layer cake DAG |
| Timed exams | scored sprints, 100-point rubric, clock in the toolbar |
| Mega project | 35-node commerce warehouse: blast radius, audit, slim CI |
| Concept quiz | mental models + adaptive spaced review (`quiz`, `review`) |
| Compile fidelity | contracts vs SQL columns; declared interface must exist |
| Data-level tests | unique/not_null/relationships evaluate rows — they fail on bad data |
| Legacy mega repo | 100+ models with naming/layer violations to find and fix |
| SQL transfer | structure/`scoresql` for dbt models — **full SQL craft lives in `learn-sql`** |
| Craft & interview | grain answers, SLI bundles, severity, blast radius, handoff packet |

Authoring commands (`new model`, `edit model`, `add test`, `set config`, `macro`, `deps`, `exposure`, `diagnose`, `ci save/restore`, `warehouse`, `audit`, `quiz`, `review`) mirror real dbt workflows in the simulator.

## Roadmap

Tracked as levels + engine work, not vapor:

1. Level builder + shareable level JSON
2. Certificate / multi-day learning plan
3. Live warehouse adapters (optional, out of browser sandbox)

## License

Apache License 2.0. See [LICENSE](LICENSE).
