import { useEffect, useRef, useState } from 'react';
import { LOCALES, getLocale, setLocale, ui, type Locale } from '../i18n';

export interface ToolbarProps {
  levelTitle: string;
  levelSeq: string;
  cmds: number;
  par: number;
  onLevels: () => void;
  onGuide: () => void;
  onHint: () => void;
  onSolution: () => void;
  onUndo: () => void;
  onReset: () => void;
  onSandbox: () => void;
  onHelp: () => void;
  onLocaleChange: () => void;
}

/**
 * Top toolbar matching the learn-dvc shell: brand, level title, lang menu, nav drawer.
 */
export function Toolbar(props: ToolbarProps) {
  const u = ui();
  const [langOpen, setLangOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setLangOpen(false);
        setNavOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pickLocale = (loc: Locale) => {
    setLocale(loc);
    setLangOpen(false);
    props.onLocaleChange();
  };

  const act = (fn: () => void) => {
    setNavOpen(false);
    setLangOpen(false);
    fn();
  };

  return (
    <header className="toolbar" ref={rootRef}>
      <div className="brand">
        learn<span>-dbt</span>
      </div>
      <div className="level-title">
        <span className="level-seq">{props.levelSeq}</span>
        <span className="level-name">{props.levelTitle}</span>
        <span className="level-cmds">
          {u.cmds} {props.cmds}
          {props.par ? ` / ${u.par} ${props.par}` : ''}
        </span>
      </div>
      <div className="toolbar-actions">
        <div className="lang-menu">
          <button
            type="button"
            className="lang-btn"
            aria-haspopup="menu"
            aria-expanded={langOpen}
            aria-label={u.language}
            onClick={() => {
              setLangOpen((v) => !v);
              setNavOpen(false);
            }}
          >
            <span>{getLocale().toUpperCase()}</span>
            <span className="lang-caret" aria-hidden="true" />
          </button>
          {langOpen ? (
            <div className="lang-dropdown" role="menu">
              {LOCALES.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  className={`lang-option${getLocale() === loc ? ' on' : ''}`}
                  role="menuitem"
                  aria-checked={getLocale() === loc}
                  onClick={() => pickLocale(loc)}
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="nav-toggle"
          aria-label={u.menuLabel}
          aria-expanded={navOpen}
          aria-controls="nav-drawer"
          onClick={() => {
            setNavOpen((v) => !v);
            setLangOpen(false);
          }}
        >
          <span className="nav-bars" aria-hidden="true" />
        </button>

        <div className={`nav-drawer${navOpen ? ' is-open' : ''}`} id="nav-drawer" hidden={!navOpen}>
          <button type="button" onClick={() => act(props.onLevels)}>
            {u.levels}
          </button>
          <button type="button" onClick={() => act(props.onGuide)}>
            {u.guide}
          </button>
          <button type="button" onClick={() => act(props.onHint)}>
            {u.hint}
          </button>
          <button type="button" onClick={() => act(props.onSolution)}>
            {u.solution}
          </button>
          <button type="button" onClick={() => act(props.onUndo)}>
            {u.undo}
          </button>
          <button type="button" onClick={() => act(props.onReset)}>
            {u.reset}
          </button>
          <button type="button" className="ghost" onClick={() => act(props.onSandbox)}>
            {u.sandboxBtn}
          </button>
          <button
            type="button"
            className="help-btn"
            title={u.helpTitle}
            aria-label={u.help}
            onClick={() => act(props.onHelp)}
          >
            ?
          </button>
          <a
            className="tb-link"
            href="https://github.com/alisadeghiaghili/learn-dbt"
            target="_blank"
            rel="noopener noreferrer"
            title={u.githubTitle}
          >
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
