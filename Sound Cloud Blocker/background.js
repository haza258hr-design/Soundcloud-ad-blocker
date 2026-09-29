'use strict';
importScripts('core.js');
const RULESET = 'audio_ads';
let queue = Promise.resolve();
function serial(fn) {
  const result = queue.then(fn);
  queue = result.catch(reportError);
  return result;
}
async function reportError(error) {
  console.error('SoundCloud Guard:', error);
  try { await chrome.storage.session.set({ lastError: String(error.message || error).slice(0, 400) }); } catch {}
}
async function append(entry) {
  if (!(await settings()).diagnosticLogs) return;
  const { events = [] } = await chrome.storage.session.get('events');
  events.push({ time: Date.now(), ...entry });
  await chrome.storage.session.set({ events: events.slice(-300) });
}
async function settings() { return chrome.storage.sync.get({ enabled: true, blockRequests: true, diagnosticLogs: false }); }
function ours(tab) {
  return tab.mutedInfo?.muted && tab.mutedInfo.reason === 'extension' &&
    tab.mutedInfo.extensionId === chrome.runtime.id;
}
async function restore(tabId, state) {
  if (!state?.owned) return;
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab && ours(tab)) await chrome.tabs.update(tabId, { muted: false });
  state.owned = false;
}
async function applyState(tabId, snapshot, documentId) {
  const { tabs = {} } = await chrome.storage.session.get('tabs');
  let state = tabs[tabId];
  if (state?.documentId !== documentId) {
    await restore(tabId, state);
    state = { owned: false, override: false, ad: false, documentId };
  }
  state ||= { owned: false, override: false, ad: false, documentId };
  const opts = await settings();
  const active = opts.enabled && snapshot.ad;
  const tab = await chrome.tabs.get(tabId);
  // Respect a manual unmute or another extension taking over until the break ends.
  if (state.owned && !ours(tab)) { state.owned = false; state.override = true; }
  if (active && !state.owned && !state.override && !tab.mutedInfo?.muted) {
    await chrome.tabs.update(tabId, { muted: true });
    state.owned = true;
  } else if (!active) {
    await restore(tabId, state);
    state.override = false;
  }
  if (state.ad !== snapshot.ad || state.title !== snapshot.title) {
    await append({ kind: 'player', tabId, ad: snapshot.ad, title: snapshot.title,
      hasBadge: snapshot.hasBadge, signal: snapshot.signal, media: snapshot.media });
  }
  Object.assign(state, snapshot, { updatedAt: Date.now(), documentId });
  tabs[tabId] = state;
  await chrome.storage.session.set({ tabs });
  await chrome.action.setBadgeText({ tabId, text: active ? 'AD' : '' });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#dc5500' });
}
async function syncRules() {
  const opts = await settings();
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: opts.blockRequests ? [RULESET] : [],
    disableRulesetIds: opts.blockRequests ? [] : [RULESET],
  });
  await chrome.storage.session.set({ rulesEnabled: opts.blockRequests });
}
async function initialize() {
  const legacy = await chrome.declarativeNetRequest.getSessionRules();
  if (legacy.length) await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: legacy.map(r => r.id) });
  await chrome.storage.local.remove('requestLog');
  // Reloading an extension clears session state; recover any mute left by our old worker.
  const openTabs = await chrome.tabs.query({ url: ['https://soundcloud.com/*', 'https://*.soundcloud.com/*'] });
  for (const tab of openTabs) if (ours(tab)) await chrome.tabs.update(tab.id, { muted: false });
  await chrome.storage.session.set({ tabs: {}, lastError: null });
  if (!(await settings()).diagnosticLogs) await chrome.storage.session.set({ events: [] });
  await syncRules();
  await chrome.alarms.create('guard-watchdog', { periodInMinutes: 0.5 });
}
chrome.runtime.onInstalled.addListener(() => { serial(initialize); });
chrome.runtime.onStartup.addListener(() => { serial(initialize); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !['enabled', 'blockRequests', 'diagnosticLogs'].some(k => k in changes)) return;
  serial(async () => {
    if (changes.blockRequests) await syncRules();
    if (changes.diagnosticLogs?.newValue === false) await chrome.storage.session.set({ events: [] });
    if (changes.enabled?.newValue === false) {
      const { tabs = {} } = await chrome.storage.session.get('tabs');
      for (const [id, state] of Object.entries(tabs)) {
        await restore(Number(id), state);
        await chrome.action.setBadgeText({ tabId: Number(id), text: '' }).catch(() => {});
      }
      await chrome.storage.session.set({ tabs });
    }
  });
});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== 'guard-watchdog') return;
  serial(async () => {
    const { tabs = {} } = await chrome.storage.session.get('tabs');
    for (const [id, state] of Object.entries(tabs)) {
      if (Date.now() - state.updatedAt > 20000) {
        await restore(Number(id), state);
        delete tabs[id];
        await chrome.action.setBadgeText({ tabId: Number(id), text: '' }).catch(() => {});
      }
    }
    await chrome.storage.session.set({ tabs });
  });
});
chrome.tabs.onRemoved.addListener(tabId => { serial(async () => {
  const { tabs = {} } = await chrome.storage.session.get('tabs');
  delete tabs[tabId];
  await chrome.storage.session.set({ tabs });
}); });
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status !== 'loading') return;
  serial(async () => {
    const { tabs = {} } = await chrome.storage.session.get('tabs');
    await restore(tabId, tabs[tabId]);
    delete tabs[tabId];
    await chrome.storage.session.set({ tabs });
    await chrome.action.setBadgeText({ tabId, text: '' });
  });
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const fromPage = sender.frameId === 0 && SCGuard.soundcloud(sender.url);
  const fromPopup = !sender.tab && sender.url?.startsWith(chrome.runtime.getURL(''));
  if (message?.type === 'player-state' && fromPage && Number.isInteger(sender.tab?.id)) {
    serial(() => applyState(sender.tab.id, SCGuard.sanitizeSnapshot(message.state), sender.documentId || sender.url))
      .then(() => respond({ ok: true }), e => respond({ error: String(e.message) }));
    return true;
  }
  if (!fromPopup) return;
  if (message?.type === 'clear-diagnostics') {
    serial(() => chrome.storage.session.set({ events: [], lastError: null, selfTest: null }))
      .then(() => respond({ ok: true }), e => respond({ error: String(e.message) }));
    return true;
  }
  if (message?.type === 'mark-ad') {
    serial(() => append({ kind: 'user-marked-ad', tabId: message.tabId }))
      .then(() => respond({ ok: true }), e => respond({ error: String(e.message) }));
    return true;
  }
  if (message?.type === 'self-test') {
    serial(async () => {
      const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();
      const tests = [
        ['ad request', 'https://api-v2.soundcloud.com/audio-ads?track_id=123', 'https://soundcloud.com'],
        ['song request', 'https://api-v2.soundcloud.com/tracks/123/stream', 'https://soundcloud.com'],
        ['unrelated site', 'https://api-v2.soundcloud.com/audio-ads', 'https://example.com'],
      ];
      const results = [];
      for (const [name, url, initiator] of tests) {
        const result = await chrome.declarativeNetRequest.testMatchOutcome({ url, initiator, type: 'xmlhttprequest' });
        results.push({ name, matched: result.matchedRules.length > 0 });
      }
      const expectBlock = enabled.includes(RULESET);
      const passed = results[0].matched === expectBlock && !results[1].matched && !results[2].matched;
      const report = { passed, rulesEnabled: expectBlock, results, time: Date.now() };
      await chrome.storage.session.set({ selfTest: report });
      return report;
    }).then(respond, e => respond({ error: String(e.message) }));
    return true;
  }
});
const FILTER = { urls: ['https://*.soundcloud.com/*', 'https://*.sndcdn.com/*'],
  types: ['media', 'xmlhttprequest', 'other'] };
function observe(details, kind) {
  if (details.tabId < 0 || !SCGuard.soundcloud(details.initiator)) return;
  if (!SCGuard.playbackRequest(details.url, details.type)) return;
  serial(async () => {
    await append({ kind, tabId: details.tabId, requestId: details.requestId,
      url: SCGuard.safeURL(details.url), type: details.type, status: details.statusCode,
      contentType: details.responseHeaders?.find(h => h.name.toLowerCase() === 'content-type')?.value,
      error: details.error });
  });
}
chrome.webRequest.onBeforeRequest.addListener(d => observe(d, 'request'), FILTER);
chrome.webRequest.onHeadersReceived.addListener(d => observe(d, 'response'), FILTER, ['responseHeaders']);
chrome.webRequest.onErrorOccurred.addListener(d => observe(d, 'request-error'), FILTER);
serial(async () => {
  await syncRules();
  await chrome.alarms.create('guard-watchdog', { periodInMinutes: 0.5 });
});
