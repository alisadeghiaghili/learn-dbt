import { ui } from '../i18n';
import { allLevels } from '../levels';

/** Welcome / intro dialog — learn-dvc family copy, for dbt. */
export function WelcomeDialog({
  onSandbox,
  onLevels,
}: {
  onSandbox: () => void;
  onLevels: () => void;
}) {
  const u = ui();
  return (
    <div className="modal welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="modal-card welcome-card">
        <h2 id="welcome-title">{u.welcomeTitle}</h2>
        <div className="welcome-body">
          <p>{u.welcomeIntro}</p>
          <p>{u.welcomeBoard}</p>
          <ul className="welcome-tracks">
            {u.welcomeTracks.split('\n').map((line) => (
              <li key={line}>{line.replace(/^- /, '')}</li>
            ))}
          </ul>
          <p className="welcome-meta">{u.welcomeMeta}</p>
          <p>{u.welcomeLevelsCount(allLevels.length)}</p>
          <h3>{u.welcomeWhat.replace(/\*\*/g, '')}</h3>
          <p>{u.welcomeWhatBody}</p>
          <h3>{u.welcomePublisher.replace(/\*\*/g, '')}</h3>
          <p>
            Published and maintained by{' '}
            <strong>Ali Sadeghi Aghili</strong> — programmer, data engineer / scientist, ML
            engineer. <a href="https://linktr.ee/aliaghili">linktr.ee/aliaghili</a>
          </p>
          <ul>
            <li>
              <a
                href="https://github.com/alisadeghiaghili/learn-dbt"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub — source &amp; issues
              </a>
            </li>
          </ul>
          <p>Buy Me a Coffee (supports the publisher):</p>
          <p>
            <a
              className="btn share-fb"
              href="https://www.buymeacoffee.com/alisadeghil"
              target="_blank"
              rel="noopener noreferrer"
            >
              Buy me a coffee
            </a>
          </p>
          <p className="par-note">{u.welcomeToolbar}</p>
        </div>
        <div className="solved-actions">
          <button type="button" className="btn" onClick={onSandbox}>
            {u.sandbox}
          </button>
          <button type="button" className="btn btn-accent" onClick={onLevels}>
            {u.openLevels}
          </button>
        </div>
      </div>
    </div>
  );
}
