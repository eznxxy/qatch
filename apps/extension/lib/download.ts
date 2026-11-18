/** Saves a blob through the browser's normal download flow (no `downloads` permission needed). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Revoke later: the download starts asynchronously.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}
