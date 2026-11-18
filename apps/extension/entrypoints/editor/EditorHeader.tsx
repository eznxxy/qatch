import { AlertIcon, CheckIcon, LinkIcon } from '@/components/icons';
import { Logo } from '@/components/Logo';

import type { SaveStatus } from './use-draft-saver';

const SAVE_TEXT: Record<SaveStatus, string> = {
  saved: 'Draft saved on this device',
  saving: 'Saving…',
  error: "Couldn't save. Your changes stay in this tab.",
};

interface EditorHeaderProps {
  kindLabel: string;
  saveStatus: SaveStatus;
  onDiscard: () => void;
  discarding: boolean;
}

export function EditorHeader({ kindLabel, saveStatus, onDiscard, discarding }: EditorHeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar__title">
        <Logo size={26} />
        <h1>New report</h1>
        <span className="chip">{kindLabel}</span>
        <span className={`save save--${saveStatus}`} role="status" aria-live="polite">
          {saveStatus === 'error' ? <AlertIcon size={14} /> : <CheckIcon size={14} />}
          {SAVE_TEXT[saveStatus]}
        </span>
      </div>
      <div className="topbar__actions">
        <button type="button" className="btn" onClick={onDiscard} disabled={discarding}>
          Discard
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled
          aria-describedby="share-unavailable"
          title="Sharing isn't available yet"
        >
          <LinkIcon size={16} />
          Create share link
        </button>
        <span id="share-unavailable" className="visually-hidden">
          Sharing isn&apos;t available yet.
        </span>
      </div>
    </header>
  );
}
