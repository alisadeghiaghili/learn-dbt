import { useEffect, useMemo, useRef, useState } from 'react';
import type { LevelDef } from '../engine/types';
import { buildShareLinks } from './share';
import { ConfettiCanvas } from './ConfettiCanvas';
import { playVictoryFanfare } from './celebrate';

export interface SolvedInfo {
  level: LevelDef;
  commands: number;
  par?: number;
  learned?: string[];
  upNext?: string | null;
  solvedCount?: number;
  totalCount?: number;
}

interface Props {
  info: SolvedInfo;
  hasNext: boolean;
  onNext: () => void;
  onReplay: () => void;
  onDismiss: () => void;
  baseUrl?: string;
}

/**
 * Level-solved celebration: confetti, fanfare, progress share.
 * Enter on the dialog must not instantly close it (learn-dvc focus fix).
 */
export function SolvedDialog({ info, hasNext, onNext, onReplay, onDismiss, baseUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const share = useMemo(
    () =>
      buildShareLinks({
        levelId: info.level.id,
        levelName: info.level.name,
        sequence: info.level.sequence,
        commands: info.commands,
        par: info.par,
        learned: info.learned,
        upNext: info.upNext,
        baseUrl,
      }),
    [info, baseUrl],
  );

  useEffect(() => {
    playVictoryFanfare(muted);
    cardRef.current?.focus();
  }, [muted, info.level.id, info.commands]);

  const golfBadge =
    info.par && info.commands <= info.par ? 'Par met' : info.par ? `Par ${info.par}` : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(share.linkedinText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy share post:', share.linkedinText);
    }
  };

  return (
    <div
      className="modal solved-modal is-party"
      role="dialog"
      aria-modal="true"
      aria-labelledby="solved-title"
      onKeyDown={(e) => {
        // Enter on the dialog chrome must not activate the default button.
        if (e.key === 'Enter' && e.target === cardRef.current) {
          e.preventDefault();
        }
      }}
    >
      <ConfettiCanvas active durationMs={5000} />
      <div
        className="modal-card solved-card party-in"
        ref={cardRef}
        tabIndex={-1}
        role="document"
      >
        <div className="party-badge" aria-hidden="true">
          <div className="party-ring" />
          <div className="party-medal">
            <span className="party-check" />
          </div>
        </div>
        <div className="solved-kicker">You did it</div>
        <h2 id="solved-title" className="party-title">
          {info.level.name}
        </h2>
        <p className="solved-sub">
          Level <strong>{info.level.sequence}</strong> complete in{' '}
          <strong>
            {info.commands} command{info.commands === 1 ? '' : 's'}
          </strong>
          {info.par ? (
            <>
              {' '}
              · par {info.par}
              {golfBadge ? (
                <span className={`golf-badge ${golfBadge === 'Par met' ? 'is-best' : ''}`}>
                  {golfBadge}
                </span>
              ) : null}
            </>
          ) : null}
          {info.solvedCount != null && info.totalCount != null ? (
            <>
              {' '}
              · progress {info.solvedCount}/{info.totalCount}
            </>
          ) : null}
        </p>

        <div className="share-block">
          <div className="share-title">Share what you learned</div>
          {info.learned?.length ? (
            <ul className="learned-list">
              {info.learned.slice(-6).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : null}
          {info.upNext ? <p className="up-next">Up next: {info.upNext}</p> : null}
          <div className="share-actions">
            <a className="btn share-li" href={share.linkedin} target="_blank" rel="noopener noreferrer">
              LinkedIn
            </a>
            <a className="btn share-x" href={share.twitter} target="_blank" rel="noopener noreferrer">
              X / Twitter
            </a>
            <a className="btn share-fb" href={share.facebook} target="_blank" rel="noopener noreferrer">
              Facebook
            </a>
            <button type="button" className="btn" onClick={copyLink}>
              {copied ? 'Copied' : 'Copy post'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setMuted((m) => !m);
                if (muted) playVictoryFanfare(false);
              }}
            >
              {muted ? 'Sound off' : 'Sound on'}
            </button>
          </div>
          <div className="share-preview" title={share.linkedinText}>
            {share.linkedinText.split('\n').map((line, i) => (
              <div key={i}>{line || ' '}</div>
            ))}
          </div>
        </div>

        <div className="solved-actions">
          {hasNext ? (
            <button type="button" className="btn btn-accent btn-party" onClick={onNext}>
              Next level
            </button>
          ) : (
            <button type="button" className="btn btn-accent btn-party" onClick={onDismiss}>
              Finish
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => {
              playVictoryFanfare(muted);
              onReplay();
            }}
          >
            Replay
          </button>
          <button type="button" className="btn" onClick={onDismiss}>
            Keep exploring
          </button>
        </div>
      </div>
    </div>
  );
}
