// Drop 2048 — power-ups, daily gift and login streak (pure logic + local storage).
// UI wiring lives in index.html; this file stays testable in Node.

const Features = {
  storage: null, // injected for tests; defaults to window.localStorage

  KEYS: {
    inventory: 'drop2048_inventory',
    daily: 'drop2048_daily'
  },

  STARTER_INVENTORY: { hammer: 1, undo: 0 },
  FREE_UNDOS_PER_GAME: 1,
  STREAK_LENGTH: 7,
  AD_GIFT_MULTIPLIER: 3,

  // Day 1..7 of the streak. Day 7 also refills lives (not multiplied by the ad).
  GIFTS: [
    { hammer: 1, undo: 0 },
    { hammer: 0, undo: 1 },
    { hammer: 1, undo: 1 },
    { hammer: 2, undo: 0 },
    { hammer: 0, undo: 2 },
    { hammer: 2, undo: 1 },
    { hammer: 3, undo: 2, fullLives: true }
  ],

  // --- storage helpers (never throw) ---
  store() {
    if (this.storage) return this.storage;
    try { return window.localStorage; } catch (e) { return null; }
  },
  read(key, fallback) {
    try {
      const raw = this.store() && this.store().getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  },
  write(key, value) {
    try { this.store() && this.store().setItem(key, JSON.stringify(value)); } catch (e) {}
  },

  // --- inventory ---
  getInventory() {
    const inv = this.read(this.KEYS.inventory, null);
    if (!inv) return { ...this.STARTER_INVENTORY };
    return { hammer: Math.max(0, inv.hammer | 0), undo: Math.max(0, inv.undo | 0) };
  },
  addItems(items) {
    const inv = this.getInventory();
    inv.hammer += Math.max(0, (items && items.hammer) | 0);
    inv.undo += Math.max(0, (items && items.undo) | 0);
    this.write(this.KEYS.inventory, inv);
    return inv;
  },
  useItem(name) {
    const inv = this.getInventory();
    if (!(inv[name] > 0)) return false;
    inv[name]--;
    this.write(this.KEYS.inventory, inv);
    return true;
  },

  // --- dates (local calendar day) ---
  dayKey(date) {
    const d = date || new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  },
  daysBetween(fromKey, toKey) {
    const [y1, m1, d1] = fromKey.split('-').map(Number);
    const [y2, m2, d2] = toKey.split('-').map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  },

  // --- daily gift + streak ---
  getDailyState() {
    return this.read(this.KEYS.daily, { lastClaim: null, streak: 0 });
  },
  // Which streak day today's gift is (1..7), or null if already claimed today.
  todaysStreakDay(now) {
    const today = this.dayKey(now);
    const s = this.getDailyState();
    if (!s.lastClaim) return 1;
    const gap = this.daysBetween(s.lastClaim, today);
    if (gap <= 0) return null; // claimed today (or clock moved back)
    if (gap === 1) return (s.streak % this.STREAK_LENGTH) + 1; // kept the streak
    return 1; // missed a day: start again
  },
  giftForDay(day) {
    return this.GIFTS[Math.min(Math.max(day, 1), this.STREAK_LENGTH) - 1];
  },
  // Claim today's gift. Returns the items granted, or null if nothing to claim.
  claimDaily(withAd, now) {
    const day = this.todaysStreakDay(now);
    if (!day) return null;
    const gift = this.giftForDay(day);
    const mult = withAd ? this.AD_GIFT_MULTIPLIER : 1;
    const granted = { hammer: gift.hammer * mult, undo: gift.undo * mult, fullLives: !!gift.fullLives, day };
    this.addItems(granted);
    this.write(this.KEYS.daily, { lastClaim: this.dayKey(now), streak: day });
    return granted;
  },

  // --- undo snapshots (one step) ---
  snapshot: null,
  takeSnapshot(state) {
    this.snapshot = {
      board: state.board.map(row => row.slice()),
      score: state.score,
      highScore: state.highScore,
      nextValue: state.nextValue
    };
  },
  clearSnapshot() { this.snapshot = null; },
  hasSnapshot() { return !!this.snapshot; },
  popSnapshot() {
    const s = this.snapshot;
    this.snapshot = null;
    return s;
  },

  // --- hammer ---
  // Removes one tile and lets the column settle. Returns false if the cell is empty.
  smashTile(board, r, c) {
    if (!board[r] || !(board[r][c] > 0)) return false;
    board[r][c] = 0;
    for (let k = r; k > 0; k--) board[k][c] = board[k - 1][c];
    board[0][c] = 0;
    return true;
  }
};

if (typeof window !== 'undefined') window.Features = Features;
