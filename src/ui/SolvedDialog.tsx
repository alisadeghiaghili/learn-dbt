import { useEffect, useMemo, useState } from 'react';
import type { LevelDef } from '../engine/types';
import { buildShareLinks } from './share';
import { ConfettiCanvas } from './ConfettiCanvas';
import { playVictoryFanfare } from './celebrate';

export interface SolvedInfo {
  level: LevelDef;
  commands: number;
  par?: number;
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
 * Level-solved celebration dialog: party entrance, confetti, fanfare, social share.
 *
 * Args:
 *   info: Solved level metadata.
 *   hasNext: Whether a next level exists.
 *   onNext: Load next level.
 *   onReplay: Restart the same level.
 *   onDismiss: Close the dialog.
 *   baseUrl: Optional app origin override for share links.
 * Returns:
 *   Modal celebration UI.
 */
export function SolvedDialog({ info, hasNext, onNext, onReplay, onDismiss, baseUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [pulse, setPulse] = useState(0);

  const share = useMemo(
    () =>
      buildShareLinks({
        levelId: info.level.id,
        levelName: info.level.name,
        sequence: info.level.sequence,
        commands: info.commands,
        par: info.par,
        baseUrl,
      }),
    [info, baseUrl],
  );

  useEffect(() => {
    playVictoryFanfare(muted);
    setPulse((n) => n + 1);
  }, [muted, info.level.id, info.commands]);

  const golfBadge =
    info.par && info.commands <= info.par
      ? 'Par met'
      : info.par
        ? `Par ${info.par}`
        : null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      window.prompt('Copy share link:', share.url);
    }
  };

  return (
    <div className="modal solved-modal is-party" role="dialog" aria-modal="true" aria-labelledby="solved-title">
      <ConfettiCanvas active durationMs={5000} />
      <div className="modal-card solved-card party-in" key={pulse}>
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
              {golfBadge ? <span className={`golf-badge ${golfBadge === 'Par met' ? 'is-best' : ''}`}>{golfBadge}</span> : null}
            </>
          ) : null}
        </p>
        <p className="party-line">Goal met. The DAG is in the state you targeted.</p>

        <div className="share-block">
          <div className="share-title">Share the win</div>
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
              {copied ? 'Link copied' : 'Copy link'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setMuted((m) => !m);
                if (muted) playVictoryFanfare(false);
              }}
              aria-pressed={muted}
            >
              {muted ? 'Sound off' : 'Sound on'}
            </button>
          </div>
          <div className="share-preview" title={share.text}>
            {share.text}
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
