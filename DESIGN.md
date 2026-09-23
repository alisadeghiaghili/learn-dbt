# learn-dbt — Design Notes

## Product mapping

Interactive git-tree tutorials and this app share a product *shape* (sandbox + terminal + levels + goal), not a domain model. Git mutates pointers over immutable commits. dbt selects a subgraph and materializes nodes in topological order. The engine is a dbt simulator, not a port of any git engine.

## Style anchor

Warehouse console / data-ops tool — dbt Cloud lineage + a night-shift terminal. Not a SaaS marketing page. Dense, mono-forward, hairline panels.

## Palette

| Token | Hex | Role |
|-------|-----|------|
| `--bg` | `#0A0F1A` | App background |
| `--panel` | `#111827` | Panels, terminal chrome |
| `--border` | `#1F2937` | Hairline rules |
| `--ink` | `#F3F4F6` | Primary text |
| `--muted` | `#9CA3AF` | Secondary text, captions |
| `--accent` | `#FF6B35` | Primary action, selection glow |
| `--source` | `#38BDF8` | Source nodes |
| `--staging` | `#2DD4BF` | Staging models |
| `--intermediate` | `#FBBF24` | Intermediate models |
| `--mart` | `#34D399` | Mart / exposure nodes |
| `--error` | `#F87171` | Failed nodes / error log |
| `--ok` | `#22C55E` | Success ring / solved |

## Typography

- **UI / display**: `system-ui, 'Segoe UI', sans-serif` — level titles 18–22px/700, body 13–14px/400
- **Mono**: `'Cascadia Code', Consolas, ui-monospace, monospace` — terminal, node names, commands, status badges
- Scale is tool-dense: no hero type. Contrast comes from mono vs sans and layer color, not size theater.

## Layout

```
┌──────────────────────────────────────────────────────┐
│ brand │ level title │ cmds n/par │ Levels Hint Goal Reset │
├────────────────────────────────────┬─────────────────┤
│                                    │ Goal (ghost DAG)│
│         Live DAG canvas            │ Objective text  │
│         (layered L→R)              │ Hint (toggle)   │
├────────────────────────────────────┴─────────────────┤
│ dbt ▸ terminal input                                  │
│ output log (scroll)                                   │
└──────────────────────────────────────────────────────┘
```

- Canvas is the primary surface (~70% height on desktop).
- Goal drawer is a side panel, not a floating card grid.
- Bottom terminal is always visible — the command line is the product.

## Signature moment

When a selection runs (`dbt run --select +stg_orders+`), selected nodes highlight in **topological order**: each node pulses to `--accent`, then settles to success/error. The subgraph lights up as a wave along the DAG — this is what selection *feels* like.

Motion is gated by `prefers-reduced-motion: no-preference`.

## Constraints

- System fonts only (no CDN font dependency).
- Inline SVG DAG — no external graph library.
- Client-only: no backend, no warehouse. Simulation is in-browser.
- Files, code, comments: English. UI copy: English (LGB parity).
- No AI attribution anywhere in the repository.
