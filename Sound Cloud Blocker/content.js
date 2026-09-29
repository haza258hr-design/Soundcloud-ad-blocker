(() => {
  'use strict';
  let enabled = true;
  let last = '';
  let lastSent = 0;
  let lastSkip = 0;
  let stopped = false;
  let timer;
  let observer;
  function stop() { stopped = true; clearInterval(timer); observer?.disconnect(); }
  function scan() {
    if (stopped) return;
    const state = SCGuard.snapshot(document);
    const signature = JSON.stringify(state);
    const now = Date.now();
    if (signature !== last || now - lastSent >= 2000) {
      last = signature;
      lastSent = now;
      try {
        chrome.runtime.sendMessage({ type: 'player-state', state }).catch(error => {
          console.warn('SoundCloud Guard: reload this tab after reloading the extension.', error.message);
          if (!chrome.runtime.id) stop();
        });
      } catch { stop(); }
    }
    if (enabled && state.ad && now - lastSkip > 1500) {
      const skip = document.querySelector('.playControlsPanel__skipButton');
      if (SCGuard.canSkip(skip)) { lastSkip = now; skip.click(); }
    }
  }
  chrome.storage.sync.get({ enabled: true }, s => { enabled = s.enabled !== false; scan(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.enabled) { enabled = changes.enabled.newValue !== false; scan(); }
  });
  observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { subtree: true, childList: true,
    attributes: true, attributeFilter: ['class', 'disabled', 'aria-disabled'], characterData: true });
  timer = setInterval(scan, 1000);
  window.addEventListener('pageshow', scan);
  scan();
})();
