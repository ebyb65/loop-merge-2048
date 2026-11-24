# Drop 2048: screenshot storyboard (draft)

Zara, 23 Nov 2026. 6 portrait screenshots, 1080x1920 (Play: 9:16, min 320 px, max 3840 px side).
Files: `store/screenshots/0X-*.png` (captioned, for upload) and `store/screenshots/raw/` (plain game frames).
Re-make any time: `node store/make_screenshots.cjs` from the repo root (needs Playwright + Chromium).

Look: our own indigo-to-violet gradient, white bold caption on top, game shown in a plain dark rounded frame. No competitor layouts, mascots or device brands.
Order matters: Play shows the first 2-3 in search, so the first three carry the pitch (goal, core move, combo).

| # | File | Caption (title / line 2) | What it shows |
|---|---|---|---|
| 1 | 01-reach-2048 | Drop. Merge. / Reach 2048 | Busy late-game board with 256, 512 and 1024 tiles, a 512 ready to drop. The goal at a glance. |
| 2 | 02-merge | Match & merge / Two of a kind become one | A 64 dropped onto a 64 pops into a 128 (merge animation frame). The core move. |
| 3 | 03-chain | Chain 3 or more / for one big jump | Four 32s in an L/T shape collapse into one 128. The combo hook. |
| 4 | 04-no-timer | No timer / Take your time on every drop | Calm early board, few tiles. Sells the relaxed pace (top competitor complaint is pressure and ads). |
| 5 | 05-2048 | Hit 2048 / and keep going | Board with a 2048 tile in the bottom row next to 1024. The payoff. |
| 6 | 06-best-score | Beat your best / Short games, big numbers | Score above Best (26,880 vs 25,412). Replay motivation. |

Honesty notes:
- Boards are set up states made with the real game code and rendering (no painted tiles). Score numbers are illustrative of reachable play, not anyone's real record.
- Re-made 24 Nov with `HIDE_FOR_1_2 = false`: the frames show the Lives card, because the CEO decided to keep the lives system. The debug console is hidden by the game itself since 1.2.0.
- Above 2048 the game has no tile colour yet (falls back to the "2" blue). Not shown; small item for Arjun (d-tile-colors) if we advertise "keep going".

Later: Arabic and Hindi caption versions (same frames, translated captions), and a 7th shot of a new feature (e.g. daily challenge, d-retention) once it exists.
