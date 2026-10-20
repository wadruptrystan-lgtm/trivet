# Agent B: Arcade (Prize Wheel and Lucky Reels)

- You: `B`. Owned files: `src/arcade.js`, `src/arcade.css` (replace the stubs). Prefix: `arc`.
- Public names (exact):
  - `openWheel()`, `openReels()`
  - `wheelFreeReady()`: `S.arcade.wheelFreeDay !== dayKey()`
  - `reelsClaimReady()`: `Date.now() >= (S.arcade.reelsClaimAt || 0)`

  The shop calls all four. Keep the two readiness functions' semantics exactly.

## Grant first, animate second
- Decide the outcome, charge the cost, grant with `applyReward(r)` (it returns a `got`), and `save()` **before** any animation starts.
- After the animation, show it with `revealGot([got...], {title, skipIntro})` or with your own win effect.
- That way leaving the screen or reloading mid-spin never loses or duplicates a prize. If the screen closes mid-animation (`onClose`), still show the reveal, or at least a toast.
- Keep the wheel's angle and the reels' positions in module variables, so a re-render keeps the visual state.
- Pass `o.refresh` to `pushScreen` to update counters and pills in place, without rebuilding the wheel.

## Prize Wheel: `openWheel()`
Open it with `pushScreen('Prize Wheel', build, {cls:'arc-wheel', right: () => curPill('gems'), help: <paytable and odds sheet>, refresh})`.

**Wheel graphic**
- A large wheel: `min(84cqw, 340px)`, an SVG or conic-gradient disc.
- 8 segments in alternating dark tones (`--surface` and `--surface-2`) with thin separators.
- Each segment has its reward icon, via `curIcon` or a box icon, plus a small amount label.
- A pointer at the top (a white rounded triangle), and a centre hub showing the trivet ring motif: a circle on three dots.
- A subtle outer rim with small lights that twinkle while spinning (motion-safe).

**Segments** (weights add up to 100)

| Reward | Weight |
|---|---|
| 1,000 Sparks | 22 |
| 5 Gems | 16 |
| 2 Swaps | 14 |
| 5,000 Sparks | 12 |
| 2 Peeks | 14 |
| 3 Spins | 12 |
| 25 Gems | 6 |
| Mystery box `{type:'box', rarity:'rare'}` | 4 |

**Cost**
- One free spin per day: `S.arcade.wheelFreeDay = dayKey()` when used. The "Free" button shows a red dot while it is available.
- Otherwise a spin costs 10 Gems (`spend`). The second button shows "[gem icon] 10".
- When Gems are short, that button becomes "Get Gems", calling `goShop('gems')`.

**Pity**
- `S.arcade.wheelPity` counts spins. A progress bar card reads "Spin N more times for a guaranteed chest!"
- Every 25th spin also grants a **Silver Chest** (`{type:'chest', id:'silver'}`) on top of the segment prize. Then reset the counter.

**Spin animation**
- Rotate to land the chosen segment under the pointer, with a random offset inside the segment. Use 5–7 full turns over about 4.2s, eased with `cubic-bezier(.12,.72,.16,1)`.
- Play `SND.tick()` as each segment boundary passes the pointer: sample the rotation with rAF, or precompute the times from the easing.
- On stop: pulse the winning segment, then reveal. The mystery box uses the intro reveal; currency prizes use `skipIntro`.
- Reduced motion (`reduced()`): no multi-turn spin, about 0.3s, or set the angle directly.
- Disable both buttons while spinning.

**Help sheet**: odds as percentages, the daily free spin, the pity chest, and "Gems are the only cost".

## Lucky Reels: `openReels()`
Open it with `pushScreen('Lucky Reels', build, {cls:'arc-reels', right: () => curPill('spins'), help: <paytable sheet>, refresh})`.

**Cabinet**
- A rounded cabinet with 3 reel windows. Each shows 3 symbols vertically; the middle row is the payline, marked by a highlight band or arrows.
- Symbols (curIcons on soft tiles): Sparks, Gems, Swaps, Peeks, and a rare Chest (`chest-wooden`).
- The cabinet sits on a pastel or gradient backdrop that suits the dark theme. Make it look like a toy-like premium slot, not a casino.

**Pulls and payouts**
- Each pull costs 1 Spin (`spend('spins', 1)`).
- Big "Spin" button. With 0 Spins it becomes "Get Spins", calling `goShop('boosts')`.
- Decide the outcome first:

| Outcome | Base chance | Payout |
|---|---|---|
| Triple | 12% | Sparks 5,000 · Gems 20 · Swaps 4 · Peeks 4 · Chest → `{type:'chest', id:'wooden'}` (chest weighted rare within triples) |
| Pair | 45% | Sparks 500 · Gems 2 · Swaps 1 · Peeks 1 · Chest pair → 1,000 Sparks |
| Nothing | 43% | — |

- For "nothing", show 3 different symbols on the payline.

**Pity**
- `S.arcade.reelsPity` counts pulls without a triple. The **5th** pull without one is forced to be a triple. Reset it on any triple.
- Show 5 pips, plus "Triple guaranteed in N".

**Free spins**
- "Claim 5 free Spins" is available when `reelsClaimReady()`. Claiming does `gain('spins', 5)` and sets `S.arcade.reelsClaimAt = Date.now() + 8*36e5`.
- Otherwise show a live countdown "Next 5 free in 3h 12m". Update it each minute while the screen is open, and clear the timer on close.

**Animation**
- Each reel is a vertical strip of symbols that scrolls with translateY. Stop the reels in a stagger at about 0.9s, 1.3s and 1.7s, with `SND.clink(n)` on each stop.
- On a triple: `SND.trio([5,6,7])` and a **coin burst**. 12–16 copies of the won currency's icon spray from the payline and fly to the header pill (`#sub-right .cpill`), which bumps when they land (use `updatePills(k, true)`). Chest triples use `revealGot` with the intro.
- On a pair, use a smaller burst. Show a result line under the cabinet ("Triple Gems! +20 Gems", "Pair · +500 Sparks", or "No match").
- Reduced motion: no strips or burst; just show the final symbols and the result line.

**Help sheet**: the paytable (pair and triple per symbol), the pity rule, and the free-spins timer.

## Feel
- Both screens are full-screen sub-pages. Content is centred, and the screen is a stage with a soft radial glow behind the wheel or cabinet.
- Big, satisfying controls: two side-by-side buttons for the wheel; one wide button for the reels, plus the claim card.
- At 360×640 everything must fit without the main button scrolling off-screen. Scale the wheel or cabinet with cqw and cqh.
