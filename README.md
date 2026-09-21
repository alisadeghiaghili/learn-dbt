# learn-dbt

An interactive dbt visualization and tutorial — the same product shape as
[learnGitBranching](https://github.com/pcottle/learnGitBranching), rebuilt for
dbt operations.

learnGitBranching teaches git by rendering a commit tree and letting you type
commands until the tree matches the goal. learn-dbt teaches dbt by rendering a
**model DAG** and letting you type `dbt` commands until the project state
matches the goal.

Git and dbt do not share graph semantics. This is not a port of the git
engine. It is a sandbox for **selection, materialization, tests, and lineage** —
the parts of dbt that are hard to learn from docs alone.

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

## What you can do in the app

- **Sandbox** — free-play demo shop DAG
- **Levels** — objective, hint, goal DAG, command golf (cmds vs par)
- **Terminal** — `dbt ls | run | build | test | seed | compile | source freshness`
- **Meta** — `help`, `hint`, `levels`, `show goal`, `hide goal`, `show solution`, `reset`, `undo`

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

## Roadmap

Tracked as levels + engine work, not vapor:

1. Graph mutation commands (`new model`, `set ref`) for lineage-editing levels
2. Circular dependency challenges
3. Dev vs prod targets and state comparison UI polish
4. Level builder + shareable level JSON
5. Certificate / progress persistence

## License

Apache License 2.0. See [LICENSE](LICENSE).
