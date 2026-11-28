# Teardown: Drop The Number and Drop Merge® (Superbox) — 28 Nov 2026

Nora, Ideas lab. Relevant to **Drop 2048: Number Block Merge**.

The 24 Nov teardown covered a small clone called "Drop the Number: Puzzle Merge" (A2 Apps, 103 ratings). This one covers the original and much bigger games from SUPERBOX. Inc, the studio that made drop-and-merge popular.

## Sources and limits

- Drop The Number: Merge Puzzle, App Store US: https://apps.apple.com/US/app/id1454637812 (4 reviews shown)
- Same game, App Store UK: https://apps.apple.com/gb/app/id1454637812?l=en-gb (4 reviews shown)
- Same game, 25 App Store reviews collected by an aggregator: https://justuseapp.com/en/app/1454637812/drop-the-number-merge-puzzle/reviews (stars and most dates not shown)
- Drop Merge®: Number Puzzle, App Store US: https://apps.apple.com/us/app/1661095183 (4 reviews shown)
- BlueStacks page (Android package id com.superbox.aos.fire2048): https://www.bluestacks.com/apps/puzzle/drop-the-number-merge-game-on-pc.html
- TapTap page: https://www.taptap.io/app/178360

Read on 28 Nov 2026. Google Play pages could not be opened from this workspace this shift, so the evidence is iOS store text and iOS reviews (about 37 reviews, mostly 2019-2024, not weighted by helpfulness). No videos were watched and the games were not played, so onboarding and exact ad timings come from listings and reviewers, not from our own play.

## Drop The Number: Merge Puzzle

- **Size**: 4.7 from about 84K ratings (US), 4.7 from 11K (UK). Age 13+. Version 2.6.9 (26 Oct); every release note is "Bug fixes and performance improvements." On the market since April 2019.
- **Pitch**: "Tap, Drop, Merge". Listing features: "Game let you know the next block" ("If it is too tricky, check your next number!"), world ranking leaderboard, vibration on drop, "No wifi connection required", share best score. BlueStacks mentions a practice mode.
- **Onboarding**: has a tutorial (one reviewer liked it, another found it "too redundant"). Details not on the page.
- **Level design**: endless board, no levels. Requests: one more row / a taller grid (2 reviewers), seasonal themes, multiplayer. One player finds the low numbers annoying at high scores.
- **Economy and boosters**: coins; a hammer that removes a block (praised); a daily spin (praised: "gave 100 coins"); a piggy bank that keeps coins you didn't collect (confusing, 2 reviewers); paid reveal of the next block (UK review); revives; tournaments with paid or ad-paid replays.
- **IAPs**: Remove Ads $4.99; Diamond Membership $1.99/week after a 3-day trial, $5.99/month, $49.99/year; gold packs $1.99-$9.99; Super Bundle $29.99; revive packs; piggy bank $2.99; "Tournament Play Again" $0.99.
- **Ads (what reviewers report)**: the biggest theme, in about 15 of the 25 aggregator reviews.
  - Ads at milestone tiles (1024, 2048, 4096) in the middle of a run: "ads at 1024, 2048, 4096 mid-game are the main frustration; asks for ads only at start and end"; a "2-minute ad break at 1024".
  - Ads right after pressing START (2 reviewers: one uninstalled after 10 minutes).
  - Long unskippable ads (about 30 s, up to ~1.5 min), tiny or hidden close buttons, ads that open the store.
  - Ads play sound even when the game's sound is off (interrupts an audiobook).
  - Ads still shown after paying to remove them (3 reviewers).
  - Positive side: 2 reviewers say ads are short and less frequent than in most games.
- **Stability after ads**: about 7 reviewers: freezes, black screens and lag after an ad, phone slows and heats after 5-10 minutes, coins lost when the game locked.
- **Progress**: "phone call during ad resets the game", "progress not kept, new game starts" (lost runs are a theme); one reviewer praises being able to "resume progress after quitting". Tournament scores sometimes fail to save.
- **What players praise**: addictive, simple, a brain workout, hammer and daily spin, fair coin prices, the leaderboard.

## Drop Merge®: Number Puzzle (same studio, 2023)

- 4.9 from about 24K ratings (US). Age 4+. Version 1.8.5 (21 Oct).
- Same pitch: next-block preview, world leaderboard, "Play offline or online!", vibration toggle in the pause menu.
- IAPs: coin packs $0.99-$29.99, Remove Ads $6.99, "Remove Ads Plus" $9.99, piggy bank, special packs.
- Reviews (4): ads fire **when the player hasn't moved for about 30 seconds** and loop back-to-back; ads open the browser to suspicious sites; progress reset to the start for weeks; coins spent on a merge that didn't happen; "asks for a save feature".

## How Drop 2048 compares (checked in develop today)

- **Next block**: they show it; we don't yet (backlog d-next-preview, spec done).
- **No ads at milestones**: our interstitials are on a play clock (ads-controller.js: 45 s grace, every 135 s of active play, 3 s warning toast, and a between-games ad if 60 s have passed). Nothing fires on reaching 1024 or 2048. Good.
- **Ad right after Start**: we can do this too: the Start button calls `UnityAdsManager.onGameBreak('new game')` (index.html line ~1007), so the second game of a session can open with an interstitial, the exact moment two of their reviewers quit over.
- **Idle**: our play clock counts every second the game screen is visible (`tick()` only skips when the app is hidden or an ad is showing), so a player who stops to think or puts the phone down for a minute is counted as playing, and the mid-game ad can fire while they are not playing. That is the Drop Merge "ad after 30 s idle" complaint.
- **Lost runs**: we save only lives, the refill time and the high score (`drop2048_lives`, `drop2048_next_refill`, `drop2048_hi`). The board, score and next value are not saved, so if Android kills the app (a phone call, switching apps, low memory) the run is lost. Both of their games are criticised for this, and resuming is praised.
- **Paid ad removal**: we don't sell it yet. Same rule as on 24 Nov: if we ever do, it must remove every ad including banners.

## What we can learn (without copying)

1. **Save the current game and resume it** (board, score, next value, Clear-2-Rows state) whenever it changes, and restore it on launch with "Continue". It costs nothing in ads and fixes a top-five complaint in the genre. → backlog d-save-run (Arjun, Lena checks).
2. **Only count play time while the player is actually playing.** Stop the interstitial clock when there has been no drop for ~10 s, and restart it on the next drop. This means fewer ads, never more, and no ad can land on a player who is thinking. → backlog d-idle-adclock (Omar to confirm the revenue effect, Arjun builds). It doesn't change the CEO's 135 s / 3 s warning decision.
3. **Don't greet a new game with an ad.** Evidence for Omar: move the between-games interstitial from the Start/Restart tap to the game-over screen (after the score is shown) so tapping Start always starts playing. Same number of ads. Included in the d-idle-adclock note; it changes where an existing ad appears, so Omar decides whether it needs the CEO.
4. **Stability after ads matters as much as ad count.** Their 4.7 hides many "froze after an ad" reviews. Our d-ad-loading item (show "Loading ad..." instead of a dead button) is the same lesson; Lena's phone test after an ad should check the board still responds and the music/sound state is right.
5. **A free daily spin and a hammer booster are praised.** Nothing to file now: a daily reward fits d-retention (daily challenge and streaks) when that is designed, as long as it stays free and optional.
6. **Taller-board requests** (2 reviewers) are a hint for a later mode, not a change: our 5x7 board is part of the balance Lena tested.

## Not filed (breaks studio rules or not for us)

- Paid next-block reveal, paid tournament replays, a weekly subscription, a piggy bank: paywalls or pressure, against our player-friendly rules.
- Ads at milestone tiles: never.

## Not copying

Superbox's names ("Drop The Number", "Drop Merge"), icon, art, colours and coin/diamond economy stay theirs. The lessons above are generic (save and resume, fair ad timing, stability).
