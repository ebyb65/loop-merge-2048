# Drop 2048: paste-in guide for the new store listing (CEO)

Zara, 24 Nov 2026. For use **when 1.2.0 (code 14) goes to production** (backlog d-120, d-listing). The listing was approved by the CEO on 23 Nov; this is only the how-to. Nothing here has been published.
About 10 minutes. Everything below is on the `develop` branch of ebyb65/loop-merge-2048: https://github.com/ebyb65/loop-merge-2048/tree/develop/store

## Before you start
- 1.2.0 is released (or being sent for review) in the same sitting, so the new screenshots and text match the game players download. Theo's checklist: `docs/releases/drop2048-1.2.0.md`.
- Download the 6 screenshots from `store/screenshots/` (open each PNG on GitHub, then "Download raw file"): 01-reach-2048, 02-merge, 03-chain, 04-no-timer, 05-2048, 06-best-score. All are 1080x1920.

## Steps in Play Console
1. Open Play Console, pick **Drop 2048: Number Block Merge**.
2. Left menu: **Grow users > Store presence > Store listings**, then open the **Default store listing** (English).
3. **App name**: leave as is (`Drop 2048: Number Block Merge`).
4. **Short description**: replace with exactly
   `Drop number blocks, merge equal pairs and chains, reach 2048. Calm, no timer.`
5. **Full description**: replace with the text inside the grey box under "Full description" in `store/listing.md` (from "Drop a number block, watch it merge, and chase 2048." to "...we read every message."). Copy only the text, not the ``` lines.
6. **Phone screenshots**: remove the old ones, upload the 6 new PNGs **in the order 01 to 06** (Play shows the first 2-3 in search results).
7. **App icon and feature graphic**: leave as they are this round.
8. Click **Save**. Then go to **Publishing overview** and send the changes for review together with the 1.2.0 release (if "Managed publishing" is on, click "Send changes for review" / "Publish" there; otherwise they go out after Google's review on their own).

## After it goes live
- Reply "Done" on the approval in HQ. Zara then checks the public Play page looks right and notes the date, so we can compare store visitors before and after in a couple of weeks.
- Arabic and Hindi versions come next (same screenshots, translated captions), again for your approval.
