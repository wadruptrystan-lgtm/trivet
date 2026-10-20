const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const errs = [], warns = [];
  const mk = async (w, hh) => { const p = await b.newPage({ viewport: { width: w, height: hh }, deviceScaleFactor: 2 }); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text().slice(0, 120)); }); await p.goto('file://' + process.cwd() + '/dist/test.html'); await p.waitForTimeout(900); return p; };
  // leave mid-scoop animation, repeatedly
  let p = await mk(390, 844);
  await p.evaluate(() => { S.tutorialDone = true; S.sparks = 50000; save(); });
  let leaves = 0;
  for (let k = 0; k < 6; k++) {
    await p.evaluate(() => startMatch('cafe'));
    for (let i = 0; i < 300; i++) {
      await p.waitForTimeout(50);
      const s = await p.evaluate(() => ({ lit: !!document.querySelector('#t-trays .chip.lit, #t-trays .shiver'), aw: !!M.awaiting, ov: !!document.querySelector('#table .overlay'), cur: CUR }));
      if (s.cur !== 'table') break;
      if (s.lit) { await p.evaluate(() => leaveMatch()); await p.waitForTimeout(150); await p.evaluate(() => { const b = document.querySelector('#sheet .btn.cta'); if (b) b.click(); }); leaves++; break; }
      if (s.ov) { await p.evaluate(() => document.querySelector('#table .overlay .btn').click()); continue; }
      if (s.aw) await p.evaluate(() => { const a = Scoop.aiChooseAction(M.st, 0, 'rico', { venue: 'cafe' }); playHuman(a.chip, a.tray); });
    }
    await p.waitForTimeout(1500);
  }
  console.log('mid-animation leaves:', leaves, 'ghost fx left:', await p.evaluate(() => document.querySelectorAll('.flychip,.steam,.dragchip,.scooplabel').length));
  // keyboard start focus: start via hero button with keyboard
  p = await mk(390, 844);
  await p.evaluate(() => { S.tutorialDone = true; save(); renderHome(); });
  let focusOk = 0, tries = 0;
  for (let k = 0; k < 6; k++) {
    await p.evaluate(() => { go('home'); const b = document.querySelector('.gcard[data-key="cafe"] .gcta'); b.focus(); });
    await p.keyboard.press('Enter');
    for (let i = 0; i < 80; i++) { await p.waitForTimeout(100); if (await p.evaluate(() => !!M.awaiting)) break; }
    await p.waitForTimeout(200);
    const f = await p.evaluate(() => document.activeElement && document.activeElement.closest('#t-hand-chips') ? 'hand' : (document.activeElement || {}).tagName);
    tries++; if (f === 'hand') focusOk++;
    await p.evaluate(() => abandon());
  }
  console.log('keyboard start focus on hand:', focusOk, '/', tries);
  // venue sheet at 360x640: CTA visible
  p = await mk(360, 640);
  await p.evaluate(() => { S.tutorialDone = true; S.xp = 30000; S.sparks = 200000; save(); renderHome(); venueSheet('supper'); });
  await p.waitForTimeout(500);
  const vis = await p.evaluate(() => { const pn = document.querySelector('#sheet .panel').getBoundingClientRect(), c = document.querySelector('#sheet .btn.cta').getBoundingClientRect(); return { panelBottom: Math.round(pn.bottom), ctaBottom: Math.round(c.bottom) }; });
  console.log('venue sheet 360x640', JSON.stringify(vis));
  await p.screenshot({ path: 'shots/r3-sheet360.png' });
  console.log('ERRORS', JSON.stringify(errs)); console.log('WARN', JSON.stringify([...new Set(warns)].slice(0, 5)));
  await b.close();
})();
