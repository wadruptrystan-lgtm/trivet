const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'); setTimeout(() => process.exit(2), 40000);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + (process.argv[2] || require('path').join(__dirname, '../dist/test.html'))); await p.waitForTimeout(900);
  const r = await p.evaluate(async () => {
    S.tutorialDone = true; save();
    // two Daily wins on the previous days, then play today's Daily for real and force a win at the end
    const d = new Date(), y = dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
    S.daily.streak = 2; S.daily.lastWonDay = y; S.daily.lastDay = y; S.daily.runWins = 13; save();
    const before = { hot: !!S.ach.hotstreak, iron: !!S.ach.iron };
    startMatch('tea', { daily: true });
    // finish the match quickly with a forced outcome: give seat 0 a big lead, then end the state
    let st = M.st, guard = 0;
    while (st.phase !== 'over' && guard++ < 400) { const a = Scoop.legalActions(st, st.turn); const best = a.find(x => Scoop.moveOutcome(st, x.chip, x.tray).kind === 'scoop') || a[0]; st = Scoop.applyAction(st, best); if (st.turn !== 0 && st.phase === 'play') { st.players[0].score += 0; } }
    st.players[0].score = 99; M.st = st; commitResult();
    return { before, won: M.result.won, streak: S.daily.streak, runWins: S.daily.runWins, hot: !!S.ach.hotstreak, iron: !!S.ach.iron, trophies: (M.result.trophies || []).map(x => x.id) };
  });
  fs.writeFileSync(process.argv[3], JSON.stringify({ r, errs }, null, 1)); await b.close(); process.exit(0);
})();
