'use strict';
const $ = id => document.getElementById(id);
let tabId;
let rendering = false;
$('version').textContent = 'v' + chrome.runtime.getManifest().version;
function notice(text) { $('notice').textContent = text; }
async function render() {
  if (rendering) return;
  rendering = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
    const opts = await chrome.storage.sync.get({ enabled: true, blockRequests: true, diagnosticLogs: false });
    for (const id of ['enabled', 'blockRequests', 'diagnosticLogs']) $(id).checked = opts[id];
    const data = await chrome.storage.session.get(['tabs', 'lastError', 'selfTest', 'events', 'rulesEnabled']);
    const state = data.tabs?.[tabId];
    const fresh = state && Date.now() - state.updatedAt < 10000;
    $('status').textContent = data.lastError ? 'Extension error: ' + data.lastError
      : !opts.enabled && !opts.blockRequests ? 'Guard paused. Turn the switches on to resume.'
      : !fresh ? 'Open SoundCloud and refresh its tab to connect the player.'
      : !state.hasBadge ? 'Connected. Start a track to activate the player.'
      : state.ad ? (state.owned ? 'Ad detected · audio muted' : 'Ad detected · mute is off or controlled by you')
      : 'Connected · no active ad';
    $('rules').textContent = data.rulesEnabled ? 'Request blocking on' : 'Request blocking off';
    $('mark').disabled = !fresh || !opts.diagnosticLogs;
    $('log').textContent = JSON.stringify({ rulesEnabled: data.rulesEnabled,
      selfTest: data.selfTest, player: state,
      recent: (data.events || []).filter(e => e.tabId === tabId).slice(-8) }, null, 2);
  } finally { rendering = false; }
}
function handle(id, fn) {
  $(id).addEventListener('click', async () => {
    $(id).disabled = true;
    try { await fn(); } catch (e) { notice(e.message); }
    finally { $(id).disabled = false; await render().catch(e => notice(e.message)); }
  });
}
for (const id of ['enabled', 'blockRequests', 'diagnosticLogs']) $(id).addEventListener('change', async () => {
  try { await chrome.storage.sync.set({ [id]: $(id).checked }); }
  catch (e) { notice(e.message); }
});
handle('pause', async () => {
  await chrome.storage.sync.set({ enabled: false, blockRequests: false });
  notice('Paused. Guard releases only its own mutes; your mute settings stay unchanged.');
});
handle('test', async () => {
  const result = await chrome.runtime.sendMessage({ type: 'self-test' });
  notice(result.error || (result.passed
    ? 'Rule checks passed' + (result.rulesEnabled ? '.' : ' (blocking is switched off).')
    : 'Rule checks failed. See diagnostics.'));
});
handle('mark', async () => {
  const result = await chrome.runtime.sendMessage({ type: 'mark-ad', tabId });
  notice(result.error || 'Missed-ad time recorded. Save a report after the next song starts.');
});
handle('clear', async () => {
  const result = await chrome.runtime.sendMessage({ type: 'clear-diagnostics' });
  notice(result.error || 'Diagnostic history cleared. Current player status is retained.');
});
handle('export', async () => {
  const data = await chrome.storage.session.get(['tabs', 'events', 'lastError', 'selfTest']);
  const opts = await chrome.storage.sync.get({ enabled: true, blockRequests: true, diagnosticLogs: false });
  const report = { version: chrome.runtime.getManifest().version, exportedAt: new Date().toISOString(),
    settings: opts, player: data.tabs?.[tabId], events: (data.events || []).filter(e => e.tabId === tabId),
    lastError: data.lastError, selfTest: data.selfTest };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'soundcloud-guard-report.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  notice('Report saved locally. Review titles and media paths before sharing.');
});
render().catch(e => notice(e.message));
const refresh = setInterval(() => render().catch(e => notice(e.message)), 1000);
window.addEventListener('unload', () => clearInterval(refresh));
