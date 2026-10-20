const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (w, hh) => { const p = await b.newPage({ viewport: { width: w, height: hh }, deviceScaleFactor: 2 }); p.on('pageerror', e => errs.push(`${w}x${hh} ` + e.message)); await p.goto('file://' + process.cwd() + '/dist/test.html'); await p.waitForTimeout(900); return p; };
  // 1) leave during end window commits the result
  let p = await mk(390, 844);
  await p.evaluate(() => { S.tutorialDone = true; S.settings.fastAI = true; S.settings.reduceMotion = true; applyTheme(); save(); startMatch('cafe'); });
  for (let i = 0; i < 400; i++) {
    await p.waitForTimeout(60);
    const s = await p.evaluate(() => ({ aw: !!M.awaiting, ov: !!document.querySelector('#table .overlay'), ph: M.st && M.st.phase, cur: CUR }));
    if (s.ph === 'over') break;
    if (s.ov) { await p.evaluate(() => document.querySelector('#table .overlay .btn').click()); continue; }
    if (s.aw) await p.evaluate(() => { const a = Scoop.aiChooseAction(M.st, 0, 'june', { venue: 'cafe' }); playHuman(a.chip, a.tray); });
  }
  await p.waitForTimeout(100);
  const before = await p.evaluate(() => ({ m: S.stats.matches, sp: S.sparks, committed: M.committed, cur: CUR }));
  await p.evaluate(() => leaveMatch()); await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ m: S.stats.matches, cur: CUR }));
  console.log('end-window leave:', JSON.stringify(before), '->', JSON.stringify(after));
  // 2) 360x640 table with chip lifted, 4 seats
  p = await mk(360, 640);
  await p.evaluate(() => { S.tutorialDone = true; S.xp = 30000; S.sparks = 200000; S.settings.fastAI = true; applyTheme(); save(); startMatch('supper'); });
  for (let i = 0; i < 100; i++) { await p.waitForTimeout(100); if (await p.evaluate(() => !!M.awaiting)) break; }
  await p.keyboard.press('1'); await p.waitForTimeout(700);
  await p.screenshot({ path: 'shots/r-360-supper.png' });
  console.log('focus after key lift:', await p.evaluate(() => document.activeElement.className + ' ' + (document.activeElement.dataset.t ?? '')));
  // 3) (old collection tab removed from the lobby; covered by the shop agent)
  p = await mk(390, 844);
  // 4) venue sheet
  await p.evaluate(() => { setTab('play'); S.xp = 30000; save(); renderHome(); venueSheet('supper'); }); await p.waitForTimeout(500);
  await p.screenshot({ path: 'shots/r-venuesheet.png' });
  // 5) tutorial replay ends without a free match
  p = await mk(390, 844);
  await p.evaluate(() => { S.tutorialDone = true; save(); startTutorial(); }); await p.waitForTimeout(600);
  for (let L = 0; L < 3; L++) {
    await p.click('#t-hand-chips .chip:not([disabled])'); await p.waitForTimeout(250);
    await p.click(L < 2 ? '#t-actions .tb[data-t="0"]' : '#t-actions .tb[data-t="2"]'); await p.waitForTimeout(1800);
    if (L < 2) { await p.click('.coach .btn'); await p.waitForTimeout(600); }
  }
  console.log('replay final button:', await p.textContent('.coach .btn'));
  await p.click('.coach .btn'); await p.waitForTimeout(400);
  console.log('after replay screen:', await p.evaluate(() => CUR), 'sparks', await p.evaluate(() => S.sparks));
  // 6) bubbles + 4 seat table screenshot mid play
  p = await mk(390, 844);
  await p.evaluate(() => { S.tutorialDone = true; S.xp = 30000; S.sparks = 200000; save(); startMatch('glasshouse'); });
  for (let i = 0; i < 100; i++) { await p.waitForTimeout(100); if (await p.evaluate(() => !!M.awaiting)) break; }
  await p.evaluate(() => { M.bubbles = { [M.st.order[(M.st.order.indexOf(0) + 3) % 4]]: { text: "There's one left. It isn't yours.", hot: true } }; renderOpps(); });
  await p.screenshot({ path: 'shots/r-glasshouse.png' });
  console.log('ERRORS', JSON.stringify(errs));
  await b.close();
})();
