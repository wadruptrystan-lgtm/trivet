# Agent T: the trophy engine and the Trophy Cabinet

- You: `T`. Owned files: `src/trophy.js` (keep the catalogue; replace the stub API with the real thing) and `src/trophy.css` (prefix every class `tr-`; top-level helpers `tr…`).
- Read `briefs/trophies.md` (the spec) and `briefs/common.md` first, then all of `economy.js` (reward, reveal, overlay, screen and focus APIs) and the parts of `profile.js` / `profile.css` / `season.js` that build similar screens, so the cabinet looks like it belongs.
- Agents X (table) and K (everything else) run at the same time and call your API. Keep every name and signature in the stub exactly.

## 1. Engine
- **State**: `S.troph` (see `TR0()`), `S.ach[id] = dayKey()`.
- **Awarding** (one internal function used by `trEarn`, `trAuto`, migration):
  - skip if already earned or the id is unknown; record `S.ach[id]`;
  - build the reward list from `TR_TIERS` (Sparks × `bankRank().mult`, rounded; silver booster by rotation; gold Silver Chest; platinum 3 Golden Chests and `TR_PLAT_SET` items via `grant()`), apply each with `applyReward`, store the received list in `S.troph.got[id]`;
  - then check that trophy's shelf: if every trophy on it is earned and `S.troph.shelf[shelf]` is unset, grant the shelf item and append it to the same `got` list;
  - push `{id, got}` onto an in-memory log (for `trMark`/`trSince`); queue the banner (or, for `plat`, the ceremony); `updatePills()`; `save()` unless you are already inside `trAuto`.
- **`trAuto()`**: a no-op until `trInit()` has run (boot calls `save()` earlier) and while it is already running. Loop: award every unearned `state` trophy whose `ok()` is true, then `plat` when all of `TR_BASE` is earned; repeat until nothing new (a Sparks reward can lift the bankroll rank). It runs on every `save()`, so keep it cheap (no DOM work beyond queuing banners) and make sure a thrown error inside a check can never stop `save()` from writing.
- **`trEarn(id)`**: only for `event` trophies; returns true the first time. Must be safe to call from anywhere, including mid-animation at the table.
- `trCount(k, n=1)`, `trNoteSet(v)` (bit v of `S.troph.sets`, v 1–8), `trNoteBeat(p)` (add the personality key once): mutate, then let the next `save()` pick up the trophies (call `save()` yourself only if the caller wouldn't).
- **Migration in `trInit()`** for `S.troph.v === 0`: as in the spec. Top-up for a carried-over achievement = its tier reward with Sparks reduced by `TR_OLD_SPARKS[id]` (never negative); gold carry-overs also get their chest and title. Then retro-award states (and `lesson` when `S.tutorialDone`), set `v: 1`, save, and show the single welcome sheet (skip the sheet if nothing carried over or unlocked). A brand-new player (v 1 from `DEFAULT`) gets no sheet. Trophies earned during migration must not each raise a banner.

## 2. Banner
- One live-region element (`role="status"`, polite) appended to `#app`, above screens and sheets but never intercepting pointer events; it must not move focus. Medal + "Trophy unlocked" (or "Secret trophy found") + name, ~3s, queued. Respect reduced motion (`reduced()`; CSS animations inside `@media (prefers-reduced-motion:no-preference)`). It must look right over the table at 360×640 (it may cover the table's top bar briefly; nothing underneath may become untappable).
- A short sound: `SND.tick()`-style for bronze/silver, `SND.fanfare()` for gold.

## 3. Results card and the Platinum ceremony
- `trResultCard(list)`: a `.card` titled "Trophies" ("1 trophy unlocked" / "3 trophies unlocked"), one row per trophy (medal, name, tier word), and a "See rewards" button that calls `revealGot()` with all their `got` lists merged (title "Trophy rewards"). Return null for an empty list. It sits on the results screen under the XP/Unlocked cards; match their spacing.
- `trAfterResult()`: if a Platinum ceremony is pending, play it now.
- **Ceremony**: use the economy overlay helpers (`openOverlay`/`closeOverlay`, as the reveal does) so screens go inert and focus is trapped. A large platinum trivet medal arrives (animated only without reduced motion), "Platinum Trivet", a one-line message, and one button ("See your rewards") that closes it and plays the reveal of the platinum `got`. Escape does the same. `SND.fanfare()`.

## 4. The Trophies screen (`trOpenCabinet()`)
`pushScreen('Trophies', build, { refresh })`, re-rendering through `rebuildViews` with `data-fk` on every control.
- **Header card**: the Platinum medal (dim until earned) with a progress ring "41 of 61" and "67% to the Platinum Trivet" (or "Platinum Trivet earned" with date); a row of tier counts (mini medals: bronze 12/28, silver 4/23, gold 1/10); cabinet level with a thin bar to the next level; **Title** row ("Title: Head Chef" or "Title: none") that opens a sheet to choose from earned titles or None (store the trophy id in `S.troph.title`, save, refresh).
- **Almost there**: up to 3 unearned, non-hidden trophies with `prog()` and the highest have/need ratio above 0.
- **Filter**: segmented All / To do / Earned (remember the choice for this visit).
- **Shelves** in `TR_SHELVES` order, then Beyond Platinum last with a note that it doesn't count toward the Platinum. Each shelf: heading with "7 of 13", a line for its shelf item ("Finish the shelf: Kintsugi tray" with a small preview, or "Kintsugi tray unlocked"), then a row per trophy: medal, name, rule text, progress bar with "212 / 250" when it has `prog()` and isn't earned, reward preview (Sparks and Gems amounts with `curIcon`, using the current rank multiplier) or "Earned 12 Oct". New since last visit: a small "New" tag; mark them seen when the screen is shown (`S.troph.seen`).
- **Hidden** unearned: name "Secret trophy", text "Keep playing to find it.", medal shows a "?"; its detail sheet has a "Show hint" button that reveals the hint in place.
- **Detail sheet** on tapping a row: big medal, tier and shelf, name, rule (or hint for hidden), progress, rewards (expected, or what was actually received from `S.troph.got[id]`), date earned, and "Replay rewards" for earned ones (close the sheet first, then reveal).
- Rows are buttons with full aria-labels (name, tier, earned/locked, progress). Progress bars have text equivalents. Everything fits at 360px with no horizontal scroll.

## 5. Small API pieces
`trSummary()`, `trTitle()`, `trHasPlat()`, `trItemSource(cat, id)` as described in the spec table. Also style `.ava.tr-plat` (agent K adds that class to your own avatar when `trHasPlat()`): a thin platinum ring that works at 34–112px and doesn't change layout size.

## Testing
- Make your copy (`rm -rf WORK/T && cp -r MAIN WORK/T`). X's and K's hooks won't be in your copy, so drive everything with `page.evaluate`: set stats, call `trEarn`, `trCount`, `trNoteSet`, `save()`, etc.
- Verify: every state trophy awards exactly once when its condition is met and never twice (call `save()` repeatedly); rewards match the tier table including the rank multiplier; shelf items and the Platinum fire exactly when due (earn all 61 programmatically); encore trophies don't affect the Platinum; migration from a realistic v 0 save (old `S.ach` with a few ids, stats, `tutorialDone`) gives the right top-ups once and shows one sheet; reload mid-reveal loses nothing; `trAuto` before `trInit` does nothing; no recursion or console errors.
- Screens: screenshots of the cabinet (empty, partly earned with hidden ones, all earned), a detail sheet, the title sheet, the banner over the table and over the lobby, the results card, the ceremony, at 390×844 and 360×640. Look at them and fix what's cramped or ugly. Keyboard: tab through the cabinet, open/close sheets, focus returns sensibly.
- Run the regression scripts in your copy at the end.
- Copy back only `src/trophy.js` and `src/trophy.css` to `MAIN/src/` when done.
