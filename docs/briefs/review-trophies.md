# trivet trophy review round

trivet just gained a **Trophy Cabinet** (68 trophies: 61 base on 7 shelves, the Platinum Trivet, 6 Beyond Platinum), trophy rewards, trophy-only items, a banner, a results card, a Platinum ceremony, titles, a migration from the old 8 achievements, and hooks across the app. Several agents built it in parallel and it has been integrated. Find real problems in the integrated result.

- Read `MAIN/briefs/trophies.md` (the spec), `MAIN/briefs/common.md` (architecture and hard constraints), and the agent briefs `T-trophy.md`, `X-table.md`, `K-hooks.md` for detail. The catalogue is `MAIN/src/trophy.js`.
- MAIN = `/tmp/claude-0/-home-user/10b390a1-4a83-59ab-9551-fcf694b3e2ca/scratchpad/trivet`, WORK = `/tmp/claude-0/-home-user/10b390a1-4a83-59ab-9551-fcf694b3e2ca/scratchpad/work`.

## Rules
- **Never modify anything in MAIN.** Copy it: `rm -rf WORK/<label> && cp -r MAIN WORK/<label>`; build there with `python3 build.py`; test `dist/test.html` with Playwright (`require('/opt/node-tools/node_modules/playwright')`, `chromium.launch()`, never `playwright install`). `S` and every function are globals, so set up state with `page.evaluate`. Write test output to files and add a watchdog that calls `process.exit`; never return the promise of `revealRewards`/`revealGot` from `page.evaluate`.
- **Report only real, user-affecting problems**, each with concrete evidence: a Playwright reproduction you ran with its observed output, a screenshot you looked at, or for pure code-path bugs the exact `file:line` and the input that triggers it.
- Don't report deliberate choices written in the briefs, pure style preferences, or hypotheticals you couldn't trigger.
- Severity: **critical** (data loss, crash, a reward exploit or double grant, a broken core flow, mock-payment or impersonation compliance), **high** (broken for some users or states, an accessibility blocker, a visibly broken layout at 360×640 to 430×932 or the desktop frame), **medium** (noticeable bug or polish problem), **low** (minor).
- At most 25 findings, most severe first, each with an id using your dimension prefix (e.g. `eco-3`), the files involved and a concrete suggested fix.

## Rules tuned after a simulation (authoritative)
A simulation of ~470,000 matches showed several draft rules were far too easy or near-impossible, so these were changed after the agent briefs were written. Where `X-table.md` or `trophies.md` disagree, the catalogue text in `src/trophy.js` and the code in `src/table.js` are what we want:
- Double Scoop: three Double Scoops in one match. Trapper: four sprung traps in one match. Bookends: a 1·1·1 and an 8·8·8 in the same match.
- Clean Sweep and Comeback: only at tables of three or four. Nothing Wasted: only at a table of four.
- Cool Customer: win a match that includes one hand with 3+ of your feeds and none at 30% heat or more.
- Untouchable: no rival scoops a tray you fed in the final hand (3–4 seats). Whitewash: no rival scoops in the final hand.
- Head of the Table: also Sol scores nothing in the final hand. Turnabout: twice in one match, scoop a tray Sol fed last while he held its finishing chip.
- Steam Room: two boil-overs in one hand. Every Number: five sets of each number (S.troph.setN). Hot Streak: 3 days. Daily Regular: 15 wins.
- Iron Streak (Beyond Platinum): 14 Daily wins without missing a day (S.daily.runWins; a missed day resets it at the next Daily start, a loss doesn't).
The simulation itself is in `WORK/SIM` (read-only for you).
