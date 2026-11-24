# Drop 2048: show the next block ("Next" preview)

Owner: Lena (design). Builder: Arjun. Backlog: d-next-preview. Ship after 1.2.0.

## Why
Drop-merge games show the next block so players can plan a move ahead. Drop 2048 only shows the block in hand. Nora's teardown (docs/research/2026-11-24-x2-blocks.md) found players confused by an unlabelled preview in a similar game, so ours carries a visible "Next" label. This makes the game easier to plan, not harsher: no change to lives, ads or scoring.

## What the player sees
- A small, non-tappable chip centred between the header and the dropper strip: the word **NEXT** (same style as the `Score`/`Best` small caps labels) and a mini tile (about 60% of a board tile, same colours from `PALETTE`).
- The block in hand stays where it is today (`#active-block` in the dropper strip).
- When a block is dropped, the Next tile slides/fades into the hand slot (150-200 ms) and a new Next value appears.
- At 360x740 there is room: the gap between the header and the board is about 130 px today (checked in screenshots, 24 Nov).

## Rules
1. Keep a two-value queue: `currentValue` (in hand) and `nextValue` (preview).
2. On drop: `currentValue = nextValue; nextValue = roll()`.
3. `roll()` uses today's rule unchanged (values 2-64, capped at max(16, biggest tile / 2)), but evaluated when the value is rolled, i.e. one drop early. That is fine: the cap only grows.
4. New game / "Use 1 Life & Restart": roll both values fresh.
5. "Watch Ad (Clear 2 Rows)" keeps both values (the player already planned around them).
6. Pause/resume and app background keep both values.
7. The chip has `pointer-events: none` so a tap near it can never drop a block, and `aria-label="Next block: N"`.

## Not in scope
- No swap/hold button, no paid preview, no extra preview slots.
- No change to the rules card except one line: "The NEXT tile shows the block after this one."

## Done when (Lena checks)
- 360x740 and 412x915: chip visible, not overlapping the header, the dropper strip or the toast; no horizontal scroll.
- 50 scripted drops: every dropped value equals the Next value shown before the previous drop.
- Restart, last life, Clear 2 Rows and pause behave as in Rules 4-6.
- Balance sim (300 games, same bot as the 24 Nov health check, now allowed to see Next) still has no early dead ends; median drops are expected to go up a little.
