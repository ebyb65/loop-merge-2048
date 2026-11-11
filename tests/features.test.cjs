const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'features.js'), 'utf8');

function load() {
  const m = {};
  const storage = { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
  const ctx = vm.createContext({});
  vm.runInContext(source + '\nthis.F = Features;', ctx);
  ctx.F.storage = storage;
  return ctx.F;
}
const day = s => new Date(s + 'T10:00:00');

test('new players start with one hammer; items are added and used', () => {
  const F = load();
  assert.deepEqual({ ...F.getInventory() }, { hammer: 1, undo: 0 });
  assert.equal(F.useItem('undo'), false);
  assert.equal(F.useItem('hammer'), true);
  assert.equal(F.useItem('hammer'), false);
  F.addItems({ hammer: 2, undo: 3 });
  assert.deepEqual({ ...F.getInventory() }, { hammer: 2, undo: 3 });
});

test('daily gift: once per day, ad gives 3x', () => {
  const F = load();
  const g = F.claimDaily(true, day('2026-11-12'));
  assert.equal(g.day, 1);
  assert.equal(g.hammer, 3);
  assert.equal(F.claimDaily(false, day('2026-11-12')), null);
  assert.equal(F.todaysStreakDay(day('2026-11-12')), null);
});

test('streak grows on consecutive days, resets after a missed day, wraps after 7', () => {
  const F = load();
  const dates = ['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08'];
  const days = dates.map(d => F.claimDaily(false, day(d)).day);
  assert.deepEqual(days, [1,2,3,4,5,6,7,1]);
  assert.equal(F.todaysStreakDay(day('2026-11-10')), 1); // skipped the 9th
});

test('day 7 refills lives and crosses month boundaries', () => {
  const F = load();
  F.write(F.KEYS.daily, { lastClaim: '2026-11-30', streak: 6 });
  const g = F.claimDaily(false, day('2026-12-01'));
  assert.equal(g.day, 7);
  assert.equal(g.fullLives, true);
});

test('undo snapshot restores the exact earlier state', () => {
  const F = load();
  const board = [[0,0],[2,4]];
  F.takeSnapshot({ board, score: 10, highScore: 50, nextValue: 8 });
  board[0][0] = 16;
  const s = F.popSnapshot();
  assert.deepEqual(s.board.map(r => [...r]), [[0,0],[2,4]]);
  assert.equal(s.nextValue, 8);
  assert.equal(F.hasSnapshot(), false);
});

test('hammer removes a tile and the column settles', () => {
  const F = load();
  const b = [[0,0],[4,0],[8,0],[2,0]];
  assert.equal(F.smashTile(b, 2, 0), true);
  assert.deepEqual(b.map(r => r[0]), [0,0,4,2]);
  assert.equal(F.smashTile(b, 0, 1), false);
});
