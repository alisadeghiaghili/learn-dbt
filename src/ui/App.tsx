import { useCallback, useMemo, useState } from 'react';
import {
  coachLine,
  createProject,
  executeCommand,
  formatSteps,
  restartFromSpec,
  solutionProgress,
} from '../engine';
import type { LevelDef, ProjectState } from '../engine/types';
import { allLevels, getLevel, nextLevelId, sequences } from '../levels';
import { sandboxLevel } from '../levels/sandbox';
import { DagView } from './DagView';
import { Terminal } from './Terminal';
import { layoutDag } from './layout';

type Mode = 'sandbox' | 'level';

interface Session {
  mode: Mode;
  level?: LevelDef;
  project: ProjectState;
  history: string[];
  showGoal: boolean;
  showHint: boolean;
  showLevels: boolean;
  showDialog: boolean;
  solvedFlash: string | null;
  undoStack: ProjectState[];
}

function initialState(): Session {
  return {
    mode: 'sandbox',
    level: sandboxLevel,
    project: createProject(sandboxLevel.start),
    history: [],
    showGoal: false,
    showHint: false,
    showLevels: false,
    showDialog: false,
    solvedFlash: null,
    undoStack: [],
  };
}

function startLevelSession(level: LevelDef): Session {
  return {
    mode: level.id === 'sandbox' ? 'sandbox' : 'level',
    level,
    project: createProject(level.start),
    history: [],
    showGoal: false,
    showHint: false,
    showLevels: false,
    showDialog: Boolean(level.dialog?.length),
    solvedFlash: null,
    undoStack: [],
  };
}

export function App() {
  const [session, setSession] = useState<Session>(initialState);

  const level = session.level ?? sandboxLevel;
  const project = session.project;
  const goalLayout = useMemo(
    () => layoutGoal(level),
    [level],
  );
  const liveLayout = useMemo(
    () => layoutDag(project, project.lastSelection),
    [project],
  );

  const par = level.solution.length;
  const steps = useMemo(() => solutionProgress(project, level), [project, level]);
  const coach = useMemo(() => coachLine(project, level), [project, level]);

  const pushLog = useCallback((kind: ProjectState['logs'][number]['kind'], text: string) => {
    setSession((s) => ({
      ...s,
      project: {
        ...s.project,
        logs: [...s.project.logs, { kind, text }],
      },
    }));
  }, []);

  const runMeta = useCallback(
    (raw: string): boolean => {
      const cmd = raw.trim().toLowerCase();
      if (cmd === 'levels') {
        setSession((s) => ({ ...s, showLevels: true, showGoal: false }));
        return true;
      }
      if (cmd === 'hint') {
        setSession((s) => ({ ...s, showHint: true, showDialog: false }));
        pushLog('meta', level.hint);
        pushLog('meta', coach ?? 'Type `steps` for the official solution checklist.');
        return true;
      }
      if (cmd === 'steps' || cmd === 'next') {
        pushLog('meta', formatSteps(session.project, level));
        return true;
      }
      if (cmd === 'show goal') {
        setSession((s) => ({ ...s, showGoal: true }));
        return true;
      }
      if (cmd === 'hide goal') {
        setSession((s) => ({ ...s, showGoal: false }));
        return true;
      }
      if (cmd === 'show solution') {
        setSession((s) => ({
          ...s,
          project: {
            ...s.project,
            logs: [
              ...s.project.logs,
              { kind: 'meta' as const, text: formatSteps({ ...s.project, solved: true }, level) },
              { kind: 'meta' as const, text: 'Official solution above. Run it yourself — watching is not learning.' },
              { kind: 'meta' as const, text: `solution: ${level.solution.join('; ')}` },
            ],
          },
          showHint: true,
        }));
        return true;
      }
      if (cmd === 'reset') {
        setSession((s) => {
          const base = s.level ?? sandboxLevel;
          return {
            ...s,
            project: restartFromSpec(base.start),
            undoStack: [],
            solvedFlash: null,
          };
        });
        return true;
      }
      if (cmd === 'undo') {
        setSession((s) => {
          if (!s.undoStack.length) return s;
          const prev = s.undoStack[s.undoStack.length - 1];
          return {
            ...s,
            project: prev,
            undoStack: s.undoStack.slice(0, -1),
          };
        });
        return true;
      }
      return false;
    },
    [level, coach, pushLog, session.project],
  );

  const onRun = useCallback(
    (raw: string) => {
      if (runMeta(raw)) return;

      setSession((s) => {
        const lv = s.level ?? sandboxLevel;
        const goal = s.level && s.level.id !== 'sandbox' ? s.level.goal : undefined;
        const result = executeCommand(raw, s.project, goal);
        const history = [...s.history, raw];
        const undoStack = [...s.undoStack, s.project].slice(-30);
        const nextCoach = coachLine(result.project, lv);
        const logs = [...result.project.logs];
        if (result.counts && nextCoach && !result.project.solved) {
          logs.push({ kind: 'meta' as const, text: nextCoach });
        } else if (result.counts && result.project.solved) {
          logs.push({ kind: 'meta' as const, text: 'All solution steps met.' });
        }
        const project: ProjectState = { ...result.project, logs };
        const solvedFlash =
          project.solved && !s.project.solved
            ? `Solved ${lv.name} in ${project.commandCount} command(s)${par ? ` (par ${par})` : ''}`
            : s.solvedFlash;
        return {
          ...s,
          project,
          history,
          undoStack,
          solvedFlash,
        };
      });
    },
    [runMeta, par],
  );

  const loadLevel = (id: string) => {
    const lv = id === 'sandbox' ? sandboxLevel : getLevel(id);
    if (!lv) return;
    setSession(startLevelSession(lv));
  };

  const goNext = () => {
    const id = nextLevelId(level.id);
    if (id) loadLevel(id);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">learn-dbt</span>
          <span className="brand-sub">interactive dbt tutorial</span>
        </div>
        <div className="level-meta">
          <span className="level-seq">{level.sequence}</span>
          <span className="level-name">{level.name}</span>
          <span className="level-cmds">
            cmds {project.commandCount}
            {par ? ` / par ${par}` : ''}
          </span>
        </div>
        <div className="top-actions">
          <button type="button" className="btn" onClick={() => setSession((s) => ({ ...s, showLevels: true }))}>
            Levels
          </button>
          <button type="button" className="btn" onClick={() => onRun('hint')}>
            Hint
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setSession((s) => ({ ...s, showGoal: !s.showGoal }))}
          >
            {session.showGoal ? 'Hide goal' : 'Show goal'}
          </button>
          <button type="button" className="btn" onClick={() => onRun('reset')}>
            Reset
          </button>
        </div>
      </header>

      <div className="workspace">
        <main className="canvas-panel">
          <DagView layout={liveLayout} title="Project DAG" />
          {session.solvedFlash ? (
            <div className="solved-banner" role="status">
              <span>{session.solvedFlash}</span>
              <button type="button" className="btn btn-accent" onClick={goNext}>
                Next level
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setSession((s) => ({ ...s, solvedFlash: null }))}
              >
                Dismiss
              </button>
            </div>
          ) : null}
        </main>

        <aside className="side-panel">
          <section className="side-block">
            <h2>Objective</h2>
            <p>{level.objective}</p>
          </section>
          {level.solution.length ? (
            <section className="side-block">
              <h2>Goal — solution steps</h2>
              <ol className="sol-steps">
                {steps.map((s, i) => (
                  <li key={`${s.command}-${i}`} className={s.done ? 'is-done' : ''}>
                    <code>{s.command}</code>
                    <span className="step-note">{s.note}</span>
                  </li>
                ))}
              </ol>
              {coach ? <p className="coach-line">{coach}</p> : null}
              <p className="par-note">
                Checklist is the official solution. Also: <code>steps</code> · <code>hint</code> ·{' '}
                <code>show goal</code>
              </p>
            </section>
          ) : (
            <section className="side-block">
              <h2>Sandbox</h2>
              <p className="coach-line">{coach ?? 'Type `help` for commands.'}</p>
            </section>
          )}
          {session.showHint ? (
            <section className="side-block">
              <h2>Hint</h2>
              <p className="mono">{level.hint}</p>
            </section>
          ) : null}
          {session.showGoal ? (
            <section className="side-block">
              <DagView layout={goalLayout} title="Goal (reference)" ghost />
            </section>
          ) : null}
        </aside>
      </div>

      <Terminal logs={project.logs} onRun={onRun} history={session.history} />

      {session.showDialog && level.dialog?.length ? (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            {level.dialog.map((d, i) => (
              <div key={i}>
                <h2>{d.title}</h2>
                <p>{d.body}</p>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => setSession((s) => ({ ...s, showDialog: false }))}
            >
              Start
            </button>
          </div>
        </div>
      ) : null}

      {session.showLevels ? (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card levels-card">
            <div className="modal-head">
              <h2>Levels</h2>
              <button
                type="button"
                className="btn"
                onClick={() => setSession((s) => ({ ...s, showLevels: false }))}
              >
                Close
              </button>
            </div>
            <button type="button" className="level-row" onClick={() => loadLevel('sandbox')}>
              <span className="lr-name">Sandbox</span>
              <span className="lr-about">Free play</span>
            </button>
            {sequences.map((seq) => (
              <div key={seq.id} className="seq-block">
                <div className="seq-title">{seq.title}</div>
                <div className="seq-about">{seq.about}</div>
                {allLevels
                  .filter((l) => l.sequence === seq.id)
                  .map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className={`level-row${l.id === level.id ? ' is-current' : ''}`}
                      onClick={() => loadLevel(l.id)}
                    >
                      <span className="lr-name">{l.name}</span>
                      <span className="lr-about">{l.objective.split('\n')[0].slice(0, 80)}</span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function layoutGoal(level: LevelDef) {
  // Goal DAG = start graph, but show expected built nodes as success.
  const project = createProject(level.start);
  const expected = level.goal.built ?? [];
  const mode = level.goal.builtMode ?? 'exactly';
  if (mode !== 'none') {
    for (const id of expected) {
      const n = project.nodes[id];
      if (n) {
        n.status = 'success';
        n.hasRelation = true;
      }
    }
  }
  return layoutDag(project, expected);
}

export default App;
