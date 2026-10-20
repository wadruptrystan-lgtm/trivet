// Checks each review fix in the built page.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'); const URL = 'file://' + (process.argv[2] || require('path').join(__dirname, '../dist/test.html')), OUT = process.argv[3];
setTimeout(() => { fs.writeFileSync(OUT, 'WATCHDOG ' + JSON.stringify(res)); process.exit(2); }, 150000);
const res = {}; const errs = [];
(async () => {
  const b = await chromium.launch();
  const fresh = async (vw = 390, vh = 844) => {
    const p = await b.newPage({ viewport: { width: vw, height: vh } });
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(URL); await p.waitForTimeout(900);
    await p.evaluate(() => { S.tutorialDone = true; save(); }); return p;
  };
  // eco-1: a rank reached through trophy Sparks is kept in the stored peak
  let p = await fresh();
  res.eco1 = await p.evaluate(() => {
    S.sparks = 95000; S.bankPeak = 95000; S.xp = 0; for (let L = 1; L < 25; L++) S.xp += Scoop.xpToNext(L);
    S.ach.appr = S.ach.warm = S.ach.first = '2026-10-01'; save();
    const st = JSON.parse(localStorage.getItem(KEY)); return { sparks: S.sparks, stored: st.bankPeak, hot: !!S.ach.hot };
  });
  // eco-2: no banner while the wheel is spinning
  res.eco2 = await p.evaluate(async () => {
    ARC_W.busy = true; S.wallet.gems = 5; trEarn('reels3');
    await new Promise(r => setTimeout(r, 1200)); const during = $('#tr-banner').classList.contains('show');
    ARC_W.busy = false; await new Promise(r => setTimeout(r, 900)); const after = $('#tr-banner').classList.contains('show');
    return { during, after };
  });
  // eco-3 / copy-2: broken streaks show no progress
  res.eco3 = await p.evaluate(() => {
    const k = dayKey(new Date(Date.now() - 5 * 864e5)); S.daily.lastDay = k; S.daily.lastWonDay = k; S.daily.streak = 2; S.daily.runWins = 13; save();
    const a = [trOf('hotstreak').prog(), trOf('iron').prog()];
    const y = dayKey(new Date(Date.now() - 864e5)); S.daily.lastDay = y; S.daily.lastWonDay = y; save();
    return { stale: a, live: [trOf('hotstreak').prog(), trOf('iron').prog()] };
  });
  // ui-2 / ui-3 / ui-4 / ui-5 / copy-11 on the cabinet
  res.cab = await p.evaluate(async () => {
    trOpenCabinet(); await new Promise(r => setTimeout(r, 300));
    const none = $('.tr-titlebtn b.none'), noneCol = none ? getComputedStyle(none).color : null;
    const arcs1 = $$('#sub-views .tr-rarc').map(e => e.getAnimations().length);
    $('[data-fk="tr-f:todo"]').click(); await new Promise(r => setTimeout(r, 150));
    const arcs2 = $$('#sub-views .tr-rarc').map(e => e.getAnimations().length);
    $('[data-fk="tr-f:all"]').click(); await new Promise(r => setTimeout(r, 150));
    trDetail('nerve'); await new Promise(r => setTimeout(r, 400));
    const eye = $('#sheet .tr-deye').textContent, hint = $('#sheet .tr-hintbtn'), hintH = hint ? hint.getBoundingClientRect().height : null;
    closeSheet(); await new Promise(r => setTimeout(r, 400));
    $('#toast').textContent = ''; $('#toast').classList.remove('show');
    trTitleSheet && trTitleSheet(); await new Promise(r => setTimeout(r, 400));
    const noneBtn = $$('#sheet button').find(x => /None/.test(x.textContent)); if (noneBtn) noneBtn.click();
    await new Promise(r => setTimeout(r, 300));
    return { noneCol, arcs1, arcs2, eye, hintH, toastAfterNone: $('#toast').classList.contains('show') ? $('#toast').textContent : '' };
  }).catch(e => ({ err: e.message }));
  res.prof = await p.evaluate(async () => {
    popScreen(); setTab('profile'); await new Promise(r => setTimeout(r, 300));
    const off = $('.prf-cabt.off'); return { offCol: off ? getComputedStyle(off).color : null, muted: getComputedStyle(document.documentElement).getPropertyValue('--muted') };
  });
  await p.close();
  // play-1: Platinum lands in the lobby when the lesson replay is the last base trophy
  p = await fresh();
  res.play1 = await p.evaluate(async () => {
    TR_BASE.forEach(t => { if (t.id !== 'lesson') S.ach[t.id] = '2026-10-01'; }); save();
    startTutorial(); M.firstRun = false; M.lesson = LESSONS.length - 1; await lessonDone(M.gen);
    await new Promise(r => setTimeout(r, 300));
    const atTable = { lesson: !!S.ach.lesson, plat: !!S.ach.plat };
    const btn = $('#table .coach .btn'); if (btn) btn.click();
    await new Promise(r => setTimeout(r, 600));
    return { atTable, after: { cur: CUR, plat: !!S.ach.plat } };
  }).catch(e => ({ err: e.message }));
  await p.close();
  // ui-6: the lesson banner sits below the coach card at 360x640
  p = await b.newPage({ viewport: { width: 360, height: 640 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(900);
  res.ui6 = await p.evaluate(async () => {
    startTutorial(); M.lesson = LESSONS.length - 1; await lessonDone(M.gen);
    await new Promise(r => setTimeout(r, 900));
    const co = $('#table .coach'), card = $('#tr-banner .tr-bn-card');
    return { lesson: !!S.ach.lesson, show: $('#tr-banner').classList.contains('show'), coachBottom: co && Math.round(co.getBoundingClientRect().bottom), cardTop: card && Math.round(card.getBoundingClientRect().top), stepBottom: $('#table .coach .step') ? Math.round($('#table .coach .step').getBoundingClientRect().bottom) : null };
  }).catch(e => ({ err: e.message }));
  await p.screenshot({ path: process.argv[3].replace(/\.out$/, '-ui6.png') });
  await p.close();
  // ui-1 / copy-1: migrating save: lobby updates and Open the cabinet focuses the back button
  p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(700);
  await p.evaluate(() => { const o = JSON.parse(JSON.stringify(S)); delete o.troph; o.ach = { first: '2026-09-01', trapper: '2026-09-02' }; o.tutorialDone = true; o.sparks = 5000; o.bankPeak = 5000; o.stats.scoops = 60; localStorage.setItem(KEY, JSON.stringify(o)); });
  await p.reload(); await p.waitForTimeout(1500);
  res.migr = await p.evaluate(async () => {
    const sheet = !!$('#sheet .panel h3') && $('#sheet .panel h3').textContent;
    const pill = $$('.cpill[data-cur="sparks"] .pv').map(e => e.textContent);
    const bal = $('#views') ? ($('#views').innerText.match(/[\d,]{4,}/) || [''])[0] : '';
    const open = $$('#sheet button').find(x => /Open the cabinet/.test(x.textContent)); open.click();
    await new Promise(r => setTimeout(r, 700));
    const a = document.activeElement;
    return { sheet, sparks: S.sparks, pill, bal, active: a && (a.id || a.tagName), sum: trSummary() };
  }).catch(e => ({ err: e.message }));
  await p.close();
  res.errs = errs;
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1)); await b.close(); process.exit(0);
})();
