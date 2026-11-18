// Service worker: stateless and event-driven. It can be killed at any time, so required state lives in
// chrome.storage.session / IndexedDB, never only in memory. Capture orchestration arrives in P1-1.
export default defineBackground(() => {
  // Intentionally empty for the scaffold (P0-3).
});
