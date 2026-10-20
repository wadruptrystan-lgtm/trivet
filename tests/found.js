const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack||'').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + process.cwd() + '/dist/test.html'); await p.waitForTimeout(1500);
  await p.screenshot({ path: 'shots2/01-play-new.png' });
  await p.evaluate(() => { S.tutorialDone = true; S.xp = 4000; save(); renderHome(); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'shots2/02-play.png' });
  await p.evaluate(() => document.querySelector('#views').scrollTop = 600); await p.waitForTimeout(200);
  await p.screenshot({ path: 'shots2/03-play-scrolled.png' });
  // reveal
  await p.evaluate(() => { revealRewards([{ type: 'chest', id: 'golden' }], { title: 'Golden Chest' }); });
  await p.waitForTimeout(700); await p.screenshot({ path: 'shots2/04-reveal-intro.png' });
  await p.click('.rv-tap'); await p.waitForTimeout(700); await p.screenshot({ path: 'shots2/05-reveal-1.png' });
  for (let i = 0; i < 3; i++) { await p.click('.rv-tap'); await p.waitForTimeout(300); }
  await p.waitForTimeout(500); await p.screenshot({ path: 'shots2/06-reveal-n.png' });
  for (let i = 0; i < 6 && await p.$('.reveal'); i++) { await p.click('.rv-tap'); await p.waitForTimeout(300); }
  console.log('reveal gone', !(await p.$('.reveal')), await p.evaluate(() => [S.sparks, JSON.stringify(S.wallet), document.activeElement.outerHTML.slice(0, 80)]));
  // mock purchase
  await p.evaluate(() => mockPurchase({ title: '1,200 Gems', price: '£9.99', iconEl: rewardIconEl({ type: 'gems', n: 1 }, 72), sub: 'A pouch of Gems for chests, avatars and emotes.', onSuccess: () => revealRewards([{ type: 'gems', n: 1200 }], { skipIntro: true, title: 'Purchase complete' }) }));
  await p.waitForTimeout(500); await p.screenshot({ path: 'shots2/07-purchase.png' });
  await p.click('.panel .btn.cta'); await p.waitForTimeout(1400); await p.screenshot({ path: 'shots2/08-purchased.png' });
  await p.click('.rv-tap'); await p.waitForTimeout(400);
  // ad
  await p.evaluate(() => mockAd(() => toast('rewarded'), { label: '3 Spins' }));
  await p.waitForTimeout(1200); await p.screenshot({ path: 'shots2/09-ad.png' });
  await p.waitForTimeout(4500); await p.screenshot({ path: 'shots2/10-ad-done.png' });
  await p.click('.adov .btn.cta'); await p.waitForTimeout(400);
  console.log('ads left', await p.evaluate(() => adsLeft()));
  // sub screen
  await p.evaluate(() => pushScreen('Avatars', (v) => { v.append(h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px' }, AVATARS.map(a => avatarEl(a.id, 64)))); v.append(h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px;margin-top:20px' }, EMOTES.map(e => rewardIconEl({ type: 'item', cat: 'emote', id: e.id }, 44)), ['glaze','num','tray','table','sound'].map(c => cosmeticIconEl(c, COSMETICS[c][2] ? COSMETICS[c][2].id : COSMETICS[c][1].id, 56)), CURS.map(k => rewardIconEl({type:k,n:1}, 56)), ['wooden','silver','golden'].map(id => rewardIconEl({type:'chest',id}, 56)), RARITY_ORDER.map(r => rewardIconEl({type:'box',rarity:r},56)), BANK_RANKS.map((r,i)=>rankBadge(i,40)))); }, { right: () => curPill('gems'), help: () => toast('help') }));
  await p.waitForTimeout(400); await p.screenshot({ path: 'shots2/11-sub.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  console.log('after esc', await p.evaluate(() => [CUR, document.activeElement.outerHTML.slice(0, 80)]));
  for (const t of ['shop', 'league', 'profile']) { await p.click(`.tabs button[data-tab="${t}"]`); await p.waitForTimeout(300); await p.screenshot({ path: `shots2/12-${t}.png` }); }
  await p.setViewportSize({ width: 360, height: 640 }); await p.click(`.tabs button[data-tab="play"]`); await p.waitForTimeout(300); await p.screenshot({ path: 'shots2/13-play-small.png' });
  console.log('hscroll', await p.evaluate(() => [document.querySelector('#views').scrollWidth, document.querySelector('#views').clientWidth]));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
