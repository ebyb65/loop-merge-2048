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
  const calls = { init: [], load: 0, show: 0, interstitial: 0 };
  const messages = [];
  const alerts = [];
  const plugin = {
    initialize: async options => { calls.init.push(options); },
    isRewardedVideoLoaded: async () => ({ loaded: false }),
    isInterstitialLoaded: async () => ({ loaded: false }),
    loadRewardedVideo: async () => { calls.load++; },
    loadInterstitial: async () => {},
    showRewardedVideo: async () => { calls.show++; return { success: true }; },
    showInterstitial: async () => { calls.interstitial++; return { success: true }; },
    ...overrides
  };
  const context = vm.createContext({
    window: { Capacitor: native ? { Plugins: { Unityads: plugin } } : undefined,
      alert: message => alerts.push(message) },
    logToScreen: message => messages.push(message),
    setInterval: () => 1,
    clearInterval: () => {},
    document: { getElementById: () => ({ style: {} }) }
  });
  vm.runInContext(source + '\nthis.manager = UnityAdsManager;', context);
  return { manager: context.manager, plugin, calls, messages, alerts };
}

test('one native initialization for concurrent callers; configured test mode is passed', async () => {
  const wait = deferred();
  let count = 0;
  const { manager } = setup({ initialize: async options => {
    count++;
    assert.equal(options.testMode, false);
    await wait.promise;
  } });
  manager.testMode = false;
  const first = manager.init();
  const second = manager.init();
  assert.equal(count, 1);
  wait.resolve();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
});

test('failed initialization can be retried without granting a reward', async () => {
  let count = 0;
  const { manager } = setup({ initialize: async () => {
    if (++count === 1) throw new Error('offline');
  } });
  let rewards = 0;
  await manager.showRewarded(() => rewards++);
  assert.equal(rewards, 0);
  assert.equal(manager.initialized, false);
  assert.equal(await manager.init(), true);
});

test('missing native bridge never grants a reward', async () => {
  const { manager, alerts } = setup({}, false);
  let rewards = 0;
  await manager.showRewarded(() => rewards++);
  assert.equal(rewards, 0);
  assert.equal(alerts.length, 1);
});

test('a load failure prevents showing and does not grant a reward', async () => {
  const { manager, calls } = setup({ loadRewardedVideo: async () => { throw new Error('no fill'); } });
  let rewards = 0;
  await manager.showRewarded(() => rewards++);
  assert.equal(rewards, 0);
  assert.equal(calls.show, 0);
});

test('bidding mismatch is diagnosed and not retried; interstitial still loads', async () => {
  let attempts = 0;
  let interstitialLoads = 0;
  const { manager, messages } = setup({
    loadRewardedVideo: async () => {
      attempts++;
      throw new Error('adMarkup is missing; objectId is missing');
    },
    loadInterstitial: async () => { interstitialLoads++; }
  });
  await manager.init();
  await manager.preloadAds();
  await manager.showRewarded(() => assert.fail('unexpected reward'));
  assert.equal(attempts, 1);
  assert.ok(interstitialLoads > 0);
  assert.ok(messages.some(message => message.includes('CONFIGURATION:')));
});

for (const result of [{ success: false }, undefined, {}]) {
  test('incomplete/missing completion result never grants a reward: ' + JSON.stringify(result), async () => {
    const { manager } = setup({ showRewardedVideo: async () => result });
    let rewards = 0;
    await manager.showRewarded(() => rewards++);
    assert.equal(rewards, 0);
  });
}

test('show error does not grant a reward and releases the tap lock', async () => {
  const { manager } = setup({ showRewardedVideo: async () => { throw new Error('show failed'); } });
  await manager.showRewarded(() => assert.fail('unexpected reward'));
  assert.equal(manager.rewardInProgress, false);
});

test('waits for load before show and deduplicates a second tap', async () => {
  const load = deferred();
  const show = deferred();
  let shows = 0;
  const { manager } = setup({
    loadRewardedVideo: () => load.promise,
    showRewardedVideo: () => { shows++; return show.promise; }
  });
  let rewards = 0;
  const first = manager.showRewarded(() => rewards++);
  await manager.showRewarded(() => rewards++);
  assert.equal(shows, 0);
  load.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(shows, 1);
  assert.equal(rewards, 0);
  show.resolve({ success: true });
  await first;
  assert.equal(rewards, 1);
  assert.equal(manager.rewardInProgress, false);
});

test('each subsequent reward checks native readiness and can load a fresh ad', async () => {
  const { manager, calls } = setup();
  let rewards = 0;
  await manager.showRewarded(() => rewards++);
  await manager.showRewarded(() => rewards++);
  assert.equal(rewards, 2);
  assert.equal(calls.show, 2);
  assert.equal(calls.load, 2);
});

test('interstitial show start does not trigger immediate reload or claim closure', async () => {
  let loads = 0;
  const { manager, messages } = setup({ loadInterstitial: async () => { loads++; } });
  await manager.init();
  await manager.preloadAds();
  await manager.showInterstitial();
  assert.equal(loads, 2); // startup, then mocked native not-loaded before show
  assert.ok(messages.includes('Interstitial started.'));
  assert.ok(!messages.some(message => /closed/i.test(message)));
});

test('controller loads before game code and is packaged in Android web assets', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/build.yml'), 'utf8');
  assert.ok(html.indexOf('<script src="ads-controller.js"></script>') < html.indexOf('// --- GAME ENGINE ---'));
  assert.match(workflow, /cp index\.html ads-controller\.js www\//);
  assert.match(workflow, /capacitor-unity-ads@1\.0\.0/);
  for (const [, script] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    new vm.Script(script);
  }
});
