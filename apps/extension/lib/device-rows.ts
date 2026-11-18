import type { DeviceInfo } from '@qatch/shared';

export interface DeviceRow {
  label: string;
  value: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-18 09:14:07" in the viewer's local time. */
export function formatLocalDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function formatConnection(connection: DeviceInfo['connection']): string | undefined {
  if (!connection) return undefined;
  const parts = [
    connection.effectiveType,
    connection.downlink !== undefined ? `${connection.downlink} Mbps` : undefined,
    connection.rtt !== undefined ? `${connection.rtt} ms RTT` : undefined,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/** Rows for the editor's Device tab, in display order. Optional fields are left out when unknown. */
export function deviceRows(device: DeviceInfo): DeviceRow[] {
  const rows: (DeviceRow | undefined)[] = [
    { label: 'Browser', value: `${device.browser.name} ${device.browser.version}`.trim() },
    { label: 'OS', value: `${device.os.name} ${device.os.version ?? ''}`.trim() },
    { label: 'Viewport', value: `${device.viewport.w} × ${device.viewport.h}` },
    { label: 'Screen', value: `${device.screen.w} × ${device.screen.h} @ ${device.dpr}x` },
    { label: 'Language', value: device.language },
    { label: 'Time zone', value: device.timeZone },
    ((connection) => (connection ? { label: 'Connection', value: connection } : undefined))(
      formatConnection(device.connection),
    ),
    { label: 'Page URL', value: device.url },
    { label: 'Captured', value: formatLocalDateTime(device.capturedAt) },
  ];
  return rows.filter((row): row is DeviceRow => row !== undefined && row.value !== '');
}
