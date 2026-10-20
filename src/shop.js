/* ================= shop ================= */
// The Shop tab: trivet+, chests, Sparks and Gems bundles (simulated checkout), boosters for Gems and the free corner.
// Real-money prices only ever go through mockPurchase(); ads only through mockAd().
const SHOP_SPARKS = [[1e4, '£0.99'], [6e4, '£4.99'], [15e4, '£9.99'], [35e4, '£19.99'], [1e6, '£49.99'], [3e6, '£99.99', 'Best value']];
const SHOP_GEMS = [[80, '£0.99'], [500, '£4.99'], [1200, '£9.99'], [2500, '£19.99'], [6500, '£49.99'], [14000, '£99.99', 'Best value']];
const SHOP_BOOSTS = {
  swaps: { packs: [[5, 25], [25, 100], [70, 250]], help: 'Once per hand, trade a chip in your hand for a random chip from the bag.', off: true },
  peeks: { packs: [[5, 25], [25, 100], [70, 250]], help: 'Once per hand, see one chip the next rival holds.', off: true },
  spins: { packs: [[10, 25], [50, 100], [140, 250]], help: 'One pull on Lucky Reels.' },
};
const SHOP_BOOST_TIER = [1, 3, 5];
const SHOP_TAG = { Popular: RARITY.rare.col, 'Best value': RARITY.legendary.col };
const SHOP_COL = { sparks: '#FFB37A', gems: '#5DB9F5', swaps: '#93D670', peeks: '#A99CF4', spins: '#FF8F70', wooden: '#E2AE77', silver: '#C9D2DE', golden: '#F3C452' };
// Today's five free rewards, unlocked in order; the last one is a mystery box.
const SHOP_ADS = [{ type: 'sparks', n: 1000 }, { type: 'gems', n: 5 }, { type: 'spins', n: 2 }, { type: 'peeks', n: 1 }, { type: 'mystery' }];
const SHOP_MYSTERY = { common: .5, rare: .35, epic: .13, legendary: .02 };
const SHOP_PLUS = { gems: 50, spins: 2, days: 30, price: '£4.99' };
// Pile layouts by tier: [x%, y%, size (share of the pile height), tilt]. Lower icons sit in front.
const SHOP_PILES = [
  [[50, 52, .74, 0]],
  [[36, 58, .6, -10], [64, 44, .62, 8]],
  [[50, 34, .56, 0], [29, 64, .56, -12], [71, 64, .56, 12]],
  [[37, 36, .5, -8], [63, 36, .5, 8], [22, 68, .5, -14], [50, 70, .52, 0], [78, 68, .5, 14]],
  [[50, 20, .46, 0], [33, 42, .46, -8], [67, 42, .46, 8], [18, 72, .46, -16], [40, 74, .48, -4], [60, 74, .48, 4], [82, 72, .46, 16]],
  [[50, 14, .42, 0], [35, 34, .44, -8], [65, 34, .44, 8], [22, 56, .44, -14], [50, 52, .46, 0], [78, 56, .44, 14], [16, 80, .42, -18], [38, 82, .44, -6], [62, 82, .44, 6], [84, 80, .42, 18]],
];
const SHOP_Q = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.7"/><circle cx="12" cy="17.3" r="1.05" fill="currentColor" stroke="none"/></svg>';
const SHOP_STAR = '<svg class="cur" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 3.2l3.8 7.7 8.5 1.2-6.2 6 1.5 8.5L16 22.6l-7.6 4 1.5-8.5-6.2-6 8.5-1.2z" fill="url(#g-gold)" stroke="#000" stroke-opacity=".18" stroke-linejoin="round"/><path d="M13.6 11.6l1.7-3.4" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/></svg>';

const shopShort = short;
function shopMidnight() { const m = new Date(); m.setHours(24, 0, 0, 0); return durText(m - Date.now()); }
function shopFocus(sel) { const t = $(`#app > .screen:not([hidden]) ${sel}`); if (t) t.focus({ preventScroll: true }); return !!t; }
const shopGemPrice = n => h('span', { class: 'shop-gp', html: curIcon('gems', 16) + `<span>${fmt(n)}</span>` });

/* ---------- the tab ---------- */
function shopView(v) {
  v.append(h('h1', { class: 'pagetitle' }, 'Shop'), shopPlusCard(),
    shopSec('chests', 'Chests', 'Opened with Gems', h('div', { class: 'shop-grid' }, Object.keys(CHESTS).map(shopChestTile))),
    shopSec('sparks', 'Sparks', 'Simulated checkout', h('div', { class: 'shop-grid' }, SHOP_SPARKS.map((b, i) => shopBundleTile('sparks', b, i)))),
    shopSec('gems', 'Gems', 'Simulated checkout', h('div', { class: 'shop-grid' }, SHOP_GEMS.map((b, i) => shopBundleTile('gems', b, i)))),
    shopBoosts(), shopFree(),
    h('p', { class: 'shop-fine', html: `${icon('info', 16)}<span>Prototype store: purchases are simulated and nothing is charged.</span>` }));
  shopFloats();
  // goShop(section): consume the jump now, scroll once the lobby has laid out (setTab resets the scroll first).
  const jump = UIH.shopJump; UIH.shopJump = null;
  if (jump) requestAnimationFrame(() => shopScrollTo(jump));
}
function shopSec(key, title, note, ...kids) {
  return h('section', { class: 'shop-sec', 'data-sec': key, 'aria-labelledby': 'shop-h-' + key },
    h('h2', { class: 'sec shop-h', id: 'shop-h-' + key, tabindex: '-1', 'data-jump': '' }, title, note ? h('small', {}, note) : null), ...kids);
}
// Scroll a section (or booster group) to the top of the lobby and put focus on its heading.
function shopScrollTo(key, smooth) {
  const box = $('#views'), sec = box && box.querySelector(`[data-sec="${CSS.escape(key)}"]`);
  if (!sec) return false;
  const top = box.scrollTop + sec.getBoundingClientRect().top - box.getBoundingClientRect().top - 6;
  box.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  const hd = sec.querySelector('[data-jump]');
  if (hd) hd.focus({ preventScroll: true });
  return true;
}
function shopGetGems() { if (CUR === 'home' && UIH.tab === 'shop') shopScrollTo('gems', true); else goShop('gems'); }

// A store tile: art on top, the amount in Fraunces, the price in a pill, an optional corner tag.
function shopTile(o) {
  const b = h('button', { class: 'shop-tile' + (o.cls ? ' ' + o.cls : ''), 'data-fk': o.fk, 'aria-label': o.label, 'data-tag': o.tag ? '' : null, style: (o.tag ? `--tc:${SHOP_TAG[o.tag]};` : '') + (o.style || '') },
    o.tag ? h('span', { class: 'shop-tag', 'aria-hidden': 'true' }, o.tag) : null,
    h('span', { class: 'shop-art', 'aria-hidden': 'true' }, o.art),
    h('b', { class: 'shop-amt', 'aria-hidden': 'true' }, o.amt),
    h('span', { class: 'shop-price', 'aria-hidden': 'true' }, o.price));
  b.addEventListener('click', o.onClick);
  return b;
}
function shopPile(k, tier, ht = 56) {
  const L = SHOP_PILES[clamp(tier, 1, SHOP_PILES.length) - 1];
  const el = h('span', { class: 'shop-pile', style: `--gc:${SHOP_COL[k]};--gl:${(.25 + tier * .12).toFixed(2)};width:${Math.round(ht * 1.5)}px;height:${ht}px`, 'aria-hidden': 'true' });
  [...L].sort((a, b) => a[1] - b[1]).forEach(([x, y, s, r]) => el.append(h('span', { style: `left:${x}%;top:${y}%;transform:translate(-50%,-50%) rotate(${r}deg)`, html: curIcon(k, Math.round(s * ht)) })));
  return el;
}

/* ---------- trivet+ ---------- */
function shopPerkArt(sm) {
  const D = [['sparks', '#FFB37A'], ['gems', '#5DB9F5'], ['chest-golden', '#F3C452', 1], ['spins', '#FF8F70'], ['star', '#B386FF']];
  return h('span', { class: 'shop-perks' + (sm ? ' sm' : ''), 'aria-hidden': 'true' },
    D.map(([k, c, big], i) => h('span', { class: 'shop-perk' + (big ? ' big' : ''), style: `--dc:${c};z-index:${3 - Math.abs(i - 2)}`, html: k === 'star' ? SHOP_STAR : curIcon(k, 28) })));
}
function shopPlusCard() {
  const on = plusActive(), card = h('section', { class: 'shop-plus' + (on ? ' is-on' : ''), 'data-sec': 'plus', 'aria-labelledby': 'shop-h-plus' });
  card.append(h('div', { class: 'shop-pstage' }, shopPerkArt()),
    h('h2', { class: 'shop-ptitle', id: 'shop-h-plus', tabindex: '-1', 'data-jump': '' }, 'trivet', h('em', {}, '+')),
    h('p', { class: 'shop-pline' }, 'Unlock daily rewards and perks.'));
  if (!on) {
    const get = h('button', { class: 'btn cta wide shop-pbtn', 'data-fk': 'shop-plus-get' }, `Get trivet+ · ${SHOP_PLUS.price}`);
    get.addEventListener('click', shopPlusSheet);
    card.append(get);
    return card;
  }
  const days = Math.max(1, Math.ceil((S.plus.until - Date.now()) / 864e5));
  card.append(h('p', { class: 'shop-pstat' }, h('span', { class: 'shop-pon', html: icon('check', 12) }), h('span', {}, h('b', {}, 'Active'), ` · ${days} day${days === 1 ? '' : 's'} left · simulated`)));
  if (S.plus.lastDay !== dayKey()) {
    const c = h('button', { class: 'btn cta wide shop-pbtn', 'data-fk': 'shop-plus-claim' }, `Claim today's ${SHOP_PLUS.gems} Gems + ${SHOP_PLUS.spins} Spins`);
    c.addEventListener('click', () => shopPlusClaim(() => shopFocus('#shop-h-plus')));
    card.append(c);
  } else card.append(h('p', { class: 'shop-pdone' }, `Today's ${SHOP_PLUS.gems} Gems and ${SHOP_PLUS.spins} Spins are yours. More in ${shopMidnight()}.`));
  const x = h('button', { class: 'shop-plink', 'data-fk': 'shop-plus-cancel' }, 'Cancel trivet+');
  x.addEventListener('click', shopPlusCancel);
  card.append(x);
  return card;
}
function shopPlusClaim(onDone) {
  if (!plusActive()) { toast('Your trivet+ membership has ended'); if (sheetOpen()) closeSheet(); refresh(); return; }
  if (S.plus.lastDay === dayKey()) return;
  S.plus.lastDay = dayKey();
  revealRewards([{ type: 'gems', n: SHOP_PLUS.gems }, { type: 'spins', n: SHOP_PLUS.spins }], { title: 'trivet+ daily', eyebrow: 'Member reward', onDone });
}
function shopPlusSheet() {
  sheet((p, close) => {
    const perk = (art, t, s) => h('li', {}, h('span', { class: 'shop-plart', 'aria-hidden': 'true' }, art), h('div', {}, h('b', {}, t), h('span', {}, s)));
    const pair = h('span', { class: 'shop-pair', html: curIcon('gems', 26) + curIcon('spins', 26) });
    const glow = h('span', { class: 'shop-avaglow' }, myAvatarEl(34));
    p.append(h('div', { class: 'eyebrow shop-eyebrow' }, 'Membership'), h('h3', {}, 'trivet+'), h('p', {}, 'Unlock daily rewards and perks.'),
      h('ul', { class: 'shop-perklist' },
        perk(pair, `${SHOP_PLUS.gems} Gems and ${SHOP_PLUS.spins} Spins every day`, 'Claim them here in the Shop or in Free rewards.'),
        perk(h('span', { class: 'shop-gift', html: icon('gift', 22) }), 'Daily gift doubled', '400 Sparks a day on the Play tab, up from 200.'),
        perk(glow, 'A trivet+ glow on your avatar', 'Your Profile picture shines while you are a member.')),
      h('p', { class: 'shop-note', html: `${icon('info', 16)}<span>A simulated membership: it lasts ${SHOP_PLUS.days} days, nothing is charged and you can cancel any time.</span>` }));
    const go = h('button', { class: 'btn cta' }, `Get trivet+ · ${SHOP_PLUS.price}`);
    go.addEventListener('click', () => { if (!sheetOpen()) return; close(); setTimeout(shopPlusBuy, 300); });
    p.append(h('div', { class: 'btnrow shop-row' }, h('button', { class: 'btn', onclick: close }, 'Not now'), go));
  }, { label: 'trivet+' });
}
function shopPlusBuy() {
  mockPurchase({
    title: `trivet+ · ${SHOP_PLUS.days} days`, price: SHOP_PLUS.price, iconEl: shopPerkArt(true),
    sub: `${SHOP_PLUS.gems} Gems and ${SHOP_PLUS.spins} Spins every day, a doubled daily gift and a glow on your avatar for ${SHOP_PLUS.days} days. It does not renew.`,
    onSuccess: () => {
      S.plus.until = Date.now() + SHOP_PLUS.days * 864e5; save(); refresh();
      toast(`trivet+ is on for ${SHOP_PLUS.days} days`);
      shopFocus('[data-fk="shop-plus-claim"]') || shopFocus('#shop-h-plus');
    },
  });
}
function shopPlusCancel() {
  sheet((p, close) => {
    p.append(h('h3', {}, 'Cancel trivet+?'), h('p', {}, 'Your daily Gems and Spins, the doubled gift and the avatar glow stop straight away. The membership is simulated, so nothing is charged or refunded.'));
    const ok = h('button', { class: 'btn cta' }, 'Cancel trivet+');
    ok.addEventListener('click', () => {
      if (!sheetOpen()) return;
      S.plus.until = 0; save(); close(); refresh(); toast('trivet+ cancelled');
      shopFocus('[data-fk="shop-plus-get"]');
    });
    p.append(h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Keep trivet+'), ok));
  }, { label: 'Cancel trivet+' });
}

/* ---------- chests ---------- */
function shopChestTile(id) {
  const c = CHESTS[id];
  return shopTile({ fk: 'shop-chest-' + id, cls: 'shop-chest', style: `--gc:${SHOP_COL[id]}`, label: `${c.name}, ${amountText('gems', c.gems)}. See what is inside`,
    art: h('span', { class: 'shop-glow', html: curIcon('chest-' + id, 60) }), amt: c.name.replace(/ Chest$/, ''), price: shopGemPrice(c.gems), onClick: () => shopChestSheet(id) });
}
// What a chest holds, read straight from CHESTS so the sheet always matches the roll.
function shopChestRows(c) {
  const W = ['', 'one', 'two', 'three'], bn = c.boostN, bk = c.boosts;
  const sure = c.items.filter(p => p >= 1).length, maybe = c.items.filter(p => p < 1);
  let items = sure ? `${sure} guaranteed item${sure === 1 ? '' : 's'}` : '';
  maybe.forEach(p => { items = items ? `${items}, plus a ${pct(p)} chance of ${sure === 1 ? 'a second' : 'another'}` : `A ${pct(p)} chance of an item`; });
  const row = (art, t, s) => h('li', {}, h('span', { class: 'shop-iart', 'aria-hidden': 'true', html: art }), h('div', {}, h('b', {}, t), h('span', {}, s)));
  return [
    row(curIcon('sparks', 30), `${fmt(c.sparks[0])}–${fmt(c.sparks[1])} Sparks`, 'Straight into your bankroll'),
    row(`<span class="shop-trio">${curIcon('swaps', 20)}${curIcon('peeks', 20)}${curIcon('spins', 20)}</span>`,
      bk >= 3 ? `${bn} Swaps, ${bn} Peeks and ${bn} Spins` : bk === 1 ? `${bn} of one booster` : `${bn} each of ${W[bk] || bk} boosters`,
      bk >= 3 ? 'All three boosters' : 'Swaps, Peeks or Spins, picked at random'),
    row(curIcon('box-' + c.rarity, 30), items, 'Avatars, emotes and table styles. Repeats turn into Gems.'),
  ];
}
function shopChestSheet(id) {
  const c = CHESTS[id];
  sheet((p, close) => {
    const have = bal('gems'), can = have >= c.gems;
    p.append(h('div', { class: 'eyebrow shop-eyebrow' }, `${RARITY[c.rarity].label} chest`), h('h3', {}, c.name),
      h('div', { class: 'shop-sheetart shop-glow', style: `--gc:${SHOP_COL[id]}`, html: curIcon('chest-' + id, 100) }),
      h('h4', { class: 'shop-sub' }, "What's inside"), h('ul', { class: 'shop-inside' }, shopChestRows(c)),
      h('h4', { class: 'shop-sub' }, 'Item odds'),
      h('ul', { class: 'shop-odds' }, RARITY_ORDER.filter(k => c.odds[k]).map(k => h('li', { style: `--rc:${RARITY[k].col}` }, rarTag(k),
        h('span', { class: 'shop-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.max(2, c.odds[k] * 100)}%` })), h('b', {}, pct(c.odds[k]))))),
      ...(can ? [] : [h('p', { class: 'shop-short' }, `You have ${amountText('gems', have)}. You need ${fmt(c.gems - have)} more.`)]));
    const go = can ? h('button', { class: 'btn cta', 'aria-label': `Open for ${amountText('gems', c.gems)}`, html: `<span>Open ·</span>${shopGemPrice(c.gems).outerHTML}` })
      : h('button', { class: 'btn cta' }, 'Get Gems');
    let used = false;
    go.addEventListener('click', () => {
      if (used || !sheetOpen()) return; used = true;
      close();
      if (can) openChest(id); else shopGetGems();
    });
    p.append(h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Not now'), go));
  }, { label: c.name });
}

/* ---------- Sparks and Gems bundles (simulated checkout) ---------- */
function shopBundleTile(k, [n, price, tag], i) {
  return shopTile({ fk: `shop-${k}-${i}`, tag, label: `${amountText(k, n)} for ${price}${tag ? `. ${tag}` : ''}`,
    art: shopPile(k, i + 1), amt: k === 'sparks' ? shopShort(n) : fmt(n), price, onClick: () => shopBuyBundle(k, n, price, i + 1) });
}
function shopBuyBundle(k, n, price, tier) {
  const rank = bankRank().i;
  mockPurchase({
    title: amountText(k, n), price, iconEl: shopPile(k, tier, 84),
    sub: k === 'sparks' ? 'Sparks go straight into your bankroll.' : 'Gems open chests and buy boosters, avatars and emotes.',
    onSuccess: () => revealRewards([{ type: k, n }], { skipIntro: true, title: 'Purchase complete', onDone: () => { const r = bankRank(); if (r.i > rank) toast(`New rank: ${r.name}. Kiln payouts ×${r.mult}`); } }),
  });
}

/* ---------- boosters (paid in Gems) ---------- */
function shopBoosts() {
  const sec = shopSec('boosts', 'Boosters', 'Paid in Gems');
  Object.keys(SHOP_BOOSTS).forEach(k => {
    const name = CUR_NAME[k][1];
    const q = h('button', { class: 'iconbtn shop-q', 'aria-label': `About ${name}`, 'data-fk': 'shop-help-' + k, html: SHOP_Q });
    q.addEventListener('click', () => shopHelpSheet(k));
    sec.append(h('div', { class: 'shop-group', 'data-sec': k },
      h('div', { class: 'shop-ghead' }, h('span', { class: 'shop-gicon', html: curIcon(k, 26) }),
        h('h3', { tabindex: '-1', 'data-jump': '' }, name), h('span', { class: 'shop-have' }, `You have ${fmt(bal(k))}`), q),
      h('div', { class: 'shop-grid' }, SHOP_BOOSTS[k].packs.map(([n, g], i) => shopTile({ fk: `shop-${k}-${i}`, label: `${amountText(k, n)} for ${amountText('gems', g)}`,
        art: shopPile(k, SHOP_BOOST_TIER[i]), amt: fmt(n), price: shopGemPrice(g), onClick: () => shopBoostSheet(k, i) })))));
  });
  return sec;
}
const shopBoostHelp = k => SHOP_BOOSTS[k].help + (SHOP_BOOSTS[k].off ? ' Swaps and Peeks are off in the Daily Tray and the lesson.' : '');
function shopHelpSheet(k) {
  const name = CUR_NAME[k][1];
  sheet((p, close) => {
    p.append(h('div', { class: 'eyebrow shop-eyebrow' }, 'Booster'), h('h3', {}, name),
      h('div', { class: 'shop-sheetart shop-glow', style: `--gc:${SHOP_COL[k]}`, html: curIcon(k, 76) }),
      h('p', { class: 'shop-lead' }, SHOP_BOOSTS[k].help),
      ...(SHOP_BOOSTS[k].off ? [h('p', { class: 'shop-note', html: `${icon('info', 16)}<span>Swaps and Peeks are off in the Daily Tray and the lesson.</span>` })] : []),
      h('p', { class: 'shop-have2' }, `You have ${amountText(k, bal(k))}.`));
    const row = h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Close'));
    if (k === 'spins') { const r = h('button', { class: 'btn cta' }, 'Open Lucky Reels'); r.addEventListener('click', () => { close(); setTimeout(() => openReels(), 300); }); row.append(r); }
    p.append(row);
  }, { label: name });
}
function shopBoostSheet(k, i) {
  const [n, g] = SHOP_BOOSTS[k].packs[i], name = amountText(k, n);
  sheet((p, close) => {
    const have = bal('gems'), can = have >= g;
    const fact = (l, v) => h('div', {}, h('span', {}, l), h('b', {}, v));
    p.append(h('div', { class: 'eyebrow shop-eyebrow' }, 'Booster bundle'), h('h3', {}, name),
      h('div', { class: 'shop-sheetart' }, shopPile(k, SHOP_BOOST_TIER[i], 84)),
      h('p', {}, shopBoostHelp(k)),
      h('div', { class: 'shop-facts' }, fact('PRICE', shopGemPrice(g)), fact('YOU HAVE', shopGemPrice(have))),
      ...(can ? [] : [h('p', { class: 'shop-short' }, `You need ${fmt(g - have)} more ${curName('gems', g - have)}.`)]));
    const go = can ? h('button', { class: 'btn cta', 'aria-label': `Buy ${name} for ${amountText('gems', g)}`, html: `<span>Buy ·</span>${shopGemPrice(g).outerHTML}` })
      : h('button', { class: 'btn cta' }, 'Get Gems');
    let used = false;
    go.addEventListener('click', () => {
      if (used || !sheetOpen()) return; used = true;
      if (!can) { close(); shopGetGems(); return; }
      if (!spend('gems', g)) { close(); toast(`You need ${fmt(g - bal('gems'))} more Gems`); return; }
      close();
      revealRewards([{ type: k, n }], { skipIntro: true, title: 'Purchase complete' });
    });
    p.append(h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Cancel'), go));
  }, { label: name });
}

/* ---------- free corner ---------- */
function shopFreeCard(o) {
  const b = h('button', { class: 'shop-free', 'data-fk': o.fk, 'aria-label': [o.title, o.badge, o.sub].filter(Boolean).join('. ') },
    h('span', { class: 'shop-fart', style: `--fc:${o.col}`, 'aria-hidden': 'true', html: o.art }),
    h('span', { class: 'shop-ftext', 'aria-hidden': 'true' },
      h('span', { class: 'shop-ft1' }, h('b', {}, o.title), o.badge ? h('span', { class: 'shop-badge' }, o.badge) : null),
      h('span', { class: 'shop-fsub' }, o.sub), o.extra || null),
    h('span', { class: 'shop-chev', 'aria-hidden': 'true', html: icon('chev', 16) }));
  b.addEventListener('click', o.onClick);
  return b;
}
function shopFree() {
  const left = adsLeft(), seen = Math.min(ADS_PER_DAY, adState().watched);
  const pips = h('span', { class: 'shop-pips' }, SHOP_ADS.map((_, i) => h('i', { class: i < seen ? 'on' : '' })));
  return shopSec('free', 'Free', `Resets in ${shopMidnight()}`, h('div', { class: 'shop-frees' },
    shopFreeCard({ fk: 'shop-free-ads', col: '#FFB37A', art: icon('gift', 26), title: 'Free rewards', sub: left ? `${left} of ${ADS_PER_DAY} left today` : 'All done for today', extra: pips, onClick: () => freeRewardsSheet() }),
    shopFreeCard({ fk: 'shop-free-wheel', col: '#A99CF4', art: shopWheelSVG(44), title: 'Prize Wheel', sub: 'One free spin every day', badge: wheelFreeReady() ? 'Free spin ready' : null, onClick: () => openWheel() }),
    shopFreeCard({ fk: 'shop-free-reels', col: '#FF8F70', art: shopReelsSVG(44), title: 'Lucky Reels', sub: `Pull with Spins · you have ${fmt(bal('spins'))}`, badge: reelsClaimReady() ? '5 free Spins ready' : null, onClick: () => openReels() })));
}

/* ---------- floating Wheel and Reels buttons ---------- */
function shopWheelSVG(s = 46) {
  const C = ['#FFB37A', '#5DB9F5', '#93D670', '#A99CF4', '#FF8F70', '#F3C452', '#E596D6', '#76CFC0'], R = 17;
  const xy = (r, d) => [24 + r * Math.cos(d * Math.PI / 180), 24 + r * Math.sin(d * Math.PI / 180)].map(n => n.toFixed(2));
  let w = '', bulbs = '';
  // eight wedges, the first centred under the pointer; a bulb on the rim at every seam
  for (let i = 0; i < 8; i++) {
    const a = i * 45 - 112.5, [x0, y0] = xy(R, a), [x1, y1] = xy(R, a + 45), [bx, by] = xy(20.4, a);
    w += `<path d="M24 24L${x0} ${y0}A${R} ${R} 0 0 1 ${x1} ${y1}Z" fill="${C[i]}"/>`;
    bulbs += `<circle cx="${bx}" cy="${by}" r="1.15" fill="#FFF3D6"/>`;
  }
  return `<svg class="shop-wheel" width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="22.5" fill="#2A2232"/><circle cx="24" cy="24" r="22.5" fill="none" stroke="url(#g-gold)" stroke-width="1.6"/>`
    + `<g class="shop-wspin">${w}<circle cx="24" cy="24" r="${R}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="2"/><path d="M14 13.5a14 14 0 0 1 9-4" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" fill="none" stroke-linecap="round"/></g>${bulbs}`
    + `<circle cx="24" cy="24" r="5.4" fill="url(#g-gold)" stroke="#000" stroke-opacity=".3"/><circle cx="24" cy="24" r="1.9" fill="#7A5418"/>`
    + `<path d="M24 11.6l-3.7-6.8h7.4z" fill="#FFF6EE" stroke="#2A2232" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
}
function shopReelsSVG(s = 46) {
  return `<svg class="shop-reels" width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true" focusable="false">`
    + `<path d="M37.5 30h2.6a1.5 1.5 0 0 0 1.5-1.5V15" stroke="#C2CAD6" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="41.6" cy="12.6" r="3.6" fill="#FF4F5E"/><circle cx="40.6" cy="11.5" r="1.1" fill="#fff" fill-opacity=".7"/>`
    + `<rect x="5" y="9.5" width="33" height="33" rx="8" fill="url(#g-spins)"/><rect x="5" y="9.5" width="33" height="33" rx="8" fill="none" stroke="#000" stroke-opacity=".22"/>`
    + `<rect x="10" y="4.5" width="23" height="9" rx="4.5" fill="url(#g-gold)"/><circle cx="15.5" cy="9" r="1.3" fill="#fff"/><circle cx="21.5" cy="9" r="1.3" fill="#fff"/><circle cx="27.5" cy="9" r="1.3" fill="#fff"/>`
    + `<rect x="9" y="17" width="25" height="15" rx="3.5" fill="#FFF6EE"/><path d="M17.3 17v15M25.7 17v15" stroke="#D9472F" stroke-opacity=".3"/>`
    + `<path d="M13.2 20.6Q13.8 23.9 17 24.5Q13.8 25.1 13.2 28.4Q12.6 25.1 9.4 24.5Q12.6 23.9 13.2 20.6Z" fill="#FF9D5C"/>`
    + `<path d="M21.5 20.8l3.2 3.7-3.2 3.9-3.2-3.9z" fill="#3E8FE6"/><circle cx="29.8" cy="24.5" r="3" fill="#4FAE45"/>`
    + `<rect x="10" y="35" width="23" height="4" rx="2" fill="#000" fill-opacity=".25"/></svg>`;
}
function shopFloats() {
  const mk = (key, name, ready, art, fn, side) => {
    const b = h('button', { class: `shop-float shop-float-${side}${ready ? ' is-ready' : ''}`, 'data-fk': 'shop-float-' + key, 'aria-label': ready ? `${name}, ${key === 'reels' ? '5 free Spins to claim' : 'free spin ready'}` : name, html: art },
      ready ? h('i', { class: 'shop-dot', 'aria-hidden': 'true' }) : null);
    b.addEventListener('click', () => fn());
    homeFloat(b);
  };
  mk('wheel', 'Prize Wheel', wheelFreeReady(), shopWheelSVG(44), openWheel, 'l');
  mk('reels', 'Lucky Reels', reelsClaimReady(), shopReelsSVG(44), openReels, 'r');
}

/* ---------- free rewards sheet ---------- */
const shopAdName = r => r.type === 'mystery' ? 'Mystery Box' : amountText(r.type, r.n);
const shopAdIcon = (r, s) => r.type === 'mystery' ? h('span', { class: 'ricon shop-myst', style: `--rs:${s}px`, html: curIcon('box-epic', s) }) : rewardIconEl(r, s);
function shopMysteryRoll(r = Math.random) {
  let x = r();
  for (const k of RARITY_ORDER) if (SHOP_MYSTERY[k]) { x -= SHOP_MYSTERY[k]; if (x < 0) return k; }
  return 'common';
}
// Reopen the sheet after a reveal so the next slot is one tap away.
function shopFreeAgain() { setTimeout(() => { if ((CUR === 'home' || CUR === 'sub') && !sheetOpen() && !overlayOpen()) freeRewardsSheet(); }, 320); }
// mockAd has already counted the watch for whichever day it is now, so the slot is read from that, not from when the ad began.
function shopAdReward() {
  const st = adState(), slot = Math.min(ADS_PER_DAY, st.watched) - 1, r = SHOP_ADS[slot]; if (!r) return;
  if (!st.got.includes(slot)) st.got.push(slot);
  if (r.type === 'mystery') { st.mystery = true; revealRewards([{ type: 'box', rarity: shopMysteryRoll() }], { title: 'Mystery Box', eyebrow: 'Mystery reward', onDone: shopFreeAgain }); }
  else revealRewards([{ ...r }], { skipIntro: true, title: 'Free reward', onDone: shopFreeAgain });
}
function freeRewardsSheet() {
  sheet((p, close) => {
    const st = adState(), done = Math.min(ADS_PER_DAY, st.watched), left = adsLeft(), next = SHOP_ADS[done];
    p.append(h('div', { class: 'eyebrow shop-eyebrow' }, 'Today'), h('h3', {}, 'Free rewards'),
      h('p', {}, left ? 'Watch a short placeholder clip to collect each reward. They unlock in order.' : 'You have collected all five. New rewards arrive at midnight.'));
    if (plusActive() && S.plus.lastDay !== dayKey()) {
      const c = h('button', { class: 'btn cta smallbtn', 'data-fk': 'shop-fr-plus', 'aria-label': `Claim trivet+ daily: ${SHOP_PLUS.gems} Gems and ${SHOP_PLUS.spins} Spins` }, 'Claim');
      c.addEventListener('click', () => shopPlusClaim(shopFreeAgain));
      p.append(h('div', { class: 'shop-frplus' }, h('span', { class: 'shop-pair', 'aria-hidden': 'true', html: curIcon('gems', 26) + curIcon('spins', 26) }),
        h('div', {}, h('b', {}, 'trivet+ daily'), h('span', {}, `${SHOP_PLUS.gems} Gems + ${SHOP_PLUS.spins} Spins, ready now`)), c));
    }
    p.append(h('ol', { class: 'shop-slots' }, SHOP_ADS.map((r, i) => {
      const s = i < done ? 'done' : i === done ? 'next' : 'locked';
      return h('li', { class: 'shop-slot is-' + s },
        h('span', { class: 'sr-only' }, `${i + 1}. ${shopAdName(r)}: ${s === 'done' ? 'collected' : s === 'next' ? 'up next' : 'locked'}`),
        h('span', { class: 'shop-sicon', 'aria-hidden': 'true' }, shopAdIcon(r, 30)),
        h('b', { 'aria-hidden': 'true' }, r.type === 'mystery' ? '???' : fmt(r.n)),
        h('span', { class: 'shop-sstate', 'aria-hidden': 'true', html: s === 'done' ? icon('check', 12) : s === 'locked' ? icon('lock', 12) : 'Next' }));
    })));
    p.append(h('div', { class: 'shop-frstat' }, h('b', {}, left ? `${left} of ${ADS_PER_DAY} left today` : 'All done for today'), h('span', { html: `${icon('clock', 14)}Resets in ${shopMidnight()}` })),
      h('p', { class: 'shop-mystery' }, h('span', {}, '??? is a Mystery Box:'), ...RARITY_ORDER.filter(k => SHOP_MYSTERY[k]).map(k => h('span', { class: 'shop-mo', style: `--rc:${RARITY[k].col}` }, `${RARITY[k].label} ${pct(SHOP_MYSTERY[k])}`))));
    const row = h('div', { class: 'btnrow shop-row' }, h('button', { class: 'btn', onclick: close }, 'Close'));
    if (next && left) {
      const w = h('button', { class: 'btn cta', 'data-fk': 'shop-fr-watch', 'aria-label': `Watch to collect ${shopAdName(next)}`, html: `${icon('ad', 20)}<span>Watch · ${shopAdName(next)}</span>` });
      w.addEventListener('click', () => {
        if (!sheetOpen()) return;
        const slot = adState().watched; if (slot >= ADS_PER_DAY) { close(); return; }
        mockAd(shopAdReward, { label: shopAdName(SHOP_ADS[slot]) });
      });
      row.append(w);
    }
    p.append(row);
  }, { label: 'Free rewards' });
}
