# Agent D: Profile, avatars, emotes, ranks, playstyle and stats

- You: `D`. Owned files: `src/profile.js`, `src/profile.css`. Replace the stub entirely: the old profileView in it is pre-rework, so use it only for reference. Prefix: `prf`.
- Public names (exact):
  - `profileView(v)`: the Profile tab. meta.js already appended a top bar (gems, sparks, gear for settings).
  - `rankSheet()`: called from the Play tab's rank chip.
  - `playstyleOf(bucket)`: returns `{key, name, emoji, blurb, x, y, enough, turnsNeeded}`.

## profileView(v)
1. **Header**, centred.
   - Your avatar `myAvatarEl(104)`. When `plusActive()`, add a warm glow ring and a small "trivet+" tag.
   - A small pencil badge on the avatar opens the **Avatar** screen.
   - The name `S.profile.name` (Fraunces 28) with an edit button, which opens a name sheet:
     - a text input, maxlength 16, trimmed
     - allowed characters: letters, digits, spaces, `. _ -`
     - inline validation message; Enter submits; Save and Cancel buttons
   - Under the name: "Level 12 · Warm rank" (`level().level`, `bankRank().name`).

2. **Friends row.**
   - A card with "0 friends" and an "Invite friends" button. Both open a sheet explaining that friends and online play are not in this prototype yet.
   - The sheet shows a personal invite code derived from `S.seed` (for example `TRV-7K2Q`) with a copy button (`copyText`).
   - Make no fake social claims.

3. **Rank card.**
   - `rankBadge(i, 44)`, the rank name, "Best bankroll 12,400".
   - A progress bar to the next rank ("Hot at 100,000"), and "League payouts ×2".
   - Tapping it opens `rankSheet()`.

4. **Playstyle card.** Detailed under "Playstyle" below.

5. **Stats summary.** Four tiles: Matches · Win rate · Scoop rate · Biggest scoop. Then an "All statistics ›" button that opens the Statistics screen.

6. **Menu list.** Rows with an icon, a label, a hint and a chevron:
   - Avatar (current avatar thumbnail)
   - Emotes ("6 at the table")
   - Style ("Glazes, numerals, trays…"): `pushScreen('Style', box => collectionView(box))`
   - Achievements ("3 of 8"): a screen with the achievements grid (`ACHIEVEMENTS`, `S.ach`)
   - Replay the lesson: `startTutorial()`

## Playstyle
**Data**
- Use the `'all'` stats bucket (`statBucket('all')`). Field meanings are in the comment above `STAT0` in economy.js.
- Two axes:
  - Looseness `L = feedHeat / feeds`: the average heat you leave in trays you feed. High means loose.
  - Aggression `A = (traps + boils) / turns`. High means aggressive.

**Archetypes**

| Quadrant | Name | Blurb |
|---|---|---|
| Tight + aggressive | Trapper 🪤 | Keeps trays cool for rivals and sets them up for yourself |
| Loose + aggressive | Hothead 🔥 | Pushes heat everywhere and boils what you can't take |
| Tight + passive | Counter 🧮 | Plays safe, counts chips, waits for sure scoops |
| Loose + passive | Feeder 🍽️ | Generous with heat; rivals love sitting with you |

**Calibrate the thresholds by simulation**
1. Write a node script in your WORK copy that loads `src/engine.js` (`const Scoop = require('./src/engine.js')`).
2. Play about 200 or more full matches per personality. Put each AI personality in seat 0 (`Scoop.aiChooseAction(st, pid, personality, {venue})` for every seat), against mixed opponents, at 2 and 3 seats.
3. Compute L and A for seat 0 exactly as defined:
   - heat after a feed is `Scoop.trayHeat(stateAfter, 0, tray)`
   - a trap is a feed after which seat 0 still holds a completer of that tray (`Scoop.completers(trayChips)`). Check the signature in engine.js.
4. Set the thresholds near the overall medians, so the personalities spread across the quadrants. Report the numbers in your final report.
5. Map L and A to chart coordinates with a smooth clamp around the thresholds, using the -1..1 range on each axis.

**Chart**
- A diamond-shaped (rotated square) chart. Labels: Aggressive at the top, Passive at the bottom, Tight on the left, Loose on the right.
- Each quadrant has a faint fill and its archetype emoji.
- Your position is a glowing dot that animates in (motion-safe).
- `role="img"` with an aria-label like "Playstyle: Trapper. Tight and aggressive."

**Card**
- The archetype emoji, name and blurb, plus a "Share" button. Share does `copyText("My trivet playstyle is Trapper 🪤 …")` and a toast.
- Below `enough` (at least 20 turns): grey out the dot and say "Play N more turns to reveal your style".

## Statistics screen
Open it with `pushScreen('Statistics', build, {help: glossarySheet})`.

**Mode tabs**: a horizontal segmented scroller (`.seg` style) with Total · Corner Café · Noodle Bar · Tea House · Supper Club · Glasshouse · Daily Tray (`V[k].name`). Keep the selected tab in a module variable.

**Content for the selected bucket**:
- **Style tiles** (2×2):
  - Scoop rate: scoopsTaken / scoopChances
  - Heat left: feedHeat / feeds
  - Trap rate: traps / feeds
  - Boil rate: boils / turns

  Each tile shows a big % in Fraunces, a label, a 4-segment indicator bar coloured by band, and a one-word read such as "Sharp", "Steady" or "Cool".
- **Heat by stage**: four ring gauges (Early · Mid · Late · Empty bag), from stageHeat[i] / stageFeeds[i].
- **Hands**: a win-rate arc ring, Played, Won.
- **Matches**: a win-rate ring, Played, First places.
- **Gifts**: "Trays you fed that a rival scooped", the count, and chips given.
- **Detail tiles**: Chips scooped · Scoops · Biggest scoop · Full trays · Traps sprung · Boil-overs · Peeks used · Swaps used · Emotes sent · Time at the table (playMs as "3h 12m") · Playing since (firstPlayed as a nice date).
- Show "—" when a denominator is 0, never NaN.
- **Glossary sheet**: explains every metric in one line each.

## Avatar screen
Open it with `pushScreen('Avatar', …, {right: () => curPill('gems')})`.
- A big preview of the selected avatar, with its name and rarity tag.
- Category tabs from `AVATAR_CATS`, then a grid of `avatarEl(id, 64)` buttons. Avatar states:

| State | Look | Tap |
|---|---|---|
| Equipped | Ring and check | Nothing |
| Owned | Plain | Equips it (save, update preview, toast) |
| Priced | Gem price chip | Confirm sheet "Buy Fox for [gem] 250", then spend, grant, equip. Short on Gems → "Get Gems" (goShop('gems')) |
| Mystery (price null) | Lock | Toast "Found in chests, boxes and the season pass" |

- aria-labels must include the name and state.

## Emotes screen
Open it with `pushScreen('Emotes', …, {right: () => curPill('gems')})`.
- **Top**: "At the table", 6 slots showing `S.emoteSet`. Select a slot, then tap an owned emote to put it there, or swap it if that emote is already in another slot. Explain this in one hint line.
- **Grid**: all `EMOTES` as big emoji with names. Same states as avatars: owned, priced in Gems (buy sheet), or season-only (lock).
- Save after each change.

## rankSheet()
- A sheet containing a horizontal pager (scroll-snap) of `BANK_RANKS` cards. Each card has:
  - `rankBadge(i, 64)`, the name, "10,000 bankroll", and a locked or unlocked state
  - the league payout multiplier
  - the progress bar on the current rank
  - "Kiln payouts at this rank". It uses `Scoop.KILN.base[S.kiln.tier]` × place multiplier × rank mult:

    | Place | Place multiplier |
    |---|---|
    | 1st | ×3 |
    | 2nd | ×2 |
    | 3rd | ×1.5 |
    | 4th–10th | ×1 |
    | 11th+ | ×0.25 |

    Show rows with medal-style badges and compact amounts.
- Dots under the pager. It opens scrolled to your current rank.
- One line: "Rank follows the most Sparks you have ever held. Spending never lowers it."
- A Close button in `.btnrow`.

## Feel
- Profile is a calm, centred page with breathing room.
- Rings and charts are clean SVG with round caps; colours come from the heat palette (`--heat-cool` #7E8AA3, `--heat-warm`, `--heat-hot`).
- Everything readable at 360px.
