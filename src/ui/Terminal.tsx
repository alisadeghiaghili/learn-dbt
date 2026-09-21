import { useEffect, useRef, useState } from 'react';
import type { LogLine } from '../engine/types';

interface Props {
  logs: LogLine[];
  onRun: (cmd: string) => void;
  history: string[];
}

/**
 * Terminal input + output log.
 *
 * Args:
 *   logs: Log lines to display.
 *   onRun: Callback when the user submits a command.
 *   history: Previous commands for arrow-key navigation.
 * Returns:
 *   React terminal panel.
 */
export function Terminal({ logs, onRun, history }: Props) {
  const [value, setValue] = useState('dbt ');
  const [histIdx, setHistIdx] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const submit = () => {
    const cmd = value.trim();
    if (!cmd) return;
    onRun(cmd);
    setValue('dbt ');
    setHistIdx(-1);
  };

  return (
    <div className="terminal">
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
        <input
          id="term-input"
          ref={inputRef}
          className="term-input"
          value={value}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (!history.length) return;
              const next = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
              setHistIdx(next);
              setValue(history[next]);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (histIdx < 0) return;
              const next = histIdx + 1;
              if (next >= history.length) {
                setHistIdx(-1);
                setValue('dbt ');
              } else {
                setHistIdx(next);
                setValue(history[next]);
              }
            }
          }}
        />
        <button type="submit" className="btn btn-accent">
          Run
        </button>
      </form>
    </div>
  );
}
