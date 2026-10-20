const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, hh] of [[360, 640], [390, 844], [390, 700]]) {
    const p = await b.newPage({ viewport: { width: w, height: hh }, deviceScaleFactor: 2 }); p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + process.cwd() + '/dist/test.html'); await p.waitForTimeout(800);
    await p.evaluate(() => { S.tutorialDone = true; S.xp = 30000; S.sparks = 200000; S.settings.fastAI = true; save(); startMatch('glasshouse'); });
    for (let i = 0; i < 100; i++) { await p.waitForTimeout(100); if (await p.evaluate(() => !!M.awaiting)) break; }
    await p.keyboard.press('1'); await p.waitForTimeout(600);
    await p.evaluate(() => { M.bubbles = { [M.st.order[(M.st.order.indexOf(0) + 3) % 4]]: { text: "There's one left. It isn't yours.", hot: true } }; renderOpps(); });
    await p.waitForTimeout(300);
    const m = await p.evaluate(() => { const t = document.querySelector('#table'); return { scroll: t.scrollHeight - t.clientHeight, trays: [...document.querySelectorAll('#t-trays .tray')].map(x => Math.round(x.getBoundingClientRect().height)), opBottom: Math.round(document.querySelector('#t-opps').getBoundingClientRect().bottom), infoTop: Math.round(document.querySelector('.infostrip').getBoundingClientRect().top) }; });
    console.log(w + 'x' + hh, JSON.stringify(m));
    await p.screenshot({ path: `shots/r2-${w}x${hh}.png` });
  }
  console.log('ERRORS', JSON.stringify(errs)); await b.close();
})();
