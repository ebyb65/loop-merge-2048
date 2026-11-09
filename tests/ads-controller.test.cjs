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

function setup(overrides = {}, native = true) {
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
    window: { Capacitor: native ? { Plugins: { LevelPlay: plugin } } : undefined, alert: m => alerts.push(m) },
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
