# Agent C: Season pass

- You: `C`. Owned files: `src/season.js`, `src/season.css` (replace the stubs). Prefix: `ssn`.
- Public names (exact):
  - `seasonRing()`: returns a button element for the Play tab's top-right corner.
  - `seasonClaimable()`: returns an int, the number of rewards claimable right now.
  - `openSeason()`
- Helpers already in economy.js: `SEASON` {tiers 40, xpPerTier 150}, `seasonId()`, `ensureSeason()`, `seasonTier()`, `seasonEndsAt()`, `durText()`.
- Season XP is all match XP earned this calendar month; core's addXP adds it.
- `S.season = {id:'YYYY-MM', xp, premium, claimedFree:[tier numbers], claimedPrem:[tier numbers]}`. It resets when the month changes.

## Season identity
- A table of 12 monthly seasons, each with a name, an emoji and a pastel colour, themed on glazes, heat and kitchens. Examples:
  - January "Frost Glaze" 🧊 #CFE0FA
  - July "Heatwave" ☀️ #FFE7A8
  - October "Ember" 🍂 #FFD9C2
  - December "Midwinter" ✨ #E3D3F7
- Choose all 12. The current month's season gives the screen title and its colours.

## Track: `SEASON_TRACK`
- A deterministic list of 40 tiers, each with a `free` reward and a `prem` reward, using economy reward objects.
- **Free track**:
  - mostly modest amounts: Sparks rising from about 500 to 5,000; Gems 5–15; 1–3 Swaps, Peeks or Spins
  - a rarity box every 5th tier, rising in rarity (5 common, 10 common, 15 rare, 20 rare, 25 epic, 30 epic, 35 legendary)
  - tier 40: a Golden Chest
- **Premium track**:
  - richer amounts: Gems 15–60, Sparks 2,000–20,000, booster bundles
  - chests (wooden, silver, golden) at regular intervals
  - exclusive items at milestones: tier 10 emote `royal` (legendary), tier 20 avatar `teapot` (legendary), tier 30 emote `boiling` (legendary), tier 40 avatar `crystal` (mythic)
  - a few `box` rewards of epic and legendary rarity
- Tier `t` (1..40) is reached when `seasonTier() >= t`.

## `openSeason()`
Open it with `pushScreen(seasonName, build, {cls:'ssn-screen', right: () => curPill('gems'), help: howSheet})`.

**Hero card** (in the season's pastel colour, dark ink text):
- The emoji art, "Season · October", and the name.
- "Ends in 18d 4h" (`durText(seasonEndsAt() - Date.now())`).
- The current tier as a big number, and a progress bar to the next tier ("90 / 150 XP"). At max tier, say "Max tier reached".
- The line "Earn season XP from every match".

**Premium banner** (when not premium):
- "Premium track · Unlock every reward on the right · £9.99".
- It calls `mockPurchase({title:'Premium season pass', price:'£9.99', sub:'For this month\'s season only.', ...})`. On success: `S.season.premium = true`, save, refresh, toast. When premium is on, show a "Premium" badge in the hero instead.

**Claim all**: "Claim all (N)" when N > 0. It calls `revealRewards(list, {title:'Season rewards'})` and marks them all claimed. Mark claims in S **before** revealing (revealRewards saves).

**Track list**:
- Columns: **Free | tier node | Premium**. The tier nodes sit on a vertical line; the reached part of the line is filled in the season colour.
- Each tile shows `rewardIconEl(r, 44)`, a short label (`rewardName`, compacted), and a rarity tint for items, boxes and chests (`rewardRarity`).
- Tile states:
  - **claimed**: dimmed, with a ✓
  - **claimable**: glowing, with a "Claim" label. It is a button that reveals the one reward and marks it claimed.
  - **not reached**: muted. Tapping shows a toast like "Reach tier 12 to claim".
  - **premium locked**: a lock badge. Tapping shows a toast "Unlock Premium to claim".
- Give a "You are here" marker at the current tier.
- On open, scroll the current tier's row to the centre of `#sub-views` (in a requestAnimationFrame).
- The whole track must stay smooth with 40 rows. Build simple DOM; no heavy shadows on every tile.

**Help sheet**:
- how XP is earned
- 150 XP per tier, 40 tiers
- the free and premium tracks, and that premium covers this month only
- unclaimed rewards vanish when the season ends
- duplicate items turn into Gems

## `seasonRing()`
- A 44px circular button.
  - A progress arc to the next tier in the season colour, over a dim track.
  - The tier number in the centre (Fraunces 16px, bold).
  - A small red dot when `seasonClaimable() > 0`.
- `data-fk="season"`. aria-label: "Season pass, tier 7, 2 rewards to claim".
- Click calls `openSeason()`.

## Also
- `seasonClaimable()` counts reached tiers whose free reward is unclaimed, plus, when premium, reached tiers whose premium reward is unclaimed.
- Test the month rollover by setting `S.season.id` to an older month: `ensureSeason()` resets the season.
- Use `S.season.xp = …` to test every state, including tier 0, a middle tier, tier 40, premium and not premium.
