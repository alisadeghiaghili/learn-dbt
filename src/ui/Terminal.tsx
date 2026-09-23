import { useEffect, useMemo, useRef, useState } from 'react';
import type { LogLine } from '../engine/types';

interface Props {
  logs: LogLine[];
  onRun: (cmd: string) => void;
  history: string[];
  /** Official next command for placeholder + first-word Tab. */
  nextHint?: string | null;
  completions?: string[];
  autoFocus?: boolean;
}

function parseLine(value: string): { head: string[]; current: string; afterSpace: boolean } {
  const afterSpace = value === '' || /\s$/.test(value);
  const tokens = value.trim() === '' ? [] : value.trim().split(/\s+/);
  if (afterSpace) return { head: tokens, current: '', afterSpace: true };
  const current = tokens[tokens.length - 1] ?? '';
  return { head: tokens.slice(0, -1), current, afterSpace: false };
}

function measureText(text: string, font: string): number {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return text.length * 8;
    ctx.font = font;
    return ctx.measureText(text).width;
  } catch {
    return text.length * 8;
  }
}

/**
 * Terminal with bash-like word-by-word Tab completion and word-suffix ghost.
 * Empty input uses placeholder only — ghost never stacks on top (learn-dvc fix).
 */
export function Terminal({
  logs,
  onRun,
  history,
  nextHint,
  completions = [],
  autoFocus = true,
}: Props) {
  const [value, setValue] = useState('');
  const [histIdx, setHistIdx] = useState(-1);
  const [draft, setDraft] = useState('');
  const [tabInfo, setTabInfo] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const wordState = useRef<{ key: string; cycle: string[]; idx: number }>({
    key: '',
    cycle: [],
    idx: 0,
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [logs.length, autoFocus]);

  const pool = useMemo(() => {
    const base = [
      'dbt',
      'dbt ls',
      'dbt run',
      'dbt build',
      'dbt test',
      'dbt seed',
      'dbt compile',
      'dbt run --select',
      'dbt build --select',
      'dbt test --select',
      'dbt run --exclude',
      'dbt run --full-refresh',
      '--select',
      '--exclude',
      '--full-refresh',
      'help',
      'hint',
      'steps',
      'why',
      'show goal',
      'hide goal',
      'show solution',
      'reset',
      'undo',
      'levels',
    ];
    return [...new Set([...(nextHint ? [nextHint] : []), ...completions, ...base, ...history.slice().reverse()])];
  }, [completions, history, nextHint]);

  /** Words that can fill the current (or next) token. */
  const nextWords = (head: string[], current: string): string[] => {
    const afterSpace = current === '';
    const words = new Set<string>();
    for (const line of pool) {
      const toks = line.trim().split(/\s+/);
      const at = head.length;
      const w = toks[at];
      if (!w) continue;
      if (afterSpace) {
        // next full word after a typed head
        if (toks.slice(0, head.length).every((t, i) => t === head[i])) {
          words.add(w);
        }
      } else if (w.toLowerCase().startsWith(current.toLowerCase())) {
        // complete current word only
        if (head.every((h, i) => toks[i] === h)) {
          words.add(w);
        }
      }
    }
    // solution / hint first
    if (nextHint) {
      const toks = nextHint.trim().split(/\s+/);
      const w = toks[head.length];
      if (w && (afterSpace || w.toLowerCase().startsWith(current.toLowerCase()))) {
        return [w, ...[...words].filter((x) => x !== w)];
      }
    }
    return [...words];
  };

  // Ghost: only remainder of the *current word*, only while typing.
  useEffect(() => {
    const ghost = ghostRef.current;
    const wrap = wrapRef.current;
    if (!ghost || !wrap) return;
    ghost.textContent = '';
    ghost.style.left = '10px';
    wrap.classList.remove('has-ghost');
    if (!value) return;

    const { head, current, afterSpace } = parseLine(value);
    const options = nextWords(head, afterSpace ? '' : current);
    const first = options[0];
    if (!first) return;

    const font = '13px Cascadia Code, Consolas, ui-monospace, monospace';
    const textWidth = measureText(value, font);

    if (afterSpace) {
      ghost.textContent = first;
      ghost.style.left = `${10 + textWidth + 4}px`;
      wrap.classList.add('has-ghost');
      return;
    }
    if (!first.toLowerCase().startsWith(current.toLowerCase()) || first.length <= current.length) {
      return;
    }
    // suffix of current word only — never the whole command
    ghost.textContent = first.slice(current.length);
    ghost.style.left = `${10 + textWidth}px`;
    wrap.classList.add('has-ghost');
  }, [value, pool, nextHint]);

  const applyTab = () => {
    const { head, current, afterSpace } = parseLine(value);
    const cycleKey = `${head.join(' ')}|${afterSpace ? '' : current}`;

    if (!value && nextHint) {
      // First Tab from empty: only the first word (e.g. "dbt"), not the full command.
      const firstWord = nextHint.split(/\s+/)[0]!;
      setValue(firstWord);
      wordState.current = { key: firstWord, cycle: [firstWord], idx: 0 };
      setTabInfo(null);
      return;
    }

    const options = nextWords(head, afterSpace ? '' : current);
    if (!options.length) {
      setTabInfo(null);
      return;
    }

    if (cycleKey !== wordState.current.key || !wordState.current.cycle.length) {
      wordState.current = { key: cycleKey, cycle: options, idx: 0 };
    } else {
      wordState.current.idx = (wordState.current.idx + 1) % wordState.current.cycle.length;
    }

    const chosen = wordState.current.cycle[wordState.current.idx] ?? options[0]!;
    const headText = head.length ? `${head.join(' ')} ` : '';
    // Leave a trailing space so the next Tab advances to the next word.
    setValue(`${headText}${chosen}`);

    if (wordState.current.cycle.length > 1) {
      const preview = wordState.current.cycle.slice(0, 6).join(' · ');
      setTabInfo(
        `Tab word ${wordState.current.idx + 1}/${wordState.current.cycle.length}: ${preview}`,
      );
    } else {
      setTabInfo(null);
    }
  };

  const submit = () => {
    const cmd = value.trim();
    if (!cmd) return;
    onRun(cmd);
    setValue('');
    setHistIdx(-1);
    setDraft('');
    setTabInfo(null);
    wordState.current = { key: '', cycle: [], idx: 0 };
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const placeholder = nextHint
    ? `Next: ${nextHint}  (Tab steps word-by-word)`
    : 'Type a dbt command…  (↑/↓ history · Tab completes one word)';

  return (
    <div className="terminal">
      {nextHint ? (
        <div className="term-next-strip">
          <span>
            Next: <code>{nextHint}</code>
          </span>
          <span className="term-next-tip">Tab fills one word at a time</span>
        </div>
      ) : null}
      {tabInfo ? <div className="term-next-strip tab-info">{tabInfo}</div> : null}
      <div className="term-logs" ref={scrollRef} aria-live="polite">
        {logs.length === 0 ? (
          <div className="term-empty">Type a dbt command. Try `help`.</div>
        ) : (
          logs.map((l, i) => (
            <div key={i} className={`term-line term-${l.kind}`}>
              <span className="term-text">{l.text}</span>
            </div>
          ))
        )}
      </div>
      <form
        className="term-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="term-prompt" htmlFor="term-input">
          dbt ▸
        </label>
        <div className="term-input-wrap" ref={wrapRef}>
          <input
            id="term-input"
            ref={inputRef}
            className="term-input"
            value={value}
            spellCheck={false}
            autoComplete="off"
            placeholder={placeholder}
            onChange={(e) => {
              setValue(e.target.value);
              setTabInfo(null);
              wordState.current = { key: '', cycle: [], idx: 0 };
            }}
            onBlur={() => {
              if (autoFocus && !document.querySelector('.solved-modal')) {
                requestAnimationFrame(() => inputRef.current?.focus());
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                applyTab();
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setValue('');
                setTabInfo(null);
                wordState.current = { key: '', cycle: [], idx: 0 };
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!history.length) return;
                if (histIdx < 0) setDraft(value);
                const next = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
                setHistIdx(next);
                setValue(history[next]);
                wordState.current = { key: '', cycle: [], idx: 0 };
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (histIdx < 0) return;
                const next = histIdx + 1;
                if (next >= history.length) {
                  setHistIdx(-1);
                  setValue(draft);
                } else {
                  setHistIdx(next);
                  setValue(history[next]);
                }
                wordState.current = { key: '', cycle: [], idx: 0 };
              }
            }}
          />
          <span className="term-ghost" ref={ghostRef} aria-hidden="true" />
        </div>
        <button type="submit" className="btn btn-accent">
          Run
        </button>
      </form>
    </div>
  );
}
