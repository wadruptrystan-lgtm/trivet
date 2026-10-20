# Agent K: trophy-only items and the hooks outside the table

- You: `K`. Owned files: `src/core.js`, `src/economy.js`, `src/economy.css`, `src/style.css`, `src/meta.js`, `src/profile.js`, `src/profile.css`, `src/arcade.js`, `src/shop.js`, `src/season.js`, `src/body.html`. Not yours: `trophy.js`/`trophy.css` (agent T) and `table.js`/`tablex.css` (agent X).
- Read `briefs/trophies.md`, `briefs/common.md` and all of `src/trophy.js` (catalogue and API stubs) first. In your copy the API is stubs; code against the names exactly.
- Already done in MAIN: `troph` in `DEFAULT()`/`load()`, `trAuto()` in `save()`, `trInit()` in `boot()`. Keep them.
- Do not delete the `ACHIEVEMENTS` constant from core.js yet (table.js in your copy still uses it); the integrator removes it.

## 1. Trophy-only items
- **Cosmetics** (`COSMETICS` in core.js), each with `how: 'trophy'`:
  - glaze `raku` "Raku": crackled, smoky raku-fired chips; glaze `platinum` "Platinum": a cool metallic rim and soft sheen (the Platinum reward).
  - tray `kintsugi` "Kintsugi": a dark tray mended with thin gold seams.
  - table `lantern` "Lantern Night": warm lantern glow on the table.
  - Build their looks in `style.css` the same way the existing `.glaze-*`, `.tray-*` and `.table-*` classes work (they apply to `#app`, the Style preview and the mini previews). Chip numbers and heat colours must stay readable on each. CSS only, no images.
- **Avatars** (`AVATARS`): `rooster` 🐓 "Rooster", `peacock` 🦚 "Peacock" (legendary), `champion` 🏆 "Champion" (mythic). **Emotes** (`EMOTES`): `hooray` 🙌 "Hooray", `foundit` 🗝️ "Found it" (legendary). Mark them as trophy items (a `trophy: true` flag), price null. Give the avatars their own category ("Trophies") in `AVATAR_CATS` so the avatar screen shows them together.
- They are **never** sold, and never come from chests, boxes, the wheel, the reels or the season pass: exclude them in `itemPool()` (like `exclusive`), and check shop.js, arcade.js and season.js for any other list that could include them. `itemRarity` for `how: 'trophy'`: legendary, platinum glaze mythic.
- Lock text everywhere a locked item explains itself: the Style screen (`howText` in meta.js, brief and long forms), the avatar and emote screens (`prfLockText` and friends in profile.js): use `trItemSource(cat, id)` for trophy items. Tapping a locked trophy item shows that text (toast), never a buy sheet. Update the Style screen footnote to mention trophies.

## 2. Hooks
- **Chests**: every chest that is opened, wherever it comes from (`applyReward` with a chest reward in economy.js covers the shop, the season pass and trophy rewards), calls `trCount('chests')`.
- **Prize Wheel**: every spin, free or paid, calls `trCount('wheel')` once the spin is committed (when the result is applied, not when the button is merely pressed).
- **Lucky Reels**: any three-of-a-kind on the payline (natural or the guaranteed one) calls `trEarn('reels3')`.
- **Daily copy in the lobby** (the Daily Tray card's copy button in meta.js): `trEarn('brag')` after copying. (Agent X does the results-screen copy button.)
- **Avatar ring**: `myAvatarEl()` adds the class `tr-plat` when `trHasPlat()` (agent T styles it). Rival avatars never get it.
- **Titles**: show `trTitle()` (when not empty) under your name in the profile header, and as a small second line on your own row in the Kiln standings. Keep both rows' heights tidy at 360px with long names.
- **Profile**: replace the "Achievements" menu row with "Trophies" (🏆): hint like "41 of 61 · 3 new" from `trSummary()`, opening `trOpenCabinet()`. Remove `prfAchScreen` and `PRF_ACH_ICON` and their CSS. In the profile header area add a compact line with the cabinet level and medal counts (for example "Cabinet level 7 · 12 bronze · 4 silver · 1 gold") that fits at 360px; keep the profile's existing look.
- **Reset progress**: the reset sheet's text lists trophies among what resets (they do, since `DEFAULT()` restarts `S.troph` and `S.ach`).
- Make sure nothing else still reads `ACHIEVEMENTS` except table.js (X removes that) and the constant itself.

## Tests
- Make your copy (`rm -rf WORK/K && cp -r MAIN WORK/K`). Wrap the stubs in `page.evaluate` to record calls (`window.__tr = []; trEarn = id => { __tr.push(id); return true; }`, same for `trCount`), and stub `trHasPlat`/`trTitle`/`trSummary`/`trItemSource` returns to test your displays.
- Verify each hook fires exactly once per real event (chests from the shop and the season pass; free and paid wheel spins; natural and guaranteed reel triples; the lobby copy button); trophy items never appear in shop lists or rolls (roll thousands of chests, boxes and wheel spins in `page.evaluate`), can't be bought, and show the right lock text; the four new looks are readable (screenshots of the table with each, and the Style screen at 360×640 and 390×844; look at them); profile header and Kiln row with a long name plus a title at 360px; no console errors; regression scripts still pass.
- Copy back only your owned files that you changed to `MAIN/src/`.
