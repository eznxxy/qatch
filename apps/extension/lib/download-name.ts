const pad = (n: number) => String(n).padStart(2, '0');

/** "qatch-shop.example.com-20261118-091407.png": safe on every OS, sorted by time. */
export function screenshotFileName(pageUrl: string, createdAt: number): string {
  let host = 'page';
  try {
    host = new URL(pageUrl).hostname.replace(/[^a-z0-9.-]/gi, '') || 'page';
  } catch {
    // keep the fallback
  }
  const d = new Date(createdAt);
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `qatch-${host}-${stamp}.png`;
}
