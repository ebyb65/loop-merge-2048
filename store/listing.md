# Drop 2048: store listing draft (English)

Status: DRAFT by Zara, 23 Nov 2026. Nothing here is published. The CEO approves before anything changes in Play Console.
Package: com.games.drop2048 · Arabic and Hindi versions follow once English is approved.

## Read this first: ship the listing with a cleanup update, not alone
The live build (1.1.0, from `main`) has two things a new listing would send players straight into:
1. **An on-screen debug console** (green text on black, bottom of the screen, `#debug-box` in index.html) that covers the bottom row of the board. Seen in a headless run of `main` and `develop`.
2. **A 3-lives system with a 15-minute refill** that stops play at 0 lives.
Recommendation: publish this listing together with 1.2.0, which hides the debug console (d-debug-off, done 23 Nov).
CEO decision 24 Nov 2026: the lives system **stays as it is** (3 lives, 15-minute refill). The copy below makes no claim about lives or unlimited play, and the screenshots show the Lives card.
CEO decision 23 Nov 2026: the timed mid-game interstitial (every 135 s of play, with a 3 s "Short Ad" warning) **stays**. Drop 2048 is endless with no levels, so there is no natural break between levels. The copy makes no claim about when ads appear.

## What competitors do (research 23 Nov 2026)
Looked at Drop the Number: Puzzle Merge, X2 Blocks: Number Block Puzzle, Drop The Number: Merge Puzzle, Drop Block - 2048 Merge Puzzle (store pages and visible reviews).
- Titles follow one pattern: Drop / Number + Merge / Block + Puzzle, often with 2048. Our current title already covers drop, 2048, number, block and merge.
- Selling points everyone uses: offline play, no time limit, leaderboards, "brain training", boosters.
- **Top player complaints** (about 20 of ~32 visible reviews): too many ads, ads at start and at every milestone, unskippable long ads; then freezes after ads (about 6) and lost progress (about 4).
- So our angle: **the calm, fair one**. No timer, rewarded videos always optional. That is a promise we can keep and competitors can't easily copy.
Rule check: no competitor names, icons or look reused; our colours (indigo + flat tiles on light grid) are our own.

## Title (max 30)
**Keep: `Drop 2048: Number Block Merge`** (29). It already holds the main search words.
Alternative to A/B later via Play store listing experiments: `Drop 2048: Merge Number Puzzle` (30) adds "puzzle", drops "block".

## Short description (max 80)
**`Drop number blocks, merge equal pairs and chains, reach 2048. Calm, no timer.`** (77)
Alternative: `Drop, merge, chain: a calm 2048 number block puzzle you can play offline.` (73)

## Full description (max 4000)
```
Drop a number block, watch it merge, and chase 2048.

Drop 2048 is a calm number puzzle with simple rules and room to think. Tap a column to drop the next block. When two equal numbers touch, they merge into one bigger number. Line up three or more and the whole group merges at once for a bigger jump and a bigger score.

HOW IT WORKS
• Tap any of the five columns to drop the next block
• Equal numbers that touch side by side or on top of each other merge
• Groups of three or more (L and T shapes) merge into one higher number
• Keep the columns from filling up and push your score higher
• Stuck? You can watch a short video to clear the top two rows and keep your score. It is always your choice

WHY PLAYERS LIKE IT
• No timer: take as long as you want over every drop
• Clean, minimal look with bright, easy-to-read tiles
• Plays offline
• Short games that fit a coffee break, with your best score saved on your phone

Can you reach 2048, and then go past it?

Made by Yebee Games, a small independent studio. Ideas or problems? Write to us from the Play Store page; we read every message.
```
Notes:
- Removed 24 Nov: the line "No lives to wait for" (the lives system stays, CEO decision).
- Avoided: "best", "#1", "free" claims, emoji spam, keyword stuffing, mentions of other games (Play metadata policy).
- Keyword spread: 2048 ×3, merge ×4, number ×3, block ×4, puzzle ×1, drop ×4. Natural, not stuffed.

## Screenshots
Publishing steps for the CEO: `store/publish-guide.md`.
See `store/screenshots.md` (storyboard) and `store/screenshots/` (1080x1920 PNGs from the web build, made by `store/make_screenshots.cjs`).

## Feature graphic idea (1024x500)
Indigo-to-violet gradient (#4f46e5 → #7c3aed). Left: "DROP 2048" in the game's heavy sans, white, with "Drop. Merge. Chain." underneath. Right: three of our flat tiles (2, 4, 8 in the game's blue/cyan/green) falling into a short column ending in a large rose 2048 tile with a soft glow. No device frame, no text in the bottom-right corner (Play overlays the play button on video graphics). Original composition; doesn't borrow any competitor's layout.

## Not changed / later
- Icon: no change proposed this round.
- Arabic and Hindi: after English approval (Zara).
- Store listing experiment (title A/B) once we have more than a handful of daily visitors; with ~1 DAU today the test would never reach a result.
