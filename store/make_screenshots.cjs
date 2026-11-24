// Makes the Play Store screenshots for Drop 2048 from the web build.
// Run from the repo root:  node store/make_screenshots.cjs
// Output: store/screenshots/raw/*.png (plain game, 1080x1920) and
//         store/screenshots/*.png (captioned store frames, 1080x1920).
// HIDE_FOR_1_2 hides the debug console and the lives card. Keep it false: the game
// hides the debug console itself since 1.2.0, and the CEO decided on 24 Nov 2026
// to keep the lives system, so screenshots must show the Lives card.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const HIDE_FOR_1_2 = false;
const WAIT = +(process.env.WAIT || 760); // ms after a drop: merges start at 480 ms
const root = path.resolve(__dirname, '..');
const outRaw = path.join(__dirname, 'screenshots', 'raw');
fs.mkdirSync(outRaw, { recursive: true });

const shots = [
  { file: '01-reach-2048', title: 'Drop. Merge.', sub: 'Reach 2048', score: 18432, best: 24116, next: 512,
    board: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,2,0,0,0],[4,16,0,8,0],[32,128,512,64,16],[256,1024,8,512,32]] },
  { file: '02-merge', title: 'Match & merge', sub: 'Two of a kind become one', score: 1240, best: 9804, next: 64, drop: 2, wait: WAIT,
    board: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[8,4,64,0,2],[16,32,128,8,4]] },
  { file: '03-chain', title: 'Chain 3 or more', sub: 'for one big jump', score: 3376, best: 9804, next: 32, drop: 2, wait: WAIT,
    board: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[4,32,0,32,8],[16,64,32,2,4]] },
  { file: '04-no-timer', title: 'No timer', sub: 'Take your time on every drop', score: 312, best: 9804, next: 8,
    board: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,4,0,0],[2,16,8,0,4]] },
  { file: '05-2048', title: 'Hit 2048', sub: 'and keep going', score: 41208, best: 41208, next: 256,
    board: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[8,0,0,2,0],[64,256,32,16,4],[512,2048,128,1024,64]] },
  { file: '06-best-score', title: 'Beat your best', sub: 'Short games, big numbers', score: 26880, best: 25412, next: 128,
    board: [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,16,0],[2,8,0,32,0],[16,64,256,128,4],[1024,512,32,256,8]] },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
  for (const s of shots) {
    await page.goto('file://' + path.join(root, 'index.html'));
    if (HIDE_FOR_1_2) await page.addStyleTag({ content: '#debug-box{display:none!important} .stat-card:has(#lives-display){display:none!important}' });
    await page.click('#start-btn'); await page.waitForTimeout(300);
    await page.evaluate(s => {
      board = s.board; score = s.score; highScore = s.best;
      scoreText.innerText = s.score; bestText.innerText = s.best;
      nextValue = s.next; activeBlock.innerText = s.next;
      const c = PALETTE[s.next] || PALETTE[2];
      activeBlock.style.backgroundColor = c.bg; activeBlock.style.color = c.text;
      setDropperPosition(s.drop ?? 2); renderBoard();
    }, s);
    await page.waitForTimeout(200);
    if (s.drop !== undefined) { await page.evaluate(c => dropIntoColumn(c), s.drop); await page.waitForTimeout(s.wait);
      await page.evaluate(v => { activeBlock.innerText = v; const c = PALETTE[v] || PALETTE[2]; activeBlock.style.backgroundColor = c.bg; activeBlock.style.color = c.text; }, s.next); }
    await page.screenshot({ path: path.join(outRaw, s.file + '.png') });
  }
  // Captioned store frames
  for (const s of shots) {
    const img = 'data:image/png;base64,' + fs.readFileSync(path.join(outRaw, s.file + '.png')).toString('base64');
    await page.setContent(`<!doctype html><html><head><style>
      html,body{margin:0;width:360px;height:640px;overflow:hidden;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
      body{background:linear-gradient(160deg,#4f46e5 0%,#6d28d9 55%,#312e81 100%);color:#fff;text-align:center}
      h1{margin:44px 18px 4px;font-size:34px;font-weight:900;letter-spacing:-.5px;line-height:1.05}
      p{margin:0 18px;font-size:17px;font-weight:600;opacity:.88}
      .phone{position:absolute;left:50%;top:150px;transform:translateX(-50%);width:262px;height:466px;border-radius:30px;
        overflow:hidden;border:7px solid #111827;box-shadow:0 24px 48px rgba(0,0,0,.35)}
      .phone img{width:100%;height:100%;object-fit:cover;display:block}
    </style></head><body><h1>${s.title}</h1><p>${s.sub}</p><div class="phone"><img src="${img}"></div></body></html>`);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(__dirname, 'screenshots', s.file + '.png') });
  }
  await browser.close();
  console.log('Wrote', shots.length, 'raw and', shots.length, 'captioned screenshots.');
})();
