# Agent A: Shop

- You: `A`. Owned files: `src/shop.js`, `src/shop.css` (replace the stubs). CSS and helper prefix: `shop`.
- Public functions (exact names):
  - `shopView(v)`: fills the Shop tab. meta.js has already appended the top bar (gems pill, sparks pill, gift button) into `v`; append your content after it.
  - `freeRewardsSheet()`: opened by the top-bar gift button.

## shopView(v), top to bottom
1. **Page title** "Shop" (`.pagetitle`).

2. **trivet+ banner card.**
   - Art: a cluster of 4–5 overlapping perk icons, all built with `curIcon` (gems, spins, sparks, `chest-golden`, and a lock or star). Text: "trivet+ · Unlock daily rewards and perks."
   - When inactive, the button "Get trivet+ · £4.99/month" opens a perks sheet. Perks:
     - 50 Gems and 2 Spins to claim every day
     - Daily gift doubled (meta already doubles it when `plusActive()`)
     - a trivet+ badge glow on your Profile avatar (profile agent reads `plusActive()`)

     The sheet's CTA calls `mockPurchase({title: 'trivet+ · 1 month', price: '£4.99 / month', ...})`. On success: `S.plus.until = Date.now() + 30*864e5`, save, refresh, toast.
   - When active, show "Active · N days left · simulated", plus a "Claim today's 50 Gems + 2 Spins" button while `S.plus.lastDay !== dayKey()`. The claim calls `revealRewards([{type:'gems',n:50},{type:'spins',n:2}], {title:'trivet+ daily'})` and sets lastDay. Also add a small "Cancel trivet+" text button; it opens a confirm sheet that sets `S.plus.until = 0`.

3. **Chests** (`data-sec="chests"`).
   - Three tiles (Wooden, Silver, Golden): big `curIcon('chest-…')`, the name, and a Gems price row (gems icon + 50/100/150).
   - Tapping a tile opens a chest sheet:
     - the big icon
     - what's inside, derived from `CHESTS[id]`: Sparks range, number and size of boosters, item chance
     - odds per rarity, using `rarTag`
     - CTA "Open · [gem icon] 150", which calls `openChest(id)`
   - If Gems are short, the CTA reads "Get Gems". It closes the sheet and scrolls to the Gems section.

4. **Sparks bundles** (`data-sec="sparks"`).
   - A 3-column grid of 6 tiles: 10,000 £0.99 · 60,000 £4.99 (tag "Popular") · 150,000 £9.99 · 350,000 £19.99 · 1,000,000 £49.99 (tag "Best value") · 3,000,000 £99.99.
   - Tile face: a pile of sparks icons that grows by tier (1, 2, 3, then larger piles), a compact amount ("150K", "1M"), and the price.
   - The aria-label has the full amount and price.
   - Tapping a tile calls `mockPurchase(...)`. Its onSuccess calls `revealRewards([{type:'sparks', n}], {skipIntro:true, title:'Purchase complete'})`.

5. **Gems bundles** (`data-sec="gems"`): 80 £0.99 · 500 £4.99 · 1,200 £9.99 · 2,500 £19.99 · 6,500 £49.99 · 14,000 £99.99. Same pattern as the Sparks bundles.

6. **Boosters** (`data-sec="boosts"`). These are priced in Gems, so no mockPurchase.
   - Three groups, each with a heading and a "?" help button that opens a short explainer sheet:
     - Swaps: 5 for 25 Gems, 25 for 100, 70 for 250. Help: "Once per hand, trade a chip in your hand for a random chip from the bag."
     - Peeks: same amounts. Help: "Once per hand, see one chip the next rival holds."
     - Spins: 10 for 25 Gems, 50 for 100, 140 for 250. Help: "One pull on Lucky Reels."
   - Peeks and Swaps are off in the Daily Tray and the lesson; say so in the help.
   - Tapping a bundle opens a confirm sheet. Then `spend('gems', price)`, `gain(k, n)`, save, and a toast or `revealRewards(..., {skipIntro:true})`.
   - If Gems are short, offer "Get Gems", which scrolls to the Gems section.

7. **Free** (`data-sec="free"`). Three cards:
   - "Free rewards", showing "N of 5 left today", which opens `freeRewardsSheet()`
   - "Prize Wheel", which calls `openWheel()`
   - "Lucky Reels", which calls `openReels()`

   The last two are provided by the arcade agent. Use `wheelFreeReady()` and `reelsClaimReady()` for "Free spin ready" badges.

8. **Fine print**: "Prototype store: purchases are simulated and nothing is charged."

### Floating buttons
- Each Shop render creates two round floating buttons with `homeFloat(el)`, which puts them in `#home` above the tab bar. meta clears them on every lobby render.
  - Bottom-left: a mini prize-wheel SVG icon (8 coloured wedges and a hub), calling `openWheel()`.
  - Bottom-right: a mini reels-cabinet icon, calling `openReels()`.
- Each shows a red dot when `wheelFreeReady()` or `reelsClaimReady()` is true.
- Place them so they never cover the tab bar and so they stay tappable over content (about 56px, sitting about 100px above the bottom, 14px from the edge).
- Give them aria-labels: "Prize Wheel, free spin ready" or "Prize Wheel".

### Jumping to a section
- `goShop('gems')` sets `UIH.shopJump`. After rendering, if it is set, scroll `[data-sec=…]` to the top of `#views` (in a requestAnimationFrame), move focus to that section's heading (tabIndex -1), then clear `UIH.shopJump`.

## freeRewardsSheet()
- A sheet "Free rewards" with 5 slots for today, in a row or grid. Each slot shows its reward and its state: watched ✓, next, or locked.
- Slot rewards: 1,000 Sparks · 5 Gems · 2 Spins · 1 Peek · "???" mystery.
  - The mystery rolls a box when claimed: common 50%, rare 35%, epic 13%, legendary 2%. It is granted as `{type:'box', rarity}` with an intro reveal.
- Slots unlock in order. The next slot is `adState().watched`.
- The "Watch" button calls `mockAd(() => { …reveal… }, {label})`. mockAd itself increments `watched`. Also record the slot in `adState().got`.
- Show "Resets in Xh Ym" (until local midnight). When all 5 are done, show "All done for today".
- If trivet+ is active and today's claim is pending, show that claim at the top of the sheet too.

## Feel
- Sections use `.sec`-style headings or centred titles in cards.
- Tiles are `--surface` cards with radius 22px, the icon on top, the amount in Fraunces 22–24px, and the price in a `--surface-2` pill.
- Tags ("Popular" / "Best value") are small rarity-style pills in the corner.
- Use gentle press scale on tiles. Keep the page well spaced, with no cramped tiles at 360px.
