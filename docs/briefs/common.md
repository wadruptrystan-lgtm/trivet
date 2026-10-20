# trivet: shared brief for every feature agent

## What this is
**trivet** is a single-file HTML mobile game. You play **Scoop**, an original tile game, against AI rivals. The game is built and working. We are now adding the meta layer of a polished free-to-play card app:
- a shop with chests, gems and boosters
- a prize wheel and a reels machine
- a monthly season pass
- avatars and emotes
- bankroll ranks
- a playstyle profile with detailed stats

The game has its own identity: a dark aubergine theme, warm "heat" accents, and ceramics and kitchen names. Never name or mention any other app, brand, poker or blackjack.

Product vocabulary:
- **trivet**: the app.
- **trivet+**: the premium subscription.
- Currencies: **Sparks** (bankroll), **Gems** (premium), **Swaps**, **Peeks** and **Spins** (boosters).
- **the Kiln**: the weekly league.
- **Scoop**: the game.

### Scoop in brief
- Chips are numbered 1–8. There are 3 trays on the table, and each player holds 3 chips.
- On your turn you drop one chip into a tray.
  - If the tray then holds a **trio** (a set like 7·7·7 or a run like 4·5·6, with no wrap-around), you **scoop** the whole tray and score 1 point per chip.
  - A 6th chip without a trio **boils over** the tray, and nobody scores it.
- Every other move is a **feed**. Feeding a tray can set up the next player.
- **Heat** is the chance that a rival can finish a tray before your next turn.
- A match is 3 hands. Venues: Corner Café, Noodle Bar, Tea House, Supper Club and Glasshouse. There is also a free Daily Tray against June.

## Paths
- MAIN = `/tmp/claude-0/-home-user/10b390a1-4a83-59ab-9551-fcf694b3e2ca/scratchpad/trivet` (the shared project; read-only for you except your owned files at the very end)
- WORK = `/tmp/claude-0/-home-user/10b390a1-4a83-59ab-9551-fcf694b3e2ca/scratchpad/work`

## Workspace rules (several agents run at the same time)
1. Make your own copy first: `rm -rf WORK/<you> && mkdir -p WORK && cp -r MAIN WORK/<you>`, where `<you>` is the letter in your brief. Do all edits, builds and tests inside that copy.
2. Edit only the files your brief says you own. If you need something changed in a shared file, write the exact change in your final report under `integrationRequests` and do not change the file yourself. Shared files are core.js, economy.js, meta.js, table.js (unless you own it), style.css, economy.css, body.html and build.py.
3. Build: `cd WORK/<you> && python3 build.py && node --check dist/app.js`. Test page: `WORK/<you>/dist/test.html`.
4. When finished and tested, copy **only your owned files** into `MAIN/src/` (for example `cp WORK/A/src/shop.js WORK/A/src/shop.css MAIN/src/`). Never write anything else in MAIN.

## Architecture
- `build.py` concatenates the CSS files and the JS files, in the order listed in build.py, into one page.
  - JS order: core, economy, table, shop, arcade, season, profile, meta.
  - The code runs as one classic `'use strict'` script, so everything is global (no modules). Function declarations hoist; top-level `const`s are available at runtime.
- In other modules, the stub versions of public functions are placeholders. Code against the names in the briefs. Every public name listed in a brief exists (at least as a stub) in MAIN now.
- Read before you start:
  - `src/economy.js`: read all of it. It is the shared API.
  - `src/core.js`: h() builder, `$`, `$$`, fmt, icon()/IC, sheet()/closeSheet(), toast(), go(), the `S` state, save(), COSMETICS, chipEl().
  - `src/meta.js`: renderHome, topBar, homeFloat, goShop, UIH, collectionView, settingsSheet.
  - `src/style.css` and `src/economy.css`: tokens and the components you can reuse.
    - Reusable classes: `.btn .cta .ghost .wide .btnrow .card .eyebrow .sec .pagetitle .seg .tiles .tile .facts .setrow .switch .iconbtn .how .smallbtn`.
    - Tokens: `--bg --surface --surface-2 --line --text --muted --faint --cta --cta-ink --heat-warm --heat-hot --f-num --f-ui`.
  - `src/engine.js` (global `Scoop`), only if your task touches gameplay or stats.
- Reference screenshots of the kind of meta UI we want (structure only; do not copy names, branding or artwork) are in `/tmp/claude-0/-home-user/10b390a1-4a83-59ab-9551-fcf694b3e2ca/scratchpad/video/detail_sheet.jpg` and `sheet01.jpg`–`sheet07.jpg`. Ignore the "clideo.com" watermark.

### Shared API (economy.js; signatures must not change)
**Wallet**
- `bal(k)`, `gain(k, n)`, `spend(k, n) -> bool`. k is one of sparks, gems, swaps, peeks, spins.
- `amountText(k, n)` gives "1,200 Gems".
- `curIcon(k, size)` returns SVG markup. k is a currency, or `chest-wooden|silver|golden`, or `box-<rarity>`.
- `curPill(k, {onClick, action})` returns a balance pill. `updatePills()` keeps all pills current.

**Rewards**
- Reward objects:
  - `{type: currency, n}`
  - `{type: 'item', cat, id}`, where cat is glaze, num, tray, table, sound, avatar or emote
  - `{type: 'chest', id}`
  - `{type: 'box', rarity}`
- `applyReward(r) -> got`. A duplicate item becomes Gems.
- `revealRewards(list, {title, skipIntro, eyebrow}) -> Promise` applies every reward first, saves, then plays the full-screen reveal.
- `revealGot(gotList, o)` plays the reveal for rewards already applied.
- `rewardName(r)`, `rewardRarity(r)`, `rewardIconEl(r, size)`.
- `RARITY`, `RARITY_ORDER`, `rarTag(rarity)`.
- `CHESTS`, `openChest(id)` (spends Gems, then reveals), `rollBox(rarity)`, `rollItem(rarity)`.

**Catalog**
- `AVATARS` ({id, e, cat, price (Gems, or null for chest/season only), rarity, bg}), `AVATAR_CATS`, `avatarEl(id, size)`, `myAvatarEl(size)`, `RIVAL_AVA`, `rivalAvaEl(personality, size)`.
- `EMOTES` ({id, e, name, price, rarity}), `emoteOf(id)`, `S.emoteSet` (the 6 emote ids shown at the table).
- `anyItem(cat, id)`, `CAT_ONE[cat]` (singular label), `owns(cat, id)`, `grant(cat, id)`.

**Store mocks**
- `mockPurchase({title, price, sub, iconEl, onSuccess})` is the ONLY way to show a real-money price being bought. It is a simulated checkout: no payment fields ever, and it clearly says nothing is charged.
- `mockAd(onReward, {label})` is a 5-second placeholder. `adState()`, `adsLeft()`, `ADS_PER_DAY`.
- `plusActive()` reports whether trivet+ is active. Its state is `S.plus = {until, lastDay}`.

**Screens and focus**
- `pushScreen(title, build(box, api), {right: () => el, help: () => void, cls, refresh: () => void, onClose})` opens a full-screen sub-page with a back button. `popScreen()`, `topScreen()`, `refresh()`.
- `refresh()` re-renders the current lobby tab or sub-screen. A screen can pass `o.refresh` to update itself in place instead (keeps animations alive).
- `captureFocus()`, `restoreFocus(fi)`, `rebuildViews(box, fill)`.

**Ranks**
- `BANK_RANKS` ({id, name, min, col, mult}).
- `bankRank()` returns {...rank, i, best, next, prog}. Rank follows `max(S.sparks, S.bankPeak)`.
- `rankBadge(i, size)`.

**Season**
- `SEASON` {tiers: 40, xpPerTier: 150}, `seasonId()`, `ensureSeason()` (gives S.season {id, xp, premium, claimedFree[], claimedPrem[]}), `seasonTier()`, `seasonEndsAt()`, `durText(ms)`.
- addXP() in core already adds all match XP to `S.season.xp`.

**Stats**
- `statBucket(mode)`, `bumpStats(mode, fn)`, `STAT_MODES`, `STAT0()`. Field meanings are in the comment above STAT0.

**Other state**
- `S.wallet`, `S.profile {name, avatar}`, `S.arcade {wheelFreeDay, wheelPity, reelsPity, reelsClaimAt}`, `S.ads`.
- Lobby: `UIH.tab`, `UIH.shopJump`, `goShop(section)`, `homeFloat(el)`, `setTab(t)`.

## Design language
- Calm, premium, mobile. Dark surfaces (`--surface`, `--surface-2`, radius 18–30px) with no hard borders.
- Typefaces: Fraunces with `font-variation-settings:"SOFT" 100` for big numerals and titles; Manrope for UI text.
- Accents: warm CTA `--cta` (#FFB37A). Rarity colours come from `RARITY[r].col`. Pastels come from `AVA_BG` (#FFD9C2 #FFE7A8 #CDEBD6 #CFE0FA #E3D3F7 #FFD3DE #F3E6D3 #CDEFEA); on pastel cards use dark ink #251C2B.
- Always show currencies with `curIcon()`. Emoji are fine as illustration (Noto Color Emoji is installed in the test browser).
- Amounts use `fmt()`. Compact amounts ("150K", "1M") are fine on tiles if the aria-label has the full number.

## Hard constraints
- Must work from **360×640** up to **430×932** (on desktop the app is a 402-wide device frame). No horizontal page scroll. The `.views` container already gives a 16px gutter. Touch targets are at least 40px. `#app` is a size container, so `cqw`/`cqh` work.
- Accessibility:
  - Use real `<button>`s. Icon-only buttons need an aria-label.
  - Informative graphics get `role="img"` plus an aria-label; decorative ones get `aria-hidden`.
  - Put `data-fk="unique-key"` on every interactive control in a view that re-renders, so focus is restored.
  - Move focus sensibly after actions. Announce results through `toast()` (it is a live region).
  - Respect reduced motion. Check `reduced()` in JS for any animation you wait on. Put CSS animations inside `@media (prefers-reduced-motion:no-preference)`; `.rm` on `<html>` and `#app` also neutralises them.
- Sheets:
  - Use `sheet((panel, close) => {...}, {label})`. The first `h3` becomes the dialog title.
  - Put the buttons in a `.btnrow` as the panel's last child (it becomes a sticky footer).
  - Never open a sheet from inside a sheet: `close()`, then open the next one after about 300ms.
- State and APIs:
  - Mutate `S`, then `save()`. Never touch localStorage directly.
  - No `alert`, `confirm` or `prompt`. No network calls, no new external assets or libraries.
  - `Math.random` and `Date.now` are fine.
- Every real-money price is a mock (GBP, £0.99–£99.99) and goes through `mockPurchase()`. Ads go only through `mockAd()`.
- Naming:
  - Prefix all your CSS classes with your prefix. Never restyle global classes; extend them by combining with your own class.
  - Prefix your top-level helper names with your prefix too.
  - Public names in your brief must match exactly.
- Code style: match the existing code. It is compact, uses the `h()` builder, and has short comments only where they explain intent. No frameworks.

## Testing (required)
- Use Playwright: `const { chromium } = require('/opt/node-tools/node_modules/playwright'); const b = await chromium.launch();`. Never run `playwright install`. Load `file://WORK/<you>/dist/test.html`.
- `S` and every function are globals. Set up state with `page.evaluate` (for example `S.wallet.gems = 500; save(); refresh();`).
- Exercise every flow you built:
  - Take screenshots at 390×844 and 360×640, and **look at them** with the Read tool. Fix anything cramped, clipped, overlapping or ugly.
  - Collect `pageerror` and console errors and warnings; there must be none.
  - Check `document.body.innerText` has no "null", "undefined" or "NaN".
  - Check no horizontal overflow: `#views` and `#sub-views` must satisfy `scrollWidth <= clientWidth`.
  - Check keyboard focus after each action (`document.activeElement`).
- Keep your test script in your WORK copy.

## Final report
Return the structured result:
- the files you copied to MAIN
- the public functions you provide
- what you tested and how
- known issues
- `integrationRequests`: precise changes you need in shared files, with file, the code and the reason
