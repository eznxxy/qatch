import type { ReportDetails } from '@qatch/shared';
import { type KeyboardEvent, useRef, useState } from 'react';

import type { Draft } from '@/lib/draft';
import { deviceRows } from '@/lib/device-rows';

import { DetailsForm } from './DetailsForm';

type TabId = 'details' | 'console' | 'network' | 'device';

interface ReportPanelProps {
  draft: Draft;
  details: ReportDetails;
  onDetailsChange: (patch: Partial<ReportDetails>) => void;
}

export function ReportPanel({ draft, details, onDetailsChange }: ReportPanelProps) {
  const [tab, setTab] = useState<TabId>('details');
  const tabRefs = useRef(new Map<TabId, HTMLButtonElement>());

  // Console/network capture arrives in Phase 2; drafts carry none yet.
  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'details', label: 'Details' },
    { id: 'console', label: 'Console', count: 0 },
    { id: 'network', label: 'Network', count: 0 },
    { id: 'device', label: 'Device' },
  ];

  // WAI-ARIA tabs: arrow keys move between tabs, Home/End jump to the ends.
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((t) => t.id === tab);
    const last = tabs.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : undefined;
    const next = target === undefined ? undefined : tabs[target];
    if (!next) return;
    event.preventDefault();
    setTab(next.id);
    tabRefs.current.get(next.id)?.focus();
  }

  return (
    <aside className="panel" aria-label="Report">
      <div role="tablist" aria-label="Report sections" className="tabs" onKeyDown={onTabKeyDown}>
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            ref={(el) => {
              if (el) tabRefs.current.set(id, el);
              else tabRefs.current.delete(id);
            }}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            className="tabs__tab"
            onClick={() => {
              setTab(id);
            }}
          >
            {label}
            {count !== undefined && <span className="tabs__count">{count}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
        {tab === 'details' && <DetailsForm details={details} onChange={onDetailsChange} />}
        {tab === 'console' && <p className="empty">No console entries will be included.</p>}
        {tab === 'network' && <p className="empty">No network requests will be included.</p>}
        {tab === 'device' &&
          (draft.device ? (
            <dl className="device">
              {deviceRows(draft.device).map(({ label, value }) => (
                <div key={label} className="device__row">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="empty">Device info wasn&apos;t available for this page.</p>
          ))}
      </div>
    </aside>
  );
}
