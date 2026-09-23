import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  coachLine,
  createProject,
  currentStepIndex,
  executeCommand,
  formatSteps,
  restartFromSpec,
  solutionProgress,
  whyBlock,
} from '../engine';
import type { LevelDef, ProjectState } from '../engine/types';
import { allLevels, getLevel, nextLevelId, sequences } from '../levels';
import { sandboxLevel } from '../levels/sandbox';
import { DagView } from './DagView';
import { Terminal } from './Terminal';
import { layoutDag } from './layout';
import { SolvedDialog } from './SolvedDialog';
import type { SolvedInfo } from './SolvedDialog';
import {
  clearLevelProgress,
  learnedTopics,
  loadLevelProgress,
  loadSolvedList,
  nextLevelUp,
  saveLevelProgress,
  saveSolvedList,
} from './progress';
import { levelIdFromSearch, markLevelSolved } from './share';

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
  solved: SolvedInfo | null;
  undoStack: ProjectState[];
}

function startLevelSession(level: LevelDef, restore = true): Session {
  const fresh: Session = {
    mode: level.id === 'sandbox' ? 'sandbox' : 'level',
    level,
    project: createProject(level.start),
    history: [],
    showGoal: false,
    showHint: false,
    showLevels: false,
    showDialog: Boolean(level.dialog?.length),
    solved: null,
    undoStack: [],
  };
  if (!restore || level.id === 'sandbox') return fresh;
  const saved = loadLevelProgress(level.id);
  if (!saved) return fresh;
  return {
    ...fresh,
    project: saved.project,
    history: saved.history ?? [],
    showDialog: false,
  };
}

function initialState(): Session {
  const fromUrl = typeof window !== 'undefined' ? levelIdFromSearch(window.location.search) : null;
  const lv =
    (fromUrl && fromUrl !== 'sandbox' ? getLevel(fromUrl) : undefined) ??
    (fromUrl === 'sandbox' ? sandboxLevel : undefined) ??
    sandboxLevel;
  return startLevelSession(lv);
}

export function App() {
  const [session, setSession] = useState<Session>(initialState);
  const [solvedList, setSolvedList] = useState<string[]>(() => loadSolvedList());
  const [welcome, setWelcome] = useState<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const level = session.level ?? sandboxLevel;
  const project = session.project;
  const goalLayout = useMemo(() => layoutGoal(level), [level]);
  const liveLayout = useMemo(() => layoutDag(project, project.lastSelection), [project]);

  const par = level.solution.length;
  const steps = useMemo(() => solutionProgress(project, level), [project, level]);
  const coach = useMemo(() => coachLine(project, level), [project, level]);
  const currentIdx = currentStepIndex(steps);
  const nextHint = currentIdx >= 0 ? steps[currentIdx].command : null;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('level', level.id);
    window.history.replaceState({}, '', url.toString());
  }, [level.id]);

  // Welcome back — progress saved (learn-dvc)
  useEffect(() => {
    const solved = loadSolvedList();
    if (!solved.length) return;
    const total = allLevels.length;
    const learned = learnedTopics(allLevels, solved);
    const up = nextLevelUp(allLevels, solved);
    setWelcome(
      [
        `Welcome back — progress saved: ${solved.length}/${total} levels`,
        ...learned.slice(-5).map((t) => `  ✓ ${t}`),
        up ? `Next up: ${up.sequence} / ${up.name}` : 'All sequences cleared.',
      ].join('\n'),
    );
  }, []);

  useEffect(() => {
    if (!welcome) return;
    setSession((s) => ({
      ...s,
      project: {
        ...s.project,
        logs: [...s.project.logs, { kind: 'meta' as const, text: welcome }],
      },
    }));
    setWelcome(null);
  }, [welcome]);

  // persist in-progress work
  useEffect(() => {
    if (level.id === 'sandbox') return;
    saveLevelProgress(level.id, { project, history: session.history });
  }, [project, session.history, level.id]);

  const runMeta = useCallback(
    (raw: string): boolean => {
      const cmd = raw.trim().toLowerCase();
      const histPush = (s: Session): Session => ({
        ...s,
        history: [...s.history, raw],
      });

      if (cmd === 'levels') {
        setSession((s) => histPush({ ...s, showLevels: true }));
        requestAnimationFrame(() => document.getElementById('term-input')?.focus());
        return true;
      }
      if (cmd === 'hint') {
        setSession((s) =>
          histPush({
            ...s,
            showHint: true,
            showDialog: false,
            project: {
              ...s.project,
              logs: [
                ...s.project.logs,
                { kind: 'meta' as const, text: level.hint },
                { kind: 'meta' as const, text: coach ?? 'Type `steps` for the official solution checklist.' },
              ],
            },
          }),
        );
        requestAnimationFrame(() => document.getElementById('term-input')?.focus());
        return true;
      }
      if (cmd === 'steps' || cmd === 'next') {
        setSession((s) =>
          histPush({
            ...s,
            project: {
              ...s.project,
              logs: [...s.project.logs, { kind: 'meta' as const, text: formatSteps(s.project, level) }],
            },
          }),
        );
        requestAnimationFrame(() => document.getElementById('term-input')?.focus());
        return true;
      }
      if (cmd === 'why') {
        const last = project.commandsIssued.filter((c) => c.startsWith('dbt ')).slice(-1)[0];
        const why = (last ? whyBlock(last) : null) ?? 'Run a dbt command first, then type `why`.';
        setSession((s) =>
          histPush({
            ...s,
            project: {
              ...s.project,
              logs: [...s.project.logs, { kind: 'meta' as const, text: why }],
            },
          }),
        );
        requestAnimationFrame(() => document.getElementById('term-input')?.focus());
        return true;
      }
      if (cmd === 'show goal') {
        setSession((s) => histPush({ ...s, showGoal: true }));
        requestAnimationFrame(() => document.getElementById('term-input')?.focus());
        return true;
      }
      if (cmd === 'hide goal') {
        setSession((s) => histPush({ ...s, showGoal: false }));
        requestAnimationFrame(() => document.getElementById('term-input')?.focus());
        return true;
      }
      if (cmd === 'show solution') {
        setSession((s) =>
          histPush({
            ...s,
            showHint: true,
            project: {
              ...s.project,
              logs: [
                ...s.project.logs,
                { kind: 'meta' as const, text: formatSteps({ ...s.project, solved: true }, level) },
                {
                  kind: 'meta' as const,
                  text: 'Official solution above. Run it yourself — watching is not learning.',
                },
              ],
            },
          }),
        );
        requestAnimationFrame(() => document.getElementById('term-input')?.focus());
        return true;
      }
      if (cmd === 'reset') {
        clearLevelProgress(level.id);
        setSession((s) =>
          histPush({
            ...s,
            project: restartFromSpec(s.level?.start ?? sandboxLevel.start),
            undoStack: [],
            solved: null,
          }),
        );
        requestAnimationFrame(() => document.getElementById('term-input')?.focus());
        return true;
      }
      if (cmd === 'undo') {
        setSession((s) => {
          if (!s.undoStack.length) return histPush(s);
          const prev = s.undoStack[s.undoStack.length - 1];
          return histPush({
            ...s,
            project: prev,
            undoStack: s.undoStack.slice(0, -1),
          });
        });
        requestAnimationFrame(() => document.getElementById('term-input')?.focus());
        return true;
      }
      return false;
    },
    [level, coach, project.commandsIssued],
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
        const why = whyBlock(raw);
        if (why) logs.push({ kind: 'meta' as const, text: why });
        if (result.counts && nextCoach && !result.project.solved) {
          logs.push({ kind: 'meta' as const, text: nextCoach });
        } else if (result.counts && result.project.solved) {
          logs.push({ kind: 'meta' as const, text: 'All solution steps met.' });
        }
        const project: ProjectState = { ...result.project, logs, commandsIssued: result.project.commandsIssued };
        const justSolved = project.solved && !s.project.solved && lv.id !== 'sandbox';
        if (justSolved) {
          markLevelSolved(lv.id);
          saveSolvedList([...loadSolvedList().filter((id) => id !== lv.id), lv.id]);
        }
        return {
          ...s,
          project,
          history,
          undoStack,
          solved: justSolved
            ? {
                level: lv,
                commands: project.commandCount,
                par: lv.solution.length || undefined,
                learned: learnedTopics(allLevels, [
                  ...loadSolvedList().filter((id) => id !== lv.id),
                  lv.id,
                ]),
                upNext: (() => {
                  const n = nextLevelId(lv.id);
                  const nl = n ? getLevel(n) : undefined;
                  return nl ? `${nl.sequence} / ${nl.name}` : null;
                })(),
                solvedCount: new Set([...loadSolvedList(), lv.id]).size,
                totalCount: allLevels.length,
              }
            : s.solved,
        };
      });
      setSolvedList(loadSolvedList());
      requestAnimationFrame(() => {
        if (!document.querySelector('.solved-modal')) {
          document.getElementById('term-input')?.focus();
        }
      });
    },
    [runMeta],
  );

  const loadLevel = (id: string) => {
    const lv = id === 'sandbox' ? sandboxLevel : getLevel(id);
    if (!lv) return;
    setSession((s) => {
      // Re-selecting the same level must NOT wipe progress (learn-dvc fix).
      if (s.level?.id === id) {
        return { ...s, showLevels: false, showDialog: false, solved: null };
      }
      return startLevelSession(lv);
    });
    requestAnimationFrame(() => document.getElementById('term-input')?.focus());
  };

  const goNext = () => {
    const id = nextLevelId(level.id);
    if (!id) {
      setSession((s) => ({ ...s, solved: null }));
      return;
    }
    setSession(startLevelSession(getLevel(id)!));
  };

  const replay = () => {
    clearLevelProgress(level.id);
    setSession(startLevelSession(level, false));
  };

  const dismissSolved = () => {
    setSession((s) => ({ ...s, solved: null }));
    requestAnimationFrame(() => document.getElementById('term-input')?.focus());
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
          <button type="button" className="btn" onClick={() => loadLevel('sandbox')}>
            Sandbox
          </button>
          <button type="button" className="btn" onClick={() => setSession((s) => ({ ...s, showLevels: true }))}>
            Levels
          </button>
          <button type="button" className="btn" onClick={() => onRun('hint')}>
            Hint
          </button>
          <button type="button" className="btn" onClick={() => onRun('steps')}>
            Goal
          </button>
          <button type="button" className="btn" onClick={() => onRun('reset')}>
            Reset
          </button>
        </div>
      </header>

      <div className="workspace">
        <main className={`canvas-panel${session.solved ? ' is-celebrating' : ''}`}>
          <DagView layout={liveLayout} title="Project DAG" celebrating={Boolean(session.solved)} />
        </main>

        <aside className="side-panel guide-panel">
          <section className="side-block">
            <h2>You are learning</h2>
            <p>{level.objective}</p>
            {level.learning?.length ? (
              <ul className="learn-list">
                {level.learning.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : null}
          </section>
          {level.solution.length ? (
            <section className="side-block">
              <h2>Goal — solution steps</h2>
              <ol className="sol-steps">
                {steps.map((s, i) => (
                  <li
                    key={`${s.command}-${i}`}
                    className={`${s.done ? 'is-done' : ''}${i === currentIdx && !s.done ? ' is-current' : ''}`}
                  >
                    {i === currentIdx && !s.done ? <span className="now-chip">now</span> : null}
                    <code>{s.command}</code>
                    <span className="step-note">{s.note}</span>
                  </li>
                ))}
              </ol>
              {coach ? <p className="coach-line">{coach}</p> : null}
              <p className="par-note">
                Checklist is sticky — wrong commands do not rewind ticks. Also:{' '}
                <code>steps</code> · <code>hint</code> · <code>why</code>
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
          <section className="side-block">
            <h2>Field notes</h2>
            <p className="field-note">
              {level.fieldNotes?.length
                ? level.fieldNotes.join('\n\n')
                : 'Selection and lineage mistakes are the usual production incidents in analytics engineering. Prefer `dbt build` on the critical path; slim CI with `status:modified+` when the warehouse is large.'}
            </p>
          </section>
        </aside>
      </div>

      <Terminal
        logs={project.logs}
        onRun={onRun}
        history={session.history}
        nextHint={nextHint}
        completions={[...level.solution, ...steps.map((s) => s.command)]}
        autoFocus={!session.solved}
      />

      {session.solved ? (
        <SolvedDialog
          info={session.solved}
          hasNext={Boolean(nextLevelId(session.solved.level.id))}
          onNext={goNext}
          onReplay={replay}
          onDismiss={dismissSolved}
        />
      ) : null}

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
              onClick={() => {
                setSession((s) => ({ ...s, showDialog: false }));
                requestAnimationFrame(() => document.getElementById('term-input')?.focus());
              }}
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
                onClick={() => {
                  setSession((s) => ({ ...s, showLevels: false }));
                  requestAnimationFrame(() => document.getElementById('term-input')?.focus());
                }}
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
                      className={`level-row${l.id === level.id ? ' is-current' : ''}${
                        solvedList.includes(l.id) ? ' is-solved' : ''
                      }`}
                      onClick={() => loadLevel(l.id)}
                    >
                      <span className="lr-name">
                        {solvedList.includes(l.id) ? '✓ ' : ''}
                        {l.name}
                      </span>
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
