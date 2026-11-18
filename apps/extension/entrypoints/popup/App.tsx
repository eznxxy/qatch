import type { CaptureMode } from '@qatch/shared';
import { type ReactNode, useState } from 'react';

import { MicIcon, MonitorIcon, PageIcon, RegionIcon, ShieldIcon } from '@/components/icons';
import { Logo } from '@/components/Logo';
import { isCaptureModeEnabled } from '@/lib/capture-modes';
import { sendToWorker } from '@/lib/chrome-api';
import { requestCaptureStart } from '@/lib/request-capture';

import {
  ERROR_MESSAGES,
  PRIVACY_NOTE,
  RECORD_HELP,
  RECORD_SOURCES,
  SCREENSHOT_OPTIONS,
  type ScreenshotMode,
} from './copy';

type Status = { kind: 'idle' } | { kind: 'starting' } | { kind: 'error'; message: string };

const MODE_ICONS: Record<ScreenshotMode, ReactNode> = {
  visible: <MonitorIcon />,
  full: <PageIcon />,
  region: <RegionIcon />,
};

export function App() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const busy = status.kind === 'starting';
  const recordEnabled = isCaptureModeEnabled('record');

  async function start(mode: CaptureMode) {
    setStatus({ kind: 'starting' });
    const result = await requestCaptureStart(mode, sendToWorker);
    if (result.ok) {
      // Close so the page is unobstructed (screenshots, region select, recording).
      window.close();
      return;
    }
    setStatus({ kind: 'error', message: ERROR_MESSAGES[result.error] });
  }

  return (
    <div className="popup">
      <header className="popup__header">
        <Logo />
        <span className="popup__brand">Qatch</span>
      </header>

      <section className="popup__shots" aria-labelledby="shots-heading">
        <h2 id="shots-heading" className="eyebrow">
          Screenshot
        </h2>
        <ul className="modes">
          {SCREENSHOT_OPTIONS.map(({ mode, label, hint }, index) => {
            const enabled = isCaptureModeEnabled(mode);
            return (
              <li key={mode}>
                <button
                  type="button"
                  className="mode"
                  disabled={!enabled || busy}
                  autoFocus={index === 0}
                  aria-describedby={`hint-${mode}`}
                  onClick={() => void start(mode)}
                >
                  <span className="mode__icon">{MODE_ICONS[mode]}</span>
                  <span className="mode__text">
                    <span className="mode__label">{label}</span>
                    <span className="mode__hint" id={`hint-${mode}`}>
                      {enabled ? hint : `${hint}. Coming soon.`}
                    </span>
                  </span>
                  {!enabled && (
                    <span className="badge" aria-hidden="true">
                      Soon
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="record" aria-labelledby="record-heading">
        <div className="record__head">
          <h2 id="record-heading" className="eyebrow">
            Record screen
          </h2>
          {!recordEnabled && <span className="badge">Coming soon</span>}
        </div>

        <div role="group" aria-label="What to record" className="segmented">
          {RECORD_SOURCES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className="segmented__option"
              aria-pressed={id === 'tab'}
              disabled={!recordEnabled}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="record__mic">
          <span className="record__mic-label">
            <MicIcon />
            Microphone
          </span>
          <button
            type="button"
            role="switch"
            aria-checked="false"
            aria-label="Microphone"
            className="switch"
            disabled={!recordEnabled}
          >
            <span className="switch__track">
              <span className="switch__thumb" />
            </span>
          </button>
        </div>

        <button
          type="button"
          className="btn btn--primary record__start"
          disabled={!recordEnabled || busy}
          onClick={() => void start('record')}
        >
          <span className="record__dot" aria-hidden="true" />
          Record Screen
        </button>
        <p className="record__help">{RECORD_HELP}</p>
      </section>

      <p className="status" role="status" aria-live="polite">
        {status.kind === 'starting' && 'Starting…'}
        {status.kind === 'error' && status.message}
      </p>

      <footer className="popup__footer">
        <ShieldIcon />
        <p>{PRIVACY_NOTE}</p>
      </footer>
    </div>
  );
}
