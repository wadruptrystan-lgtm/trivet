# Agent E: Table (avatars, emotes, Peek and Swap, stats hooks, result additions)

- You: `E`. Owned files: `src/table.js` (an existing, working, carefully reviewed match controller; edit it surgically) and `src/tablex.css` (new styles; prefix `tx`).
- Do not break anything that works today:
  - the turn loop and the generation checks (`M.gen`)
  - drag and keyboard play
  - focus going to the hand at the start of your turn
  - the timers, the tutorial, the hand summaries
  - commitResult booking the match the moment it ends
  - the recap screen ("What they held")
  - leaving mid-animation
- Read table.js fully before editing, and the parts of engine.js you rely on.
- `smoke.js`, `reg.js`, `reg2.js` and `reg3.js` in the project root are earlier regression scripts. Adapt their paths to your copy and run them at the end.

## 1. Avatars
- Replace the player `monoEl(...)` uses with `rivalAvaEl(personality, size)` for rivals and `myAvatarEl(size)` for you. That covers:
  - the opponents strip (`renderOpps`)
  - your footer (`renderMe`)
  - hand summary rows
  - result standings
  - the recap hands-reveal rows
- Keep the existing sizes (44px; 34px in the compact `@container (max-height:760px)` block) and the acting "sweep" ring effect that `.opp.acting .mono` has today. Re-create both for `.ava` in tablex.css.
- Avatars stay `aria-hidden`, as the monograms were.

## 2. Emotes (not in the tutorial)
- Your footer avatar becomes a `<button>` with aria-label "Send an emote". Tapping it opens a small popover above it: a row of 6 emoji buttons from `S.emoteSet` (`emoteOf(id)`), each labelled with the emote name.
  - Escape or a tap outside closes it, and focus returns to the avatar button.
- Choosing an emote shows a bubble with the big emoji over your avatar for about 2.4s, then counts `bumpStats(mode, b => b.emotes++)`. Rate limit: one per 3s; extra taps during that time just close the popover.
- Rivals reply sometimes: 35% of the time, after 0.8–1.6s, with an emote from a per-personality list. Also, now and then (about 15%), they emote on their own right after they scoop, or after their tray boils.
  - Personality lists: rico 🔥 😂 😤 · priya 👋 😮 ⚡ · mabel 🍵 👍 😊 · otto 😬 💀 🙄 · june 🧠 🎯 🤫 · sol 😈 🤫 🎯
  - Reuse or extend the existing bubble system (`M.bubbles`, `chat()`) so emote bubbles never overlap chatter badly.
- Announce emotes in the log (`announce()`), for example "Mabel: 🍵".
- Everything respects the generation checks, so nothing fires after you leave the table.

## 3. Peek and Swap boosters
Hide both in the Daily Tray and the tutorial.

**Buttons**
- Add two compact pill buttons to the table, in `.infostrip` or near the action row, wherever they fit at 360×640 without crowding. Each shows `curIcon('peeks'|'swaps', 18)` and the count from `bal()`.
- They are enabled only on your turn, once per hand each, while not already used this hand.
- aria-labels: "Peek, 3 left. See one chip the next rival holds." and the matching Swap label.
- With 0 left: a tap toasts "Out of Peeks. Get more in the Shop.". Do not navigate away mid-match.

**Peek**
- Spend 1 Peek. Pick a random chip from the hand of the **next rival in turn order who holds chips**.
- Show it as a small chip badge on that rival's card, with text such as "Mabel holds a 6", until that chip leaves their hand or the hand ends.
- Announce it, then `bumpStats(mode, b => b.peeksUsed++)`.

**Swap**
- Requires a non-empty bag. Entering swap mode highlights your chips; tapping a chip, or pressing its number key, swaps it. Escape or the button cancels.
- The chosen chip goes into the bag and you draw a random chip from the bag. Spend 1 Swap, then `bumpStats(… swapsUsed++)`.
- Implement it as a **new immutable state**: the engine's states are values, and `applyAction` returns new ones.
  - Read engine.js to find every field that must stay consistent: hands, bag, unseen counts, rng/seed use, `record` for the recap, and anything the AI or `createWinEstimator` reads.
  - The swapped-in chip must come from the real bag contents.
  - Afterwards: `syncD()`, `refreshGlance()`, `refreshWin()`, re-render, and re-focus the hand.
  - Make sure the recap ("What they held") stays truthful and does not crash.
  - Make sure ranking and tiebreaks still work.
  - Test 30 or more matches with random swaps and peeks via `page.evaluate`, and check `Scoop` invariants: chip counts per number stay constant across hands + bag + trays + scored and boiled piles. Find out what the engine tracks.

## 4. Stats hooks
Follow the definitions in the comment above `STAT0` in economy.js exactly. Mode key: `M.mode === 'daily' ? 'daily' : M.vk`. Record nothing in the tutorial.

**Per human turn** (in `perform`, when the actor is seat 0, using `prev` and `next` states):
- `turns++`
- `scoopChances++` if any legal move scooped; `scoopsTaken++` if this move scooped
- for a feed:
  - `feeds++`
  - `feedHeat += h`, where `h = Scoop.trayHeat(next, 0, tray)`
  - `hotFeeds++` if h ≥ .30; `coolFeeds++` if h < .10
  - `traps++` if your remaining hand holds a completer of that tray
  - `stageFeeds[s]++` and `stageHeat[s] += h`
- Stage `s`: the bag size at the move compared with the bag size at the start of that hand. More than 2/3 left is 0; more than 1/3 is 1; more than 0 is 2; empty is 3.
- Boils are counted per match from the engine (below), so don't double count.

**Per event**:
- `gifts++` and `giftChips += n` when a **rival** scoops a tray that `M.fedBy` says you fed last.
- At each `handEnd`: `hands++`, and `handWins++` if your hand points equal the max (ties count).

**Per match** (in `commitResult`, once):
- `matches++`; `wins++` on first place
- `chips += p0.score`; `scoops += p0.scoops`
- `biggest = max(biggest, p0.biggest)`
- `fullTrays`, `sprung` and `boils` from p0

**Time**:
- `playMs += time` from table entry to commit, or to abandon.
- Tutorial excluded; Daily included under 'daily'.

## 5. Result screen additions (`showResult`)
- Under the XP card, add a season line: "+N season XP · Tier T", a thin progress bar to the next tier, and a "Claim" button calling `openSeason()` when `seasonClaimable() > 0`.
  - `openSeason` pushes a sub-screen; going back from it lands on the lobby. That is fine.
- If your best bankroll crossed into a new `bankRank()` during this match, add "Rank up · Hot · league payouts ×5" to the Unlocked card. Compare `bankRank()` before and after commit; bankPeak updates in `save()`.
- Show avatars in the standings.

## Tests
- Play full matches at every venue and in the Daily Tray with an automated policy, as smoke.js does.
- Verify:
  - stats buckets fill sensibly (no NaN; counts add up: `feeds + scoopsTaken + boil moves = turns`)
  - emotes in both directions
  - peek and swap flows, by mouse and by keyboard
  - leaving mid-match during emotes, peek and swap
  - the 360×640 layout, and the compact layout at 390×700
  - zero console errors
