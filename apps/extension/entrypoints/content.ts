// Isolated-world content script. Not declared in the manifest and has no `matches`, so it adds no host
// permissions: the worker injects it on demand with chrome.scripting.executeScript (activeTab).
export default defineContentScript({
  registration: 'runtime',
  main() {
    // Overlays and the page <-> worker relay arrive in P1-4 / P2-4.
  },
});
