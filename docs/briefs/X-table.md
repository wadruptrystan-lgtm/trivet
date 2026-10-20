# Agent X: trophy hooks at the table

- You: `X`. Owned files: `src/table.js` (a carefully reviewed match controller; edit surgically) and `src/tablex.css` (prefix `tx`).
- Read `briefs/trophies.md` and `briefs/common.md`, all of `src/trophy.js` (the catalogue and API stubs), all of `table.js`, and the parts of `engine.js` you rely on (`applyAction` events: `play`, `scoop` {pid, tray, chips, points, double, sprung, full}, `boil`, `handEnd` {summary}; `ranking`; `moveOutcome`; `trayHeat`).
- Agent T implements the trophy API at the same time. In your copy it's stubs, so `trEarn` returns false and nothing shows; test your hooks by wrapping the stubs (for example in `page.evaluate`: `window.__tr = []; trEarn = id => { __tr.push(id); return true; }` works because they are global function declarations) and checking which ids fire.
- Do not break anything that works: the turn loop and `M.gen` checks, drag and keyboard play, focus to the hand, timers, tutorial, hand summaries, `commitResult` booking the match the moment it ends, the recap, leaving mid-animation, stats hooks, emotes, Peek and Swap.

## What to award (ids from the catalogue)
Use the engine's events and the state you already track (`txStats` sees `prev`, `next` and every event; `M.fedBy` / `T.fed` know who fed each tray last). "Win" = finishing first (`place === 1`, shared allowed) unless stated. No trophies in the tutorial except `lesson`.
- **As it happens** (call `trEarn` at the moment, so the banner shows mid-match):
  - `double`: you scoop with `ev.double`.
  - `spoiler`: your 3rd boil-over in this match. `trapper`: your 3rd sprung scoop in this match.
  - `steam`: your 3rd boil-over within one hand.
  - `generous`: a rival scoops 6 or more points from a tray you fed last.
  - `turnabout`: you scoop a tray that Sol fed last (the last feeder before your chip).
  - `nerve`: at the Glasshouse you scoop by your own move (not the timeout) with `M.timeLeft` ≤ 2.
  - `cheers`: you send the 👍 emote (`nice`) within 8 seconds after Mabel showed 🍵 (either her reply or one she sent on her own).
  - `bookends`: once you have scooped trays containing 1,2,3 and containing 6,7,8 in the same match.
  - For every scoop of yours, call `trNoteSet(v)` for each number v that appears 3+ times in `ev.chips` (Every Number, Lucky Sevens).
  - `lastchip`: as today (`M.flags.lastchip`), but award it when it happens.
- **When the match is booked** (`commitResult`, once; not for abandoned matches):
  - `sweep`, `comeback`, `glassact`: today's rules (keep them exactly).
  - `cool`: win with zero feeds at heat ≥ .30 this match and at least 3 feeds (use the same heat measure as `txStats`).
  - `untouch`: win at a table of 3 or 4 players with no rival scooping a tray you fed last, all match.
  - `whitewash`: win and every rival has 0 scoops.
  - `pressure`: win at the Glasshouse and the timer never ran out on you this match.
  - `headtable`: win at the Supper Club with Sol's place the worst place at the table.
  - `photo`: you are sole first (`shared === 1`) and some rival has the same score.
  - `nowaste`: no player boiled over a tray all match.
  - `nightowl`: the local hour at commit is 0–3.
  - For each rival you finished strictly ahead of, `trNoteBeat(personality)`.
- `lesson`: when the last lesson is completed (both the first-run path that seats you with Rico and the replay path), not when it is skipped.
- `brag`: when the Daily Tray result is copied from the results screen (the copy button). Agent K handles the lobby's copy button.
- Remove the old `award()` / `ACHIEVEMENTS` use from `commitResult` (trophies replace it; the `got` field of `M.result` can go, and so can the old achievement rows on the results screen). Do not delete `ACHIEVEMENTS` from core.js (K's file); just stop using it.
- Per-match counters live on `M.tx` (reset in `txReset`/`startMatch`), and every timer or delayed callback respects `M.gen` so nothing fires after you leave.

## Results screen
- In `startMatch` (not the tutorial), store `M.trMark = trMark()`. In `commitResult`, after the awards, store `M.result.trophies = trSince(M.trMark)` (this includes state trophies that `save()` awarded during the match, such as Commis).
- In `showResult`, insert `trResultCard(M.result.trophies)` (null means nothing) below the XP / Unlocked cards, then call `trAfterResult()` once the results screen is showing.
- The rest of the results screen (prize, XP card, season line, Unlocked card with level-ups, venue tray and rank-up) stays.

## Tests
- Make your copy (`rm -rf WORK/X && cp -r MAIN WORK/X`).
- Play full automated matches at every venue and the Daily Tray (adapt smoke.js's policy) with `trEarn`/`trNoteSet`/`trNoteBeat` wrapped to record calls. Force rarer cases with `page.evaluate` by building states (for example a tray of 5·5·6·7 and a 5 in your hand for `double`; a Glasshouse turn with `M.timeLeft = 2` for `nerve`; Mabel's emote via `txRivalEmote` with a stubbed `pick` for `cheers`).
- Check every id above fires exactly when its rule says and not otherwise (including: not in the tutorial; not after leaving; not twice per match), that the results card slot and `trAfterResult` are called, and that the stats buckets and regression scripts are unchanged. Zero console errors.
- Copy back only `src/table.js` and `src/tablex.css` to `MAIN/src/`.
