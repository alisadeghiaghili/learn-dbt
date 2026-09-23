import { useEffect, useMemo, useRef, useState } from 'react';
import type { LogLine } from '../engine/types';

interface Props {
  logs: LogLine[];
  onRun: (cmd: string) => void;
  history: string[];
  /** Next official command for ghost/placeholder (learn-dvc terminal). */
  nextHint?: string | null;
  /** Extra completion candidates (solution + common dbt cmds). */
  completions?: string[];
  /** Blur input when true (celebration modal). */
  autoFocus?: boolean;
}

/**
 * Terminal input + output log with bash-like Tab completion and history.
 *
 * Args:
 *   logs: Log lines to display.
 *   onRun: Callback when the user submits a command.
 *   history: Previous commands for arrow-key navigation.
 *   nextHint: Official next command for placeholder/ghost.
 *   completions: Word/line completion candidates.
 *   autoFocus: Keep caret in the prompt after renders when true (default).
 * Returns:
 *   React terminal panel.
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
  const tabState = useRef<{ wordIdx: number; cycle: number; key: string }>({
    wordIdx: 0,
    cycle: 0,
    key: '',
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
      'dbt ls',
      'dbt run --select ',
      'dbt build --select ',
      'dbt test --select ',
      'dbt run --select +',
      'dbt run --select status:modified+',
      'help',
      'hint',
      'steps',
      'show goal',
      'reset',
    ];
    return [...new Set([...(nextHint ? [nextHint] : []), ...completions, ...base, ...history.slice().reverse()])];
  }, [completions, history, nextHint]);

  const ghostSuffix = useMemo(() => {
    // Show only the remainder of the current word (learn-dvc ghost fix).
    if (!value.trim() || !nextHint) return '';
    const words = value.split(/(\s+)/);
    const hintWords = nextHint.split(/(\s+)/);
    // compare non-space tokens
    let vi = 0;
    let hi = 0;
    while (vi < words.length && hi < hintWords.length) {
      if (/^\s+$/.test(words[vi])) {
        vi++;
        continue;
      }
      if (/^\s+$/.test(hintWords[hi])) {
        hi++;
        continue;
      }
      const cur = words[vi];
      const target = hintWords[hi];
      if (value.length <= value.indexOf(cur) + cur.length) {
        // on this word
        if (target.startsWith(cur) && cur.length < target.length) {
          // ghost = rest of word after caret-ish (suffix of current word)
          return target.slice(cur.length);
        }
        return '';
      }
      if (cur !== target) return '';
      vi++;
      hi++;
    }
    return '';
  }, [value, nextHint]);

  const placeholder = nextHint
    ? `Next: ${nextHint}  (Tab steps word-by-word)`
    : 'Type a dbt command…  (↑/↓ history · Tab complete)';

  const completeWord = () => {
    const endsWithSpace = /\s$/.test(value) || value === '';
    const tokens = value.trimEnd() === '' ? [''] : value.trimEnd().split(/\s+/);
    const wordIdx = endsWithSpace ? tokens.length : tokens.length - 1;
    const partial = endsWithSpace ? '' : tokens[wordIdx] ?? '';
    const tabKey = `${wordIdx}:${partial}`;

    if (tabState.current.key !== tabKey) {
      tabState.current = { wordIdx, cycle: 0, key: tabKey };
    }

    // Build candidate full lines then extract the word at wordIdx
    const candidates = pool.filter((c) => {
      const cWords = c.trim().split(/\s+/);
      const w = cWords[wordIdx] ?? '';
      return w.startsWith(partial) && (partial || wordIdx > 0 || w.length);
    });

    if (!candidates.length) {
      setTabInfo(null);
      return;
    }

    // unique words at this position
    const words = [...new Set(candidates.map((c) => c.trim().split(/\s+/)[wordIdx] ?? ''))].filter(
      (w) => w && w.startsWith(partial),
    );
    if (!words.length) {
      setTabInfo(null);
      return;
    }

    const pick = words[tabState.current.cycle % words.length];
    tabState.current.cycle += 1;
    const nextTokens = [...tokens.slice(0, wordIdx), pick];
    setValue(nextTokens.join(' ') + ' ');
    if (words.length > 1) {
      setTabInfo(`Tab word ${tabState.current.cycle}/${words.length}: ${words.join('  ')}`);
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
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className="terminal">
      {nextHint ? (
        <div className="term-next-strip">
          <span>Next: {nextHint}</span>
          <span className="term-next-tip">press Tab to fill</span>
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
        <div className="term-input-wrap">
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
              tabState.current.key = '';
            }}
            onBlur={() => {
              // keep caret unless a modal stole focus intentionally
              if (autoFocus && !document.querySelector('.solved-modal')) {
                requestAnimationFrame(() => inputRef.current?.focus());
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                completeWord();
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setValue('');
                setTabInfo(null);
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!history.length) return;
                if (histIdx < 0) setDraft(value);
                const next = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
                setHistIdx(next);
                setValue(history[next]);
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
              }
            }}
          />
          <span className="term-ghost" ref={ghostRef} aria-hidden="true">
            {ghostSuffix}
          </span>
        </div>
        <button type="submit" className="btn btn-accent">
          Run
        </button>
      </form>
    </div>
  );
}
