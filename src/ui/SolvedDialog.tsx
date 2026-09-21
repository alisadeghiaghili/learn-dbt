import { useMemo, useState } from 'react';
import type { LevelDef } from '../engine/types';
import { buildShareLinks } from './share';

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
 * Level-solved celebration dialog with social share (LinkedIn, X, Facebook).
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
    <div className="modal solved-modal" role="dialog" aria-modal="true" aria-labelledby="solved-title">
      <div className="modal-card solved-card">
        <div className="confetti" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="solved-kicker">Level solved</div>
        <h2 id="solved-title">{info.level.name}</h2>
        <p className="solved-sub">
          You completed <strong>{info.level.name}</strong> ({info.level.sequence}) in{' '}
          <strong>
            {info.commands} command{info.commands === 1 ? '' : 's'}
          </strong>
          {info.par ? (
            <>
              {' '}
              · par {info.par} {golfBadge ? `· ${golfBadge}` : null}
            </>
          ) : null}
          .
        </p>
        <p className="solved-objective">{info.level.objective.split('\n')[0]}</p>

        <div className="share-block">
          <div className="share-title">Share that you learned it</div>
          <div className="share-actions">
            <a
              className="btn share-li"
              href={share.linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
            <a
              className="btn share-x"
              href={share.twitter}
              target="_blank"
              rel="noopener noreferrer"
            >
              X / Twitter
            </a>
            <a
              className="btn share-fb"
              href={share.facebook}
              target="_blank"
              rel="noopener noreferrer"
            >
              Facebook
            </a>
            <button type="button" className="btn" onClick={copyLink}>
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
          <div className="share-preview" title={share.text}>
            {share.text}
          </div>
        </div>

        <div className="solved-actions">
          {hasNext ? (
            <button type="button" className="btn btn-accent" onClick={onNext}>
              Next level
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onReplay}>
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
