const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack||'').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + process.cwd() + '/dist/test.html'); await p.waitForTimeout(1500);
  await p.screenshot({ path: 'shots/01-home.png' });
  // tutorial
  await p.click('text=Start the lesson'); await p.waitForTimeout(900);
  await p.screenshot({ path: 'shots/02-lesson1.png' });
  await p.click('#t-hand-chips .chip:not([disabled])'); await p.waitForTimeout(400);
  await p.screenshot({ path: 'shots/03-lesson1-lifted.png' });
  await p.click('#t-actions .tb[data-t="0"]'); await p.waitForTimeout(2200);
  await p.screenshot({ path: 'shots/04-lesson1-done.png' });
  await p.click('.coach .btn'); await p.waitForTimeout(900);
  await p.click('#t-hand-chips .chip:not([disabled])'); await p.waitForTimeout(300);
  await p.click('#t-actions .tb[data-t="0"]'); await p.waitForTimeout(2200);
  await p.click('.coach .btn'); await p.waitForTimeout(900);
  await p.click('#t-hand-chips .chip:not([disabled])'); await p.waitForTimeout(500);
  await p.screenshot({ path: 'shots/05-lesson3-lifted.png' });
  await p.click('#t-actions .tb[data-t="2"]'); await p.waitForTimeout(1800);
  await p.screenshot({ path: 'shots/06-lesson3-done.png' });
  await p.click('.coach .btn'); await p.waitForTimeout(1500);
  // play the Café match with simple policy: lift first chip, choose best preview
  let shots = 0, turns = 0;
  for (let step = 0; step < 600; step++) {
    await p.waitForTimeout(200);
    const s = await p.evaluate(() => ({ cur: CUR, aw: !!M.awaiting, ov: !!document.querySelector('#table .overlay'), phase: M.st && M.st.phase, lifted: M.lifted, pv: M.previews && M.previews.every(Boolean) }));
    if (s.cur !== 'table') break;
    if (s.ov) { if (shots < 1) { await p.screenshot({ path: 'shots/08-summary.png' }); shots++; } await p.click('#table .overlay .btn'); continue; }
    if (s.aw) {
      if (s.lifted < 0) { await p.keyboard.press('1'); continue; }
      if (!s.pv) continue;
      if (turns === 2) await p.screenshot({ path: 'shots/07-table-lifted.png' });
      const t = await p.evaluate(() => { let best = 0, bs = -1e9; M.previews.forEach((pv, t) => { const sc = pv.kind === 'scoop' ? 100 + pv.points : pv.kind === 'boil' ? -50 : -pv.heatAfter * 10; if (sc > bs) { bs = sc; best = t; } }); return best; });
      await p.click(`#t-actions .tb[data-t="${t}"]`); turns++;
    }
  }
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'shots/09-result.png', fullPage: false });
  console.log('turns', turns, 'cur', await p.evaluate(() => CUR), 'sparks', await p.evaluate(() => S.sparks), 'xp', await p.evaluate(() => S.xp));
  await p.click('text=What they held'); await p.waitForTimeout(600);
  await p.screenshot({ path: 'shots/10-recap.png' });
  await p.click('#rc-back'); await p.waitForTimeout(300);
  await p.click('text=Lobby'); await p.waitForTimeout(500);
  await p.screenshot({ path: 'shots/11-home-after.png' });
  for (const tab of ['league', 'shop', 'profile']) { await p.click(`.tabs button[data-tab="${tab}"]`); await p.waitForTimeout(400); await p.screenshot({ path: `shots/12-${tab}.png` }); }
  const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log('overflowX', ov);
  const d = await b.newPage({ viewport: { width: 1440, height: 920 } });
  d.on('pageerror', e => errs.push('PAGEERR(d) ' + e.message));
  await d.goto('file://' + process.cwd() + '/dist/test.html'); await d.waitForTimeout(1500); await d.screenshot({ path: 'shots/13-desktop.png' });
  console.log('ERRORS', JSON.stringify(errs, null, 1));
  await b.close();
})();
