# trivet

An original tile game, **Scoop**, played against AI rivals, with a full meta layer: a shop (with simulated purchases), the Prize Wheel and Lucky Reels, a monthly season pass, avatars and emotes, bankroll ranks, a playstyle profile, the weekly Kiln league, and a 68-trophy cabinet.

## Build
```
python3 build.py
```
This concatenates `src/` into one page:
- `dist/trivet.html`: the game, a single self-contained file.
- `dist/test.html`: the same page with a doctype, used by the tests.
- `dist/app.js`: the combined script, for `node --check`.
- `dist/web/`: the installable web app: `index.html`, `manifest.webmanifest`, the offline service worker `sw.js` and the icons, copied from `web/`. Host this folder on any static host served over https.

## Layout
- `src/engine.js`: the Scoop rules engine and AI (global `Scoop`).
- `src/core.js`: utilities, saved state (`S`, `save()`, `load()`), catalogue, sound.
- `src/economy.js`: wallet, rewards, reveal, mock store and ads, screens, ranks, season, stats.
- `src/table.js`: the match controller.
- `src/shop.js`, `arcade.js`, `season.js`, `profile.js`, `trophy.js`, `meta.js`: the features, plus the lobby and boot (`meta.js`).
- The CSS files match the scripts. The build order is in `build.py`.
- `docs/briefs/`: the design briefs each part was built from. `trophies.md` and `common.md` are the best starting points.

## Tests
Build first, then run from the repo root. These use Playwright with Chromium.
```
node tests/smoke.js      # lesson + a full match, layout checks
node tests/reg.js        # regression suites
node tests/reg2.js
node tests/reg3.js
node tests/found.js
node tests/rules.js dist/test.html tests/rules.out    # tuned trophy rules
node tests/fixes.js dist/test.html tests/fixes.out    # trophy review fixes
node tests/streak.js dist/test.html tests/streak.out  # Daily streak trophies
node tests/webapp.js                                  # web app: manifest, icons, offline start
```
The test scripts load Playwright from `/opt/node-tools/node_modules/playwright`. Change that path to `require('playwright')` on another machine.

## Trophy-rate simulation
`node tools/sim/sim.js` plays several hundred thousand AI matches through the real engine and reports how often each match trophy happens. See the header of `sim.js` for options.

## Notes
- Every price in the store is a mock: nothing is charged and no payment details are collected.
- Kiln rivals are simulated players, and the game says so.
- Progress is saved in the browser's localStorage under the key `trivet.v1`.
