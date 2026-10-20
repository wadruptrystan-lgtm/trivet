# trivet review round: shared rules

**trivet** just gained a full meta layer:
- a wallet and a reward reveal
- a mock store and mock ads
- a shop with chests and bundles
- the Prize Wheel and Lucky Reels
- a monthly season pass
- a profile with avatars, emotes, ranks, playstyle and stats
- table additions: avatars, emotes, Peek and Swap, and stats hooks

It was built by several agents in parallel. Your job is to find real problems in the integrated result.

Context:
- Read `MAIN/briefs/common.md` first: architecture, the shared API and the hard constraints. Then read the feature briefs relevant to your dimension (`MAIN/briefs/A-shop.md` … `E-table.md`).
- MAIN = `/tmp/claude-0/-home-user/10b390a1-4a83-59ab-9551-fcf694b3e2ca/scratchpad/trivet`.
- Source: `MAIN/src/*.js|css`. Build order is in `MAIN/build.py`.

## Rules
- **Never modify anything in MAIN.**
  - Make your own copy: `rm -rf WORK/<label> && cp -r MAIN WORK/<label>`, where WORK = `/tmp/claude-0/-home-user/10b390a1-4a83-59ab-9551-fcf694b3e2ca/scratchpad/work` and `<label>` is given in your prompt.
  - Build there with `python3 build.py`, and test `dist/test.html` with Playwright: `require('/opt/node-tools/node_modules/playwright')`, `chromium.launch()`, never `playwright install`.
  - `S` and every function are globals, so you can set up state with `page.evaluate`.
- **Report only real, user-affecting problems**, each with concrete evidence:
  - a Playwright reproduction you actually ran, with its observed output, or a screenshot you looked at
  - or, for pure code-path bugs, the exact `file:line` and the input that triggers it
- Do not report:
  - deliberate design choices written in the briefs
  - pure style preferences
  - hypothetical issues you could not trigger
- Be specific: say what the user sees, where, and how to make it happen.
- Severity:
  - **critical**: data loss, crash, a reward exploit or double grant, a broken core flow, or a compliance problem with mock payments or impersonation
  - **high**: a feature broken for some users or states, an accessibility blocker, or a visibly broken layout at a supported size (360×640 to 430×932, plus the desktop device frame)
  - **medium**: a noticeable bug or polish problem
  - **low**: minor
- Report at most 25 findings, most severe first. Give each a short id with your dimension prefix (e.g. `eco-3`).
- For each finding, give the files involved and a concrete suggested fix.
