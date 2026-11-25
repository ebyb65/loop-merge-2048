# Teardown: Block Blast! (Hungry Studio)

Nora, 25 Nov 2026. Why this game: it is the biggest block puzzle on mobile, shares Drop 2048's audience (simple number/block puzzles, endless high-score play) and is the clearest example of a game that is "readable at a glance", which is what the CEO asked for in game #3.

Sources are public pages only, read 25 Nov 2026. I did not play the game on a phone, so onboarding and exact ad timing are **not observed** here. Numbers below are as reported by the source; none are ours.

- Apple App Store page: https://apps.apple.com/us/app/block-blast/id1617391485
- Kimola review report (30 Google Play reviews, Jun 2025): https://kimola.com/reports/dive-into-block-blast-user-feedback-analysis-report-google-play-152706
- Deconstructor of Fun, Jan 2026: https://deconstructoroffun.com/blog/2026/1/19/from-tetris-to-block-blast-why-block-puzzles-never-stop-printing
- The Star / Inc., 28 Oct 2026, "Is Block Blast rigged?": https://www.thestar.com.my/tech/tech-news/2026/10/28/is-block-blast-rigged-a-developer-decompiled-the-viral-game-to-find-out
- PocketGamer.biz, 29 May 2026: https://www.pocketgamer.biz/hungry-studios-block-blast-returns-to-google-play/
- (Global Games Forum article on their A/B testing returned the site index, not the article. Not used.)

## Scale

- App Store: 4.9 stars from 2.9M ratings, #7 in Casual. Free, "Contains Advertising", plus subscriptions (1 week $4.99, 1 month $9.99, 1 year $49.99; the listing does not say what they unlock). Deconstructor of Fun (Jan 2026) says it is ad-only with no IAP, so this looks recent.
- Company figures (Jan 2026): 70M daily users, about 300M monthly. AppMagic: about 868M installs since 2021. Sensor Tower: about US$127M ad revenue Jan-May 2026, top-grossing by ad revenue (next: Vita Mahjong, about US$38M).
- The Google Play page was down from 28 May 2026 and later restored; no reason given.

## Core loop and level design

- 8x8 board. Each turn you get **3 pieces** and place all of them in any order; full rows or columns clear. No falling pieces, no timer. Game ends when none of the 3 pieces fits.
- One rule, one screen, no tutorial needed to understand it. That is the main lesson for game #3.
- "Perfect" feedback and combo clears reward good planning (Deconstructor).
- Modes from the listing: **Classic** (endless high score), **Adventure** (levels with goals, "unique jigsaw designs and colourful themes"), and **Fresh Daily Puzzles**.
- Events: a limited-time "Tropical Bird Puzzle": play to collect jigsaw pieces and reveal a picture.

## Piece generation and the "rigged" story

- Hungry Studio says it ran more than 10,000 A/B tests in 2025, about 300 a day in parallel, with an internal simulator.
- A developer who decompiled the game (Oct 2026, 15M+ views on his post) **claims** the piece generator reads ad value: after you finish rewarded ads, when the next ad is worth more, and once you are past your high score, it hands you a losing set of pieces; it gives easier pieces when you are far below your best. These are his claims; the studio did not reply to the press. Not verified by us.
- An App Store review (Jan 2025) already complained about not getting the pieces needed near 2000 points.

## Ads (from reviews; not observed)

- The most common complaint is ad volume: "a lot of ads" (App Store review, Aug 2025); Kimola's sample tags "Ads Frequency" and "Inaccurate Ads" as negatives and players asking for a paid ad-free version.
- "Black screens after reviving" is reported in the Kimola summary: the revive ad flow leaves players stuck.
- A player expected a different game from the ads ("destroy blocks before the line reaches them") and was disappointed (Apr 2024).
- Age rating: page now shows 13+ with "Simulated Gambling" and "Sexual Content or Nudity" (Infrequent), which usually comes from the ads shown, not the game.

## What players praise

- "Easy to understand", but with "underlying strategy"; people play "for hours" (App Store, Oct 2024).
- Calm: no timer, play at your own pace.

## Retention features seen

Daily puzzles, an Adventure level path with themed jigsaw pictures, limited-time picture-collection events, Game Center achievements. I found no public source on streaks or a map screen.

## What Yebee can learn (without copying)

1. **Readable at a glance wins.** One board, one rule, three choices per turn. Bring this test to Friday's ideas review: can a new player understand the screen from a single screenshot?
2. **Fairness is a selling point we already have.** Drop 2048's next block is plain random (`rollNextValue()` in index.html, values 2-64 capped by the board). Block Blast is now publicly accused of tuning pieces to ad value. We should keep it that way and can say so, honestly, in the listing.
3. **Rewarded flows must never leave a player stuck.** Block Blast players report black screens after reviving. Our code handles failed or skipped ads (alert, modal stays open), but if the rewarded ad isn't preloaded, tapping "Watch Ad" can wait up to 30 s (`loadTimeoutMs`) with no visible change and further taps are ignored. A "Loading ad..." state fixes that.
4. **Daily puzzle + collection event** is a proven light retention loop that needs no energy system. It supports our existing `d-retention` item (daily challenge and streaks).
5. **Avoid what players hate**: ad volume, ads that misrepresent the game, ads with adult or gambling content (supports Omar's `ad-categories` item). Our rules already ban ads mid-puzzle.

Not recommended: anything that adjusts difficulty by ad value, revive-ad pressure, or subscriptions; all conflict with studio rules or our "fair" positioning.

## Backlog items filed

- `d-ad-loading` (Arjun): show a loading state on Watch Ad buttons while the rewarded ad loads.
- `d-fair-line` (Zara): consider an honest "random blocks, never rigged" line in the Drop 2048 listing draft (CEO approves listing changes).
- Evidence added to `d-retention` and `next-idea`.
