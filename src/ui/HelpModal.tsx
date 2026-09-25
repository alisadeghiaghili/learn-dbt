import { ui } from '../i18n';

/** Short UI guide text (commands stay English). */
export function helpText(): string {
  const u = ui();
  return [
    `## ${u.helpTitle}`,
    '',
    `- **${u.levels}** — browse sequences`,
    `- **${u.guide}** — always-on right panel (checklist, learning, field notes)`,
    `- **${u.hint}** / **${u.solution}** / **${u.undo}** / **${u.reset}**`,
    `- **${u.sandboxBtn}** — free play`,
    `- **${u.language}** — EN / DE / FA`,
    '',
    'Terminal: Tab word-by-word · ↑/↓ history · Esc clear',
    'Meta: `help` `hint` `steps` `why` `levels` `show goal` `show solution` `reset` `undo`',
  ].join('\n');
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  const u = ui();
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={u.helpTitle}>
      <div className="modal-card">
        <h2>{u.helpTitle}</h2>
        <pre className="help-pre">{helpText()}</pre>
        <button type="button" className="btn btn-accent" onClick={onClose}>
          {u.close}
        </button>
      </div>
    </div>
  );
}
