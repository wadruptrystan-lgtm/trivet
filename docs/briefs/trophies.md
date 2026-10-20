# trivet trophies: shared brief

We are replacing trivet's 8 achievements with a **Trophy Cabinet**: medals in bronze, silver, gold and platinum, inspired by the "earn everything for the platinum" idea from console games. It has trivet's own look; never name or imitate any console, store or other app.

Read `MAIN/briefs/common.md` first. Its architecture, shared API, design language, hard constraints (360×640 to 430×932, accessibility, sheets, mock payments) and testing rules all still apply. The "What this is" section there describes the earlier meta-layer project; this brief is the current task.

MAIN = `/tmp/claude-0/-home-user/10b390a1-4a83-59ab-9551-fcf694b3e2ca/scratchpad/trivet`, WORK = `/tmp/claude-0/-home-user/10b390a1-4a83-59ab-9551-fcf694b3e2ca/scratchpad/work`.
Build order is now: JS core, economy, table, shop, arcade, season, profile, **trophy**, meta; CSS adds **trophy.css** last.

## The catalogue (already in MAIN)
`src/trophy.js` holds the final catalogue: `TR_TIERS`, `TR_SHELVES`, `TR_PLAT_SET`, `TR0()`, `TROPHIES`, `TR_BASE`, `TR_OLD_SPARKS`, plus stub API functions. Read the whole file.
- 68 entries: 61 base trophies (28 bronze, 23 silver, 10 gold) on 7 shelves, the Platinum Trivet (`plat`), and 6 gold "Beyond Platinum" trophies on the `encore` shelf, which never count toward the Platinum.
- Ids, names, tiers, shelves and rules are decided. Do not rename or drop any. Wording fixes are fine if a rule as written is wrong or unclear; report them.
- `kind: 'state'` trophies have `ok()` (and often `prog()` → `[have, need]`). `trAuto()` awards them whenever they become true.
- `kind: 'event'` trophies are awarded by `trEarn(id)` from the code that sees the event.
- `hidden: true` (the Secrets shelf): show as "Secret trophy" until earned; the `hint` can be revealed on request.
- `title`: gold, Beyond Platinum and Platinum trophies unlock a title the player can show under their name.

Already wired in MAIN (do not redo): `DEFAULT()` has `troph: TR0()`; `load()` gives old saves `S.troph` with `v: 0`; `save()` calls `trAuto()` before writing; `boot()` calls `trInit()` after `go('home')`. `S.ach` stays the map of earned trophy ids → `dayKey()`; the 8 old achievement ids (first, full, spoiler, trapper, comeback, sweep, lastchip, glassact) are reused as trophy ids.

## Rewards (by tier, `TR_TIERS`)
- Bronze: 1,000 Sparks + 10 Gems. Silver: 5,000 Sparks + 30 Gems + 3 boosters (Peeks, Swaps or Spins; rotate by the trophy's position among silver trophies). Gold: 20,000 Sparks + 100 Gems + a Silver Chest + its title. Platinum: 100,000 Sparks + 1,000 Gems + 3 Golden Chests + `TR_PLAT_SET` (Platinum glaze, Champion avatar) + platinum avatar ring + title.
- **Sparks are multiplied by `bankRank().mult` at the moment of earning** (×1 to ×500), like Kiln payouts.
- Finishing every trophy on a shelf also grants that shelf's `item` (once), as part of the last trophy's rewards.
- Rewards are applied the moment a trophy is earned (with `applyReward`, then saved), so leaving or reloading never loses them. The received list (`got`) is stored per trophy so the reveal can be replayed.
- Cabinet points: bronze 10, silver 25, gold 75 (encore too), platinum 250. Cabinet level = 1 + floor(points / 100).

## When and how trophies appear
- **During a match**: a slim banner slides down from the top of `#app` for about 3s ("Trophy unlocked", medal, name; hidden ones say "Secret trophy found"). It never blocks taps (`pointer-events:none`), never pauses play or steals focus, and is announced politely (live region). Several in a row queue.
- **Results screen**: a "Trophies" card lists every trophy earned during that match (medal, name, tier) with a "See rewards" button that replays the reveal (`revealGot`) of everything those trophies gave.
- **Outside matches** (buying an avatar, the wheel, the Kiln settling, a level-up from a season claim): the same banner.
- **Platinum**: no banner. A full-screen ceremony (platinum trivet medal, fanfare, a short line, one button) then the rewards reveal. If earned during a match it waits for the results screen (`trAfterResult()`); otherwise it plays as soon as no overlay is open.
- **First open after the update** (a `v: 0` save): carry the old achievements over, pay each one the difference between its new tier reward and the Sparks it already paid (`TR_OLD_SPARKS`), give `lesson` if `S.tutorialDone`, award every state trophy already met, then show one welcome sheet ("Meet the Trophy Cabinet", how many carried over and unlocked, buttons "See rewards" and "Open the cabinet"). No banner flood.

## Fairness rules (keep them true)
- No trophy needs a real-money (mock) purchase, trivet+, the premium season pass or watching ads.
- No trophy is pure luck (the reels already guarantee a triple by the 5th pull; the wheel trophy only counts spins).
- Nothing is awarded in the tutorial except `lesson`, when the lesson is completed (not skipped).

## Medal look
Medals are small round **trivets** (a disc with three short feet below, like the app's trivet logo) in the tier colour from `TR_TIERS`, not cups. Locked medals are dim. Platinum has a cool sheen.

## API ownership
| Name | Purpose | Implemented by | Called by |
|---|---|---|---|
| `trInit()` | migrate, retro-award, welcome sheet, enable `trAuto` | T | boot (done) |
| `trAuto()` | award met state trophies, shelf items and the Platinum; no-op before `trInit()`; never recurses | T | `save()` (done) |
| `trEarn(id)` → bool | award an event trophy once | T | X, K |
| `trCount(k, n)` | bump `S.troph.c[k]` (`wheel`, `chests`) | T | K |
| `trNoteSet(v)` | record a scooped set of v (`S.troph.sets` bit v) | T | X |
| `trNoteBeat(p)` | record finishing strictly ahead of rival personality p (`S.troph.beat`) | T | X |
| `trMark()`, `trSince(mark)` | trophies earned since a marker | T | X |
| `trResultCard(list)` → element or null | the results "Trophies" card | T | X |
| `trAfterResult()` | play a pending Platinum ceremony | T | X |
| `trOpenCabinet()` | push the Trophies screen | T | K (profile) |
| `trSummary()` | `{earned, total, tiers:{bronze:[got,total],…}, points, level, next, plat, fresh}` (`fresh` = earned but not yet seen in the cabinet) | T | K |
| `trTitle()` | the chosen title text or '' | T | K |
| `trHasPlat()` | Platinum earned | T | K (avatar ring) |
| `trItemSource(cat, id)` | how a trophy-only item unlocks, e.g. "Finish the At the Table trophies" or "Earn the Platinum Trivet" | T | K |

Agents T, X and K work at the same time. Code against these names exactly; the stubs keep every copy building. If you need something another agent owns, put the exact request in `integrationRequests`.

## Trophy-only items (agent K adds them)
- Cosmetics with `how: 'trophy'`: tray `kintsugi` "Kintsugi" (dark tray mended with gold seams), table `lantern` "Lantern Night", glaze `raku` "Raku" (crackled, smoky), glaze `platinum` "Platinum" (cool metallic rim and sheen).
- Avatars: `rooster` 🐓 "Rooster", `peacock` 🦚 "Peacock", `champion` 🏆 "Champion". Emotes: `hooray` 🙌 "Hooray", `foundit` 🗝️ "Found it".
- Never sold, never in chests, boxes, the wheel or the season pass; lock text comes from `trItemSource()`.

## Testing (everyone)
Follow the testing rules in common.md. Tests write output to files and have a watchdog that calls `process.exit` (piping through `tail` loses output). In `page.evaluate`, never return the promise from `revealRewards`/`revealGot` (it only resolves after taps). Regression scripts in MAIN root: `smoke.js`, `reg.js`, `reg2.js`, `reg3.js`, `found.js`; run them from your copy's root (`cd WORK/<you> && node smoke.js`) and they must still pass with no console errors.
