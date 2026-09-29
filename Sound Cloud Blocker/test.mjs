import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const core = read('core.js'), worker = read('background.js');
const rules = JSON.parse(read('rules.json'));
const manifest = JSON.parse(read('manifest.json'));
const TYPES = new Set(['main_frame','sub_frame','stylesheet','script','image','font','object',
  'xmlhttprequest','ping','csp_report','media','websocket','webbundle','webtransport','other']);
function event(validate = () => {}) {
  const listeners = [];
  return { listeners, addListener(fn, ...args) { validate(...args); listeners.push(fn); },
    fire(...args) { for (const fn of listeners) fn(...args); } };
}
function harness(data = {}) {
  const state = { session: data.session || {}, sync: data.sync || {}, local: {}, tabs: data.tabs ||
    { 7: { id: 7, mutedInfo: { muted: false } } }, updates: [], enabled: ['audio_ads'] };
  const storageEvent = event();
  function area(name) {
    return {
      async get(keys) {
        const out = typeof keys === 'object' && !Array.isArray(keys) ? { ...keys } : {};
        for (const k of typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || state[name]))
          if (k in state[name]) out[k] = structuredClone(state[name][k]);
        return out;
      },
      async set(values) {
        const changes = {};
        for (const [k,v] of Object.entries(values)) { changes[k] = {oldValue:state[name][k],newValue:v}; state[name][k] = structuredClone(v); }
        storageEvent.fire(changes, name);
      },
      async remove(key) { delete state[name][key]; }
    };
  }
  const validate = filter => { for (const t of filter.types || []) if (!TYPES.has(t)) throw Error('Invalid resource type: ' + t); };
  const chrome = {
    runtime: { id: 'test-id', getURL: p => 'chrome-extension://test-id/' + p,
      onMessage: event(), onInstalled: event(), onStartup: event() },
    storage: {session:area('session'),sync:area('sync'),local:area('local'),onChanged:storageEvent},
    tabs: {
      async get(id) { if (!state.tabs[id]) throw Error('Tab closed'); return structuredClone(state.tabs[id]); },
      async query() { return Object.values(state.tabs); },
      async update(id, properties) { state.updates.push([id,properties.muted]); state.tabs[id].mutedInfo =
        { muted: properties.muted, reason:'extension',extensionId:'test-id' }; },
      onRemoved:event(),onUpdated:event()
    },
    alarms:{create:async()=>{},onAlarm:event()},
    action:{setBadgeText:async()=>{},setBadgeBackgroundColor:async()=>{}},
    declarativeNetRequest:{
      getSessionRules:async()=>[],
      updateSessionRules:async value=> { for (const r of value.addRules || []) validate({types:r.condition.resourceTypes}); },
      updateEnabledRulesets:async value=> {state.enabled=value.enableRulesetIds;},
      getEnabledRulesets:async()=>state.enabled,
      testMatchOutcome:async request=>({matchedRules:state.enabled.includes('audio_ads') &&
        request.initiator==='https://soundcloud.com' && new RegExp(rules[0].condition.regexFilter).test(request.url)
        ? [{ruleId:1,rulesetId:'audio_ads'}] : []})
    },
    webRequest:{onBeforeRequest:event(validate),onHeadersReceived:event(validate),onErrorOccurred:event(validate)}
  };
  const context = vm.createContext({chrome, URL, console:{error(){}}, Date, setTimeout, clearTimeout});
  context.importScripts = () => vm.runInContext(core,context);
  vm.runInContext(worker,context);
  const flush = async()=> { await vm.runInContext('queue',context); await vm.runInContext('queue',context); };
  const send = (ad, extra={})=>new Promise(resolve=>chrome.runtime.onMessage.listeners[0](
    {type:'player-state',state:{ad,hasBadge:true,title:'Ordinary song',media:[],...extra}},
    {frameId:0,url:'https://soundcloud.com/artist/song',tab:{id:7},documentId:'doc-a'}, resolve));
  return {state,chrome,context,flush,send};
}
test('legacy 1.0.4 observer reproduces invalid fetch registration failure', () => {
  const h=harness();
  // Minimal reproduction of the old filter; independent of private workspace history.
  assert.throws(()=>h.chrome.webRequest.onBeforeRequest.addListener(()=>{},
    {urls:['https://*.soundcloud.com/*'],types:['media','xmlhttprequest','fetch']}),/Invalid resource type: fetch/);
});
test('rules use valid API types and match only the researched endpoint', () => {
  for (const r of rules) {
    assert(r.condition.resourceTypes.every(t=>TYPES.has(t)));
    const match=new RegExp(r.condition.regexFilter);
    assert(match.test('https://api-v2.soundcloud.com/audio-ads?track_id=42'));
    for (const u of ['https://api-v2.soundcloud.com/tracks/42/stream','https://cf-media.sndcdn.com/123.mp3',
      'https://api-v2.soundcloud.com/audio-ads-not-a-real-endpoint','https://api-v2.soundcloud.com.evil.test/audio-ads'])
      assert(!match.test(u),u);
    assert.deepEqual(r.condition.initiatorDomains,['soundcloud.com']);
  }
  assert.equal(manifest.version,'1.2.0');
  for (const f of [...manifest.content_scripts[0].js,manifest.background.service_worker,'popup.js']) new vm.Script(read(f));
});
test('detector uses actual ad flag even without a DOM media element; title and duration are not classifiers',()=>{
  const h=harness(), g=h.context.SCGuard;
  function doc(ad,title='Advertisement - radio promo',duration=30) {
    return {querySelector:()=>({classList:{contains:c=>ad && c==='is-adPlaying'},querySelector:()=>({textContent:title})}),
      querySelectorAll:()=>duration===null?[]:[{src:'https://cdn.test/song.mp3?token=secret',paused:false,ended:false,duration}]};
  }
  assert.equal(g.snapshot(doc(false)).ad,false);
  assert.equal(g.snapshot(doc(true,'Unchanged title',null)).ad,true);
  assert.equal(g.snapshot(doc(false,'Short song',15)).ad,false);
});
test('ad start mutes tab with no media elements; next song restores it',async()=>{
  const h=harness(); await h.send(true); assert.equal(h.state.tabs[7].mutedInfo.muted,true);
  await h.send(false); assert.equal(h.state.tabs[7].mutedInfo.muted,false);
  assert.deepEqual(h.state.updates,[[7,true],[7,false]]);
});
test('pre-existing user mute is never undone',async()=>{
  const h=harness({tabs:{7:{id:7,mutedInfo:{muted:true,reason:'user'}}}});
  await h.send(true); await h.send(false); assert.deepEqual(h.state.updates,[]);
});
test('manual unmute during ad is respected until the next break',async()=>{
  const h=harness(); await h.send(true);
  h.state.tabs[7].mutedInfo={muted:false,reason:'user'};
  await h.send(true); assert.equal(h.state.tabs[7].mutedInfo.muted,false);
  await h.send(false); await h.send(true); assert.equal(h.state.tabs[7].mutedInfo.muted,true);
});
test('worker restart preserves mute ownership and restores correctly',async()=>{
  const first=harness();await first.send(true);
  const second=harness({session:first.state.session,tabs:first.state.tabs});
  await second.send(false);assert.equal(second.state.tabs[7].mutedInfo.muted,false);
});
test('disable, page navigation, and stale heartbeat restore owned mute',async()=>{
  for (const action of ['disable','navigate','timeout']) {
    const h=harness();await h.send(true);
    if(action==='disable')await h.chrome.storage.sync.set({enabled:false});
    if(action==='navigate')h.chrome.tabs.onUpdated.fire(7,{status:'loading'});
    if(action==='timeout'){h.state.session.tabs[7].updatedAt=0;h.chrome.alarms.onAlarm.fire({name:'guard-watchdog'});}
    await h.flush();assert.equal(h.state.tabs[7].mutedInfo.muted,false,action);
  }
});
test('skip rejects disabled, hidden, and countdown buttons',()=>{
  const h=harness(), g=h.context.SCGuard;
  const b={disabled:false,getAttribute:()=>null,classList:{contains:()=>false},getClientRects:()=>[{}]};
  assert(g.canSkip(b));assert(!g.canSkip({...b,disabled:true}));
  assert(!g.canSkip({...b,classList:{contains:()=>true}}));assert(!g.canSkip({...b,getClientRects:()=>[]}));
});
test('diagnostics redact secrets and retain concurrent request events only for SoundCloud',async()=>{
  const h=harness({sync:{diagnosticLogs:true}});await h.flush();
  for(let i=0;i<40;i++)h.chrome.webRequest.onBeforeRequest.fire({tabId:7,type:'xmlhttprequest',
    initiator:'https://soundcloud.com',requestId:String(i),url:'https://api-v2.soundcloud.com/audio-ads?token=SECRET'});
  h.chrome.webRequest.onBeforeRequest.fire({tabId:99,type:'media',initiator:'https://elsewhere.test',url:'https://cf-media.sndcdn.com/file.mp3'});
  await h.flush();assert.equal(h.state.session.events.length,40);
  assert(!JSON.stringify(h.state.session).includes('SECRET'));assert(!JSON.stringify(h.state.session).includes('token='));
});
test('browser errors are surfaced rather than swallowed',async()=>{
  const h=harness();await h.flush();h.chrome.tabs.update=async()=>{throw Error('Denied by browser');};
  const response=await h.send(true);await h.flush();
  assert.match(response.error,/Denied/);assert.match(h.state.session.lastError,/Denied/);
});

test('diagnostic events are opt-in and disabling clears history',async()=>{
  const h=harness(); await h.send(true); assert.equal(h.state.session.events,undefined);
  await h.chrome.storage.sync.set({diagnosticLogs:true}); await h.send(false);
  assert.equal(h.state.session.events.length,1);
  await h.chrome.storage.sync.set({diagnosticLogs:false});await h.flush();
  assert.deepEqual(h.state.session.events,[]);
});
const popup = (h,message)=>new Promise(resolve=>h.chrome.runtime.onMessage.listeners[0](
  message,{url:'chrome-extension://test-id/popup.html'},resolve));
test('clearing diagnostics preserves active mute ownership and restores on next song',async()=>{
  const h=harness({sync:{diagnosticLogs:true}});await h.send(true);
  await popup(h,{type:'clear-diagnostics'});
  assert.deepEqual(h.state.session.events,[]);assert(h.state.session.tabs[7].owned);
  await h.send(false);assert.equal(h.state.tabs[7].mutedInfo.muted,false);
});
test('pause turns off rules and releases guard mute but preserves user mute',async()=>{
  const h=harness();await h.send(true);
  h.state.tabs[8]={id:8,mutedInfo:{muted:true,reason:'user'}};
  h.state.session.tabs[8]={owned:false,ad:true};
  await h.chrome.storage.sync.set({enabled:false,blockRequests:false});await h.flush();
  assert.equal(h.state.enabled.length,0);assert.equal(h.state.tabs[7].mutedInfo.muted,false);
  assert.equal(h.state.tabs[8].mutedInfo.muted,true);
  await h.send(true);assert.equal(h.state.tabs[7].mutedInfo.muted,false);
});
test('self-test verifies enabled and disabled rule matching',async()=>{
  const h=harness();await h.flush();
  assert.equal((await popup(h,{type:'self-test'})).passed,true);
  await h.chrome.storage.sync.set({blockRequests:false});await h.flush();
  const report=await popup(h,{type:'self-test'});
  assert.equal(report.passed,true);assert.equal(report.rulesEnabled,false);
});
test('untrusted sites and subframes cannot mute a tab or clear diagnostics',async()=>{
  const h=harness();await h.flush();let called=false;
  for(const sender of [
    {frameId:0,url:'https://example.com',tab:{id:7}},
    {frameId:1,url:'https://soundcloud.com',tab:{id:7}}
  ]) h.chrome.runtime.onMessage.listeners[0]({type:'player-state',state:{ad:true}},sender,()=>{called=true;});
  h.chrome.runtime.onMessage.listeners[0]({type:'clear-diagnostics'},
    {url:'https://soundcloud.com',tab:{id:7}},()=>{called=true;});
  await h.flush();assert.equal(called,false);assert.deepEqual(h.state.updates,[]);
});
