# Agent S: simulate how often each match trophy happens

- You: `S`. You change **nothing** in MAIN. Work in `WORK/SIM` (copy what you need). Your deliverable is the structured report.
- Read `briefs/trophies.md`, `src/trophy.js` (the catalogue), `src/engine.js` (rules, `VENUES`, `PERSONALITIES`, `newMatch`, `applyAction`, `aiChooseAction`, `ranking`, `trayHeat`, `matchXP`, `levelFromXP`), and `table.js`'s `lineup()` (who sits at each venue), `startMatch` and `txStats` (how heat after a feed is measured).
- The engine is a plain script that defines `var Scoop`. In Node: `const Scoop = new Function(require('fs').readFileSync(path,'utf8') + '; return Scoop;')();`.

## What to measure
Simulate matches at each venue (cafe, noodle, tea, supper, glasshouse) and the Daily Tray (2 seats vs June, the daily seed scheme doesn't matter; use random seeds), with seat 0 played by a proxy for a decent human. Use the `sensible` personality at the venue's sharpness as the main proxy, and report a second proxy (for example `rollout`, or `june` settings) to show the range. Run enough matches (thousands per venue) for stable rates.

For each venue, per match (as a fraction), report how often seat 0 would earn each match trophy as `table.js` will judge it (rules in `briefs/X-table.md` and the catalogue): `double`, `spoiler`, `trapper`, `steam`, `generous`, `turnabout` (Sol's venues), `bookends`, `sweep`, `comeback`, `cool`, `untouch` (3–4 seats), `whitewash`, `headtable` (supper), `photo`, `nowaste`, `full` (a six-chip scoop), `lastchip`, and seat 0's win rate. Also the per-match averages of seat 0's scoops and XP (`matchXP`, no first-win bonus), and how many matches it takes to complete Every Number (all of 1·1·1 to 8·8·8 scooped by seat 0), median and 90th percentile.

## Then judge
Our targets for a player who aims for a trophy at the best venue for it: a **bronze** within about 10 matches, a **silver** within about 40, a **gold** within about 150 (i.e. per-match rates of roughly ≥10%, ≥2.5% and ≥0.7%). Secrets can be a little rarer but must not be near-impossible. Also estimate the play needed for the counted golds: Head Chef (1,000 scoops), Master Potter (level 40, use `levelFromXP`), Daily Regular (30 Daily wins, i.e. how many days at the measured Daily win rate), and the overall hours to the Platinum assuming about 4 minutes per match.

For every trophy outside its target, propose the smallest rule or threshold change that brings it in (for example "Whitewash: allow one rival scoop", or "Bookends: either run, any two matches"), with the measured rate under the proposed rule. Keep the trophy's idea and name.

Write your script to `WORK/SIM/sim.js` and keep it runnable. Report precisely; don't round rates to zero (give e.g. 0.0004).
