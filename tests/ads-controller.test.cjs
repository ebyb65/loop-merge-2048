const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'ads-controller.js'), 'utf8');

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

function setup(overrides = {}, native = true, extraPlugins = {}) {
  const calls = { init: [], load: [], show: [] };
  const listeners = {};
  const ready = {};
  const messages = [];
  const alerts = [];
  const cssVars = {};
  const plugin = {
    addListener: async (name, fn) => { listeners[name] = fn; return { remove: async () => {} }; },
    initialize: async options => { calls.init.push(options); },
    isReady: async ({ adUnitId }) => ({ ready: !!ready[adUnitId] }),
    loadRewarded: async ({ adUnitId }) => {
      calls.load.push(adUnitId);
      setImmediate(() => { ready[adUnitId] = true; listeners.loaded({ format: 'rewarded', adUnitId }); });
    },
    loadInterstitial: async ({ adUnitId }) => {
      calls.load.push(adUnitId);
      setImmediate(() => { ready[adUnitId] = true; listeners.loaded({ format: 'interstitial', adUnitId }); });
    },
    showRewarded: async ({ adUnitId }) => { calls.show.push(adUnitId); ready[adUnitId] = false; return { shown: true, rewarded: true }; },
    showInterstitial: async ({ adUnitId }) => { calls.show.push(adUnitId); ready[adUnitId] = false; return { shown: true, rewarded: false }; },
    destroyBanner: async () => {},
    createBanner: async o => { calls.banner = (calls.banner || []).concat(['create:' + o.adUnitId]); return { bannerId: 'main', frame: { x: 0, y: 0, width: 320, height: 50 }, visible: false }; },
    loadBanner: async () => { calls.banner.push('load'); },
    showBanner: async () => { calls.banner.push('show'); return { bannerId: 'main', frame: { x: 0, y: 0, width: 320, height: 50 }, visible: true }; },
    ...overrides
  };
  const context = vm.createContext({
    window: { Capacitor: native ? { Plugins: { LevelPlay: plugin, ...extraPlugins } } : undefined, alert: m => alerts.push(m) },
    logToScreen: m => messages.push(m),
    setInterval: () => 1, clearInterval: () => {}, setTimeout, clearTimeout,
    document: { hidden: false, getElementById: () => ({ style: {} }), documentElement: { style: { setProperty: (k, v) => { cssVars[k] = v; } } } }
  });
  vm.runInContext(source + '\nthis.manager = UnityAdsManager;', context);
  return { manager: context.manager, plugin, calls, listeners, ready, messages, alerts, cssVars };
}

test('coalesces initialization and does not claim personalized-ad consent', async () => {
  const wait = deferred();
  let calls = 0;
  const { manager } = setup({ initialize: async o => { calls++; assert.equal(o.consent.gdprConsent, false); await wait.promise; } });
  const a = manager.init(), b = manager.init();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  wait.resolve();
  assert.equal(await a, true);
  assert.equal(await b, true);
  await manager.preloadAds();
});

test('missing native bridge never grants a reward', async () => {
  const { manager, alerts } = setup({}, false);
  let rewards = 0;
  await manager.showRewarded(() => rewards++);
  assert.equal(rewards, 0);
  assert.equal(alerts.length, 1);
});

test('waits for the matching loaded event; a duplicate tap cannot grant twice', async () => {
  const gate = deferred();
  const show = deferred();
  let rewardedShows = 0;
  const { manager, listeners } = setup({
    loadRewarded: () => gate.promise,
    showRewarded: () => { rewardedShows++; return show.promise; }
  });
  let rewards = 0;
  const first = manager.showRewarded(() => rewards++);
  await new Promise(resolve => setImmediate(resolve));
  await manager.showRewarded(() => rewards++);
  assert.equal(rewardedShows, 0);
  listeners.loaded({ format: 'rewarded', adUnitId: 'unrelated' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(rewardedShows, 0);
  gate.resolve();
  listeners.loaded({ format: 'rewarded', adUnitId: manager.rewardedId });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(rewardedShows, 1);
  show.resolve({ shown: false, rewarded: true });
  await first;
  assert.equal(rewards, 1);
});

test('a failed ad load does not grant rewards', async () => {
  let state;
  const setupState = setup({ loadRewarded: async ({ adUnitId }) => {
    setImmediate(() => state.listeners.loadFailed({ format: 'rewarded', adUnitId, error: { message: 'no fill' } }));
  }});
  state = setupState;
  let rewards = 0;
  await state.manager.showRewarded(() => rewards++);
  assert.equal(rewards, 0);
  assert.equal(state.calls.show.length, 0);
  assert.ok(state.alerts.length > 0);
});

test('timed-out requests release the load lock and permit a later retry', async () => {
  const s = setup({ loadRewarded: async () => {} });
  s.manager.loadTimeoutMs = 10;
  await s.manager.init();
  const result = await s.manager.loadAd('rewarded');
  assert.equal(result, false);
  assert.equal(s.manager.pendingLoads.rewarded, undefined);
  await s.manager.loadAd('rewarded');
  assert.equal(s.manager.pendingLoads.rewarded, undefined);
});

for (const result of [{ shown: true, rewarded: false }, { shown: false, rewarded: false, error: { message: 'failed' } }, undefined]) {
  test('only the SDK reward callback grants a reward: ' + JSON.stringify(result), async () => {
    const s = setup({ showRewarded: async () => result });
    let rewards = 0;
    await s.manager.showRewarded(() => rewards++);
    assert.equal(rewards, 0);
    assert.equal(s.manager.fullscreenBusy, false);
    await s.manager.preloadAds();
  });
}

test('a completed ad grants one reward and permits a fresh load', async () => {
  const s = setup();
  let rewards = 0;
  await s.manager.showRewarded(() => rewards++);
  await s.manager.preloadAds();
  await s.manager.showRewarded(() => rewards++);
  await s.manager.preloadAds();
  assert.equal(rewards, 2);
  assert.equal(s.calls.show.length, 2);
  assert.ok(s.calls.load.filter(id => id === s.manager.rewardedId).length >= 2);
});

test('full-screen ads cannot overlap', async () => {
  const show = deferred();
  let showCount = 0;
  const s = setup({ showRewarded: async () => { showCount++; return show.promise; } });
  const first = s.manager.showRewarded(() => {});
  await new Promise(resolve => setTimeout(resolve, 10));
  await s.manager.showInterstitial();
  assert.equal(showCount, 1);
  assert.equal(s.calls.show.length, 0);
  show.resolve({ shown: false, rewarded: false });
  await first;
  await s.manager.preloadAds();
});

test('game script is syntactically valid and LevelPlay assets are packaged', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/build.yml'), 'utf8');
  assert.ok(html.indexOf('<script src="ads-controller.js"></script>') < html.indexOf('// --- GAME ENGINE ---'));
  assert.match(workflow, /cp index\.html ads-controller\.js www\//);
  assert.match(workflow, /capacitor-levelplay@0\.3\.0/);
  assert.match(workflow, /unityads-adapter:5\.15\.0/);
  for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script);
});

const flush = () => new Promise(resolve => setImmediate(resolve));

test('interstitial play time survives restarts and fires at the interval', async () => {
  const s = setup();
  await s.manager.init();
  for (let i = 0; i < 100; i++) s.manager.tick();
  s.manager.pauseLoopTimer();
  s.manager.startLoopTimer(); // restart must not reset the count
  for (let i = 0; i < 35; i++) s.manager.tick();
  await flush(); await flush();
  assert.equal(s.calls.show.filter(id => id === s.manager.interstitialId).length, 1);
  assert.equal(s.manager.secondsSinceInterstitial(), 0);
});

test('game-break interstitials respect grace period and cooldown', async () => {
  const s = setup();
  await s.manager.init();
  for (let i = 0; i < 30; i++) s.manager.tick();
  assert.equal(s.manager.onGameBreak('restart'), false); // inside first-play grace
  for (let i = 0; i < 40; i++) s.manager.tick();
  assert.equal(s.manager.onGameBreak('restart'), true);
  await flush(); await flush();
  assert.equal(s.calls.show.length, 1);
  for (let i = 0; i < 20; i++) s.manager.tick();
  assert.equal(s.manager.onGameBreak('restart'), false); // cooldown
});

test('a failed interstitial backs off instead of retrying every second', async () => {
  let attempts = 0;
  const s = setup({ showInterstitial: async () => { attempts++; return { shown: false, error: { message: 'no fill' } }; } });
  await s.manager.init();
  for (let i = 0; i < 136; i++) { s.manager.tick(); await flush(); }
  assert.equal(attempts, 1);
  for (let i = 0; i < 30; i++) { s.manager.tick(); await flush(); }
  assert.equal(attempts, 2);
});

test('banner is skipped without an ad unit ID', async () => {
  const s = setup();
  s.manager.bannerAdUnitId = '';
  await s.manager.init();
  await flush();
  assert.equal(s.calls.banner, undefined);
});

test('banner is created, loaded, shown and reserves bottom space', async () => {
  const s = setup();
  s.manager.bannerAdUnitId = 'bannerunit';
  await s.manager.init();
  await flush(); await flush();
  assert.deepEqual(s.calls.banner, ['create:bannerunit', 'load', 'show']);
  assert.equal(s.cssVars['--banner-space'], '50px');
  s.listeners.bannerLoaded({ bannerId: 'main', frame: { height: 50 } });
  assert.equal(s.manager.bannerState, 'shown');
});

test('banner load failure schedules a recreate', async () => {
  const s = setup();
  s.manager.bannerAdUnitId = 'bannerunit';
  s.manager.bannerRetryMs = 5;
  await s.manager.init();
  await flush(); await flush();
  s.listeners.bannerLoadFailed({ bannerId: 'main', error: { message: 'no fill' } });
  assert.equal(s.manager.bannerState, 'failed');
  await new Promise(r => setTimeout(r, 20)); await flush();
  assert.equal(s.calls.banner.filter(c => c.startsWith('create')).length, 2);
});

test('a refresh with no fill keeps an already loaded banner', async () => {
  const s = setup();
  s.manager.bannerAdUnitId = 'bannerunit';
  s.manager.bannerRetryMs = 5;
  await s.manager.init();
  await flush(); await flush();
  s.listeners.bannerLoaded({ bannerId: 'main', frame: { height: 50 } });
  s.listeners.bannerLoadFailed({ bannerId: 'main', error: { message: 'Mediation No fill' } });
  assert.equal(s.manager.bannerState, 'shown');
  await new Promise(r => setTimeout(r, 20)); await flush();
  assert.equal(s.calls.banner.filter(c => c.startsWith('create')).length, 1);
});

// --- age-api: Play Age Signals before LevelPlay starts (California AB 1043 / Brazil, Jan 2027) ---
function setupAge(ageCheck) {
  const asked = [];
  const extra = ageCheck ? { PlayAgeSignals: { check: async () => { asked.push(1); return ageCheck(asked.length); } } } : {};
  const env = setup({}, true, extra);
  env.manager.ageTimeoutMs = 50;
  env.manager.ageRetryMs = 1;
  return { ...env, asked };
}

const ageCases = [
  ['under 13', { ok: true, ageLower: 0, ageUpper: 12 }, 'minor'],
  ['13-15', { ok: true, ageLower: 13, ageUpper: 15 }, 'minor'],
  ['16-17', { ok: true, ageLower: 16, ageUpper: 17 }, 'minor'],
  ['18 or over', { ok: true, ageLower: 18, ageUpper: null }, 'adult'],
  ['open range from a child age', { ok: true, ageLower: 13, ageUpper: null }, 'minor'],
  ['no age from Play', { ok: true, ageLower: null, ageUpper: null }, 'none'],
  ['Play error', { ok: false, error: 'AgeSignalsException: -1' }, 'none']
];
for (const [name, answer, group] of ageCases) {
  test('age signal ' + name + ' -> ' + group + ' ads flags', async () => {
    const { manager, calls } = setupAge(() => answer);
    assert.equal(await manager.init(), true);
    assert.equal(manager.ageGroup, group);
    assert.equal(calls.init.length, 1);
    const consent = calls.init[0].consent;
    assert.equal(consent.gdprConsent, false);
    if (group === 'minor') { assert.equal(consent.coppa, true); assert.equal(consent.ccpaDoNotSell, true); }
    else { assert.equal(consent.coppa, undefined); assert.equal(consent.ccpaDoNotSell, undefined); }
  });
}

test('no age plugin: LevelPlay starts as today (no extra flags, no message)', async () => {
  const { manager, calls, messages } = setupAge(null);
  assert.equal(await manager.init(), true);
  assert.deepEqual(Object.keys(calls.init[0].consent), ['gdprConsent']);
  assert.ok(!messages.some(m => /Age signal/.test(m)));
});

test('a Play error is retried once; the retry answer is used', async () => {
  const { manager, calls, asked } = setupAge(n => (n === 1 ? { ok: false, error: 'transient' } : { ok: true, ageLower: 13, ageUpper: 15 }));
  assert.equal(await manager.init(), true);
  assert.equal(asked.length, 2);
  assert.equal(calls.init[0].consent.coppa, true);
});

test('a hanging age check times out and ads still start (no retry after a timeout)', async () => {
  const { manager, calls, asked, messages } = setupAge(() => new Promise(() => {}));
  assert.equal(await manager.init(), true);
  assert.equal(asked.length, 1);
  assert.equal(calls.init.length, 1);
  assert.equal(calls.init[0].consent.coppa, undefined);
  assert.ok(messages.some(m => m === 'Age signal unavailable: timeout'));
});

test('a throwing age plugin never blocks ads', async () => {
  const { manager, calls } = setupAge(() => { throw new Error('boom'); });
  assert.equal(await manager.init(), true);
  assert.equal(calls.init.length, 1);
  assert.equal(manager.ageGroup, 'none');
});

test('no age check outside the native app', async () => {
  const { manager } = setup({}, false);
  assert.equal(manager.getAgePlugin(), null);
  assert.equal((await manager.checkAge()).group, 'none');
});
