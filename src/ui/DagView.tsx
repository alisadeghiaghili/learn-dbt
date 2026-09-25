import type { DagLayout } from './layout';
import { layerColor } from './layout';

interface Props {
  layout: DagLayout;
  title?: string;
  ghost?: boolean;
  /** When true, success nodes pulse green (level solved). */
  celebrating?: boolean;
}

/**
 * SVG rendering of a dbt DAG.
 *
 * Args:
 *   layout: Computed node/edge positions.
 *   title: Optional panel title.
 *   ghost: When true, render as a dim goal outline.
 *   celebrating: Pulse successful nodes during the solve celebration.
 * Returns:
 *   React SVG element.
 */
export function DagView({ layout, title, ghost = false, celebrating = false }: Props) {
  const pos = new Map(layout.nodes.map((n) => [n.id, n]));

  return (
    <div className={`dag-wrap${ghost ? ' dag-ghost' : ''}${celebrating ? ' dag-party' : ''}`}>
      {title ? <div className="dag-title">{title}</div> : null}
      <svg
        className="dag-svg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={title ?? 'dbt DAG'}
        style={{ direction: 'ltr' }}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted)" />
          </marker>
        </defs>

        {layout.edges.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x + 140;
          const y1 = a.y + 22;
          const x2 = b.x;
          const y2 = b.y + 22;
          const mx = (x1 + x2) / 2;
          return (
            <path
              key={`${e.from}->${e.to}-${i}`}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1.5"
              markerEnd="url(#arrow)"
              opacity={ghost ? 0.45 : 0.9}
            />
          );
        })}

        {layout.nodes.map((n) => {
          const fill = layerColor[n.layer] ?? 'var(--muted)';
          const statusClass =
            n.status === 'success'
              ? 'is-ok'
              : n.status === 'error'
                ? 'is-err'
                : n.status === 'skipped'
                  ? 'is-skip'
                  : 'is-pending';
          const party = celebrating && n.status === 'success' ? ' is-party' : '';
          return (
            <g
              key={n.id}
              className={`dag-node ${statusClass}${n.selected ? ' is-sel' : ''}${party}`}
            >
              <rect
                x={n.x}
                y={n.y}
                width={140}
                height={44}
                rx={8}
                fill="var(--panel)"
                stroke={n.selected ? 'var(--accent)' : fill}
                strokeWidth={n.selected || party ? 2.5 : 1.5}
              />
              <rect x={n.x} y={n.y} width={6} height={44} rx={2} fill={fill} />
              <text x={n.x + 14} y={n.y + 18} className="dag-label" fill="var(--ink)" direction="ltr">
                {truncate(n.label, 18)}
              </text>
              <text x={n.x + 14} y={n.y + 34} className="dag-meta" fill="var(--muted)" direction="ltr">
                {n.materialization}
                {n.status === 'success' ? ' · built' : n.status === 'error' ? ' · error' : ''}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, Math.max(1, n - 1)) + '…';
}

// Model names are technical English — keep them LTR even in RTL UI.

