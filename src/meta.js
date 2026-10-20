/* ================= lobby ================= */
const UIH = { tab: 'play', cat: 'glaze', carX: null, shopJump: null };
const TAB_LABEL = { shop: 'Shop', play: 'Play', league: 'League', profile: 'Profile' };
const TAB_ICON = { shop: 'shop', play: 'play', league: 'league', profile: 'profile' };
function setTab(t) { if (UIH.tab !== t) UIH.carX = null; UIH.tab = t; renderHome(); $('#views').scrollTop = 0; }
// Open the shop at a section ('sparks', 'gems', 'chests', 'boosts'); shopView scrolls there and clears the jump.
function goShop(sec) { UIH.shopJump = sec || null; if (CUR !== 'home') go('home'); setTab('shop'); }
// Lobby controls are rebuilt on every change; data-fk keys let focus return to the same control afterwards.
function renderHome() {
  if (S.kiln.week !== isoWeekNum()) { settleKiln(); save(); }
  ensureSeason();
  $$('.tabs button').forEach(b => { b.innerHTML = icon(TAB_ICON[b.dataset.tab], 22) + `<span>${TAB_LABEL[b.dataset.tab]}</span>`; b.setAttribute('aria-current', b.dataset.tab === UIH.tab ? 'page' : 'false'); });
  $$('#home > .hfloat').forEach(e => e.remove());
  rebuildViews($('#views'), v => {
    v.append(topBar(UIH.tab));
    ({ shop: shopView, play: playView, league: kilnView, profile: profileView })[UIH.tab](v);
  });
}
// Controls that float over the lobby (e.g. the shop's Wheel and Reels buttons). Cleared on every lobby render.
function homeFloat(el) { el.classList.add('hfloat'); $('#home').insertBefore(el, $('#home > .tabs')); return el; }
function topBar(tab) {
  const gems = curPill('gems', { onClick: () => goShop('gems') });
  const sp = curPill('sparks', { onClick: () => goShop('sparks') });
  if (tab === 'play') return h('div', { class: 'topbar' }, gems, h('span'), seasonRing());
  if (tab === 'shop') {
    const free = h('button', { class: 'iconbtn' + (adsLeft() > 0 ? ' dot' : ''), 'aria-label': `Free rewards${adsLeft() > 0 ? `, ${adsLeft()} left today` : ''}`, 'data-fk': 'free', html: icon('gift', 20) });
    free.addEventListener('click', freeRewardsSheet);
    return h('div', { class: 'topbar' }, gems, sp, free);
  }
  if (tab === 'league') {
    const ring = h('button', { class: 'lvlbtn', 'aria-label': `Level ${level().level}. Open profile`, 'data-fk': 'lvl' }, lvlRing());
    ring.addEventListener('click', () => setTab('profile'));
    const info = h('button', { class: 'iconbtn', 'aria-label': 'How the league works', 'data-fk': 'kilnhow', html: icon('info', 20) });
    info.addEventListener('click', kilnHowSheet);
    return h('div', { class: 'topbar' }, ring, sp, info);
  }
  const gear = h('button', { class: 'iconbtn', 'aria-label': 'Settings', 'data-fk': 'gear', html: icon('gear', 20) });
  gear.addEventListener('click', settingsSheet);
  return h('div', { class: 'topbar' }, gems, sp, gear);
}
const unlocked = vk => level().level >= V[vk].unlock;
function prizeText(vk, long) { const pz = V[vk].prizes; return pz.length === 1 ? `${long ? 'Prize ' : ''}${fmt(pz[0])}` : `${long ? 'Prizes ' : ''}${pz.map(fmt).join(' / ')}`; }
const VENUE_ART = { cafe: ['☕', '#FFD9C2'], noodle: ['🍜', '#FFE7A8'], tea: ['🍵', '#CDEBD6'], supper: ['🍷', '#E3D3F7'], glasshouse: ['🪴', '#CFE0FA'] };

function playView(v) {
  const today = dayKey();
  const kr = S.kiln.result;
  if (kr && !kr.seen) {
    const moveTxt = kr.move === 'up' ? `Promoted to ${Scoop.KILN.tiers[kr.to]}` : kr.move === 'down' ? `Dropped to ${Scoop.KILN.tiers[kr.to]}` : `Staying in ${Scoop.KILN.tiers[kr.to]}`;
    const c = h('div', { class: 'card', style: 'margin:6px 0 12px' }, h('div', { class: 'eyebrow' }, 'Last week in the Kiln'),
      h('p', { style: 'margin-top:8px;font-weight:700' }, `${ord(kr.place)} of 20 in ${Scoop.KILN.tiers[kr.from]} with ${fmt(kr.xp)} XP. ${moveTxt}.`),
      h('p', { style: 'color:var(--muted);font-size:13px;margin-top:4px' }, `+${fmt(kr.reward)} Sparks added${kr.rankMult > 1 ? ` (×${kr.rankMult} for your rank)` : ''}.${kr.rim ? ' Gold Leaf Rim glaze unlocked.' : ''}`));
    const ok = h('button', { class: 'btn smallbtn', style: 'margin-top:12px', 'data-fk': 'krseen' }, kr.move === 'down' ? 'Got it' : 'Nice');
    ok.addEventListener('click', () => { kr.seen = true; save(); renderHome(); });
    c.append(ok); v.append(c);
  }
  // bankroll
  const rk = bankRank();
  const rchip = h('button', { class: 'rankchip', style: `--rank:${rk.col}`, 'data-fk': 'rank', 'aria-label': `${rk.name} rank. See every rank` }, rankBadge(rk.i, 22), h('span', {}, `${rk.name} rank`), h('span', { class: 'rchev', html: icon('chev', 14) }));
  rchip.addEventListener('click', rankSheet);
  v.append(h('section', { class: 'bankroll', 'aria-label': 'Your Sparks' },
    h('div', { class: 'bigbal' }, h('span', { html: curIcon('sparks', 34) }), h('b', { class: 'num', style: `--len:${fmt(S.sparks).length}` }, fmt(S.sparks))),
    h('div', { class: 'eyebrow' }, 'Sparks'), rchip));
  // gifts
  const gifts = h('div', { class: 'giftrow' });
  if (S.giftDay !== today) {
    const b = h('button', { class: 'btn cta smallbtn', 'data-fk': 'gift' }, 'Claim');
    const gv = plusActive() ? 400 : 200;
    b.addEventListener('click', () => { S.giftDay = today; addSparks(gv); save(); toast(`${gv} Sparks added`); renderHome(); });
    gifts.append(h('div', { class: 'card' }, h('div', {}, h('b', {}, 'Daily gift'), h('span', {}, `+${gv} Sparks${plusActive() ? ' · doubled by trivet+' : ''}`)), b));
  }
  const refillReady = S.sparks < 100 && Date.now() - (S.refillAt || 0) > 4 * 36e5;
  if (refillReady) {
    const b = h('button', { class: 'btn cta smallbtn', 'data-fk': 'refill' }, 'Refill');
    b.addEventListener('click', () => { S.refillAt = Date.now(); S.sparks = Math.max(S.sparks, 300); save(); toast('Topped up to 300 Sparks'); renderHome(); });
    gifts.append(h('div', { class: 'card' }, h('div', {}, h('b', {}, 'Running low'), h('span', {}, 'Top up to 300, every 4 hours')), b));
  }
  if (gifts.children.length) v.append(gifts);
  // tables carousel
  const cards = [];
  if (!S.tutorialDone) {
    const skip = h('button', { class: 'gskip', 'data-fk': 'skiplesson' }, 'I know how to play');
    skip.addEventListener('click', () => { S.tutorialDone = true; save(); UIH.carX = null; renderHome(); });
    cards.push(gameCard({ key: 'lesson', art: ['📖', '#F3E6D3'], eyebrow: 'New here', title: 'Learn Scoop in forty seconds', terms: 'Three quick lessons on a real table. Your first match is free.', cta: { label: 'Start the lesson', onClick: startTutorial }, extra: skip }));
  }
  const played = S.daily.lastDay === today, wonToday = S.daily.lastWonDay === today;
  const streakShown = (wonToday || S.daily.lastWonDay === dayKey(new Date(Date.now() - 864e5))) ? S.daily.streak : 0;
  const dExtra = h('div', { class: 'gextra' }, h('div', { class: 'streak', role: 'img', 'aria-label': `Win streak ${streakShown} day${streakShown === 1 ? '' : 's'}` }, Array.from({ length: 7 }, (_, i) => h('i', { class: i < streakShown ? 'on' : '' }))));
  if (played && S.daily.line && S.daily.line.includes(`#${dailyNo()} `)) {
    const cb = h('button', { class: 'gcopy', 'data-fk': 'dcopy', 'aria-label': 'Copy today\'s result', html: icon('copy', 16) + '<span>Copy result</span>' });
    cb.addEventListener('click', () => { copyText(S.daily.line, cb); if (trEarn('brag')) renderHome(); });
    dExtra.append(cb);
  }
  cards.push(gameCard({ key: 'daily', art: ['🗓️', '#FFD3DE'], eyebrow: `Daily Tray #${dailyNo()}`, title: played ? (wonToday ? 'Won today' : 'Played today') : 'Beat June',
    terms: played ? 'A new deal arrives at midnight.' : 'Same deal for everyone today. Free to play. A win pays <b>300</b> Sparks plus a streak bonus.',
    cta: { label: played ? 'Back tomorrow' : 'Play · Free', disabled: played, onClick: () => startMatch('tea', { daily: true }) }, extra: dExtra }));
  VENUE_ORDER.forEach(k => {
    const vn = V[k], lock = !unlocked(k), broke = S.sparks < vn.entry, won = S.firstWin[k];
    const rv = h('div', { class: 'grivals' }, vn.rivals.slice(0, 4).map(p => rivalAvaEl(p, 26)), h('span', {}, rivalNames(k)));
    const reward = h('div', { class: 'gnote', html: won ? `${icon('check', 13)} Won here` : `First win: ${itemOf('tray', VENUE_UI[k].tray).name} tray` });
    cards.push(gameCard({ key: k, art: VENUE_ART[k], eyebrow: `${vn.seats} seats · ${VENUE_UI[k].paid}`, title: vn.name, locked: lock,
      terms: `Entry <b>${fmt(vn.entry)}</b> · ${prizeText(k, true).replace(/([\d,]+)/g, '<b>$1</b>')}`,
      cta: lock ? { label: `Opens at level ${vn.unlock}`, disabled: true } : broke ? { label: 'Get Sparks', alt: true, onClick: () => goShop('sparks') } : { label: `Play · ${fmt(vn.entry)}`, onClick: () => startMatch(k) },
      info: () => venueSheet(k), extra: h('div', { class: 'gextra' }, rv, reward) }));
  });
  const car = h('div', { class: 'carousel', role: 'list', 'aria-label': 'Tables' }, cards);
  const dots = h('div', { class: 'cdots', 'aria-hidden': 'true' }, cards.map(() => h('i')));
  v.append(h('h2', { class: 'sec' }, 'Tables', h('small', {}, 'Swipe for more')), car, dots);
  const setDots = () => { const w = car.firstChild ? car.firstChild.getBoundingClientRect().width + 12 : 1, i = Math.round(car.scrollLeft / w); [...dots.children].forEach((d, j) => d.classList.toggle('on', j === i)); };
  car.addEventListener('scroll', () => { UIH.carX = car.scrollLeft; setDots(); }, { passive: true });
  requestAnimationFrame(() => {
    if (UIH.carX != null) car.scrollLeft = UIH.carX;
    else if (S.tutorialDone) { const c = car.querySelector(`[data-key="${unlocked(S.lastVenue) ? S.lastVenue : 'cafe'}"]`); if (c) car.scrollLeft = c.offsetLeft - car.firstChild.offsetLeft; }
    setDots();
  });
  leagueCard(v);
}
// A pastel table card: emoji art, terms, one main action, optional info button and extra rows.
function gameCard(o) {
  const card = h('div', { class: 'gcard' + (o.locked ? ' locked' : ''), role: 'listitem', 'data-key': o.key, style: `--gc:${o.art[1]}` });
  card.append(h('span', { class: 'gart', 'aria-hidden': 'true' }, o.art[0]));
  if (o.info) { const ib = h('button', { class: 'ginfo', 'aria-label': `${o.title} details`, 'data-fk': 'ginfo:' + o.key, html: icon('info', 18) }); ib.addEventListener('click', o.info); card.append(ib); }
  card.append(h('div', { class: 'eyebrow' }, o.eyebrow), h('h3', {}, o.title), h('p', { class: 'gterms', html: o.terms }));
  if (o.extra) card.append(o.extra);
  const b = h('button', { class: 'btn gcta' + (o.cta.alt ? ' alt' : ''), disabled: !!o.cta.disabled, 'data-fk': 'gcta:' + o.key }, o.locked ? h('span', { html: icon('lock', 16) }) : null, o.cta.label);
  if (o.cta.onClick) b.addEventListener('click', o.cta.onClick);
  card.append(b);
  return card;
}
function leagueCard(v) {
  const k = S.kiln, tiers = Scoop.KILN.tiers, rows = kilnRows(k.week, k.tier, k.xp, weekDays()), me = rows.find(r => r.me), est = kilnEstimate(me.rank, k.tier);
  const open = h('button', { class: 'btn cta', 'data-fk': 'openleague' }, 'Open league'); open.addEventListener('click', () => setTab('league'));
  const how = h('button', { class: 'btn', 'data-fk': 'leaguehow' }, 'How it works'); how.addEventListener('click', kilnHowSheet);
  v.append(h('h2', { class: 'sec' }, 'This week', h('small', {}, `Ends in ${untilMonday()}`)),
    h('div', { class: 'card lgcard' },
      h('div', { class: 'lgtop' }, h('span', { class: 'tierbadge', style: `--tier:${TIER_COL[k.tier]}`, 'aria-hidden': 'true' }, tiers[k.tier][0]),
        h('div', {}, h('h3', {}, `${tiers[k.tier]} league`), h('p', {}, `${ord(me.rank)} of 20 · ${fmt(me.xp)} XP`))),
      h('p', { class: 'lgline', html: `If it ended now: <b>+${fmt(est.reward)}</b> Sparks${est.mult > 1 ? ` <span class="multpill">×${est.mult} ${bankRank().name}</span>` : ''}` }),
      h('div', { class: 'btnrow' }, how, open)));
}
function kilnEstimate(rank, tier) {
  const KL = Scoop.KILN, place = rank <= 3 ? KL.placeMult[rank - 1] : rank <= 10 ? 1 : 0.25, mult = bankRank().mult;
  return { reward: Math.round(KL.base[tier] * place * mult), mult };
}
function kilnHowSheet() {
  sheet((p, close) => {
    const tiers = Scoop.KILN.tiers;
    p.append(h('h3', {}, 'How the Kiln works'),
      h('div', { class: 'how' },
        h('div', {}, h('i', {}, '1'), h('span', {}, 'Every match earns XP. Your XP since Monday sets your place among 20 players in your league.')),
        h('div', {}, h('i', {}, '2'), h('span', {}, `On Monday the top 4 move up a league and the bottom 4 drop. Leagues run ${tiers.join(', ')}.`)),
        h('div', {}, h('i', {}, '3'), h('span', {}, 'Everyone is paid in Sparks: top 3 earn the most, places 4–10 the base, and the rest a quarter.')),
        h('div', {}, h('i', {}, '4'), h('span', {}, 'Your bankroll rank multiplies the payout. Rank follows the most Sparks you have ever held.'))),
      h('div', { class: 'rankmults' }, BANK_RANKS.map((r, i) => h('div', { class: bankRank().i === i ? 'me' : '' }, rankBadge(i, 22), h('b', {}, r.name), h('span', {}, `${r.min ? compactK(r.min) + '+' : 'Start'}`), h('em', {}, '×' + r.mult)))),
      h('p', { style: 'font-size:12px;margin-top:12px' }, 'Kiln rivals are simulated players on a weekly schedule.'));
    p.append(h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Close')));
  }, { label: 'How the Kiln works' });
}
// Mirrors lineup() in table.js: Sol always heads the Supper Club and the Glasshouse.
const VENUE_HEAD = { supper: 'sol', glasshouse: 'sol' };
function rivalNames(vk) {
  const seats = V[vk].seats - 1, head = VENUE_HEAD[vk], rest = V[vk].rivals.filter(k => k !== head).map(k => P[k].name);
  const list = a => a.length > 1 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0];
  const pickN = seats - (head ? 1 : 0), words = ['', 'one', 'two', 'three'];
  if (pickN >= rest.length) return list(head ? [P[head].name, ...rest] : rest);
  const drawn = `${words[pickN]} of ${rest.slice(0, -1).join(', ')} or ${rest[rest.length - 1]}`;
  const out = head ? `${P[head].name} and ${drawn}` : drawn;
  return out[0].toUpperCase() + out.slice(1);
}
function venueSheet(vk) {
  const vn = V[vk], lock = !unlocked(vk);
  sheet((p, close) => {
    p.append(h('div', { class: 'eyebrow', style: 'padding-inline:4px;margin-bottom:8px' }, `${vn.seats} seats · ${VENUE_UI[vk].paid}`), h('h3', {}, vn.name), h('p', {}, VENUE_UI[vk].blurb));
    const rv = h('div', { style: 'margin-top:12px' });
    vn.rivals.forEach(k => rv.append(h('div', { class: 'rivalrow' }, rivalAvaEl(k, 44), h('div', {}, h('b', {}, `${P[k].name} · ${P[k].title}`), h('i', {}, `“${P[k].line}”`)))));
    p.append(rv, h('div', { class: 'facts' },
      h('div', {}, h('span', {}, 'ENTRY'), h('b', {}, fmt(vn.entry))),
      h('div', {}, h('span', {}, vn.prizes.length > 1 ? 'PRIZES' : 'PRIZE'), h('b', {}, vn.prizes.map(fmt).join(' · '))),
      h('div', {}, h('span', {}, 'XP'), h('b', {}, '×' + vn.xpMult))),
      h('p', { style: 'margin-top:14px;font-size:13px' }, `Aids: ${S.settings.pro ? 'Pro view is on, so heat shows as colour only' : AID_TEXT[vn.aids]}.${vn.timer ? ` ${vn.timer}-second turns.` : ''}`));
    const b = h('button', { class: 'btn cta', disabled: lock || S.sparks < vn.entry }, lock ? `Opens at level ${vn.unlock}` : S.sparks < vn.entry ? `Needs ${fmt(vn.entry)} Sparks` : `Sit down · ${fmt(vn.entry)}`);
    let used = false;
    b.addEventListener('click', () => { if (used || !sheetOpen()) return; used = true; close(); startMatch(vk); });
    p.append(h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Not now'), b));
  }, { label: vn.name });
}
const compactK = short;

/* ---------- kiln ---------- */
function kilnView(v) {
  const k = S.kiln, tiers = Scoop.KILN.tiers, rows = kilnRows(k.week, k.tier, k.xp, weekDays()), me = rows.find(r => r.me);
  const est = kilnEstimate(me.rank, k.tier), reward = est.reward;
  v.append(h('h1', { class: 'pagetitle' }, 'The Kiln'),
    h('div', { class: 'kilnhead' }, h('span', { class: 'tierbadge', style: `--tier:${TIER_COL[k.tier]}`, 'aria-hidden': 'true' }, tiers[k.tier][0]),
      h('div', {}, h('h2', {}, `${tiers[k.tier]} league`), h('p', {}, `Ends in ${untilMonday()} · ${k.tier < 4 ? 'Top 4 move up' : 'Top 3 win the Gold Leaf Rim'}${k.tier > 0 ? ' · Bottom 4 drop' : ''}`))),
    h('div', { class: 'card', style: 'margin-top:10px;display:flex;justify-content:space-between;gap:12px;align-items:center' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'If the week ended now'), h('p', { style: 'margin-top:6px;font-weight:700' }, `${ord(me.rank)} place · +${fmt(reward)} Sparks${me.rank <= 4 && k.tier < 4 ? ` · up to ${tiers[k.tier + 1]}` : me.rank <= 3 && k.tier === 4 ? ' · Gold Leaf Rim' : ''}`), est.mult > 1 ? h('p', { style: 'margin-top:4px;font-size:12px;color:var(--muted)' }, `Includes ×${est.mult} for ${bankRank().name} rank`) : null),
      h('span', { class: 'num', style: 'font-weight:800;font-size:28px' }, fmt(me.xp))));
  const list = h('ol', { class: 'kilnlist', 'aria-label': 'This week\'s standings' });
  rows.forEach(r => {
    if (r.rank === 1) list.append(h('li', { class: 'zone up', 'aria-hidden': 'true' }, k.tier < 4 ? '▲ Promotion' : '◆ Gold Leaf Rim'));
    if (r.rank === (k.tier < 4 ? 5 : 4)) list.append(h('li', { class: 'zone', 'aria-hidden': 'true' }, ''));
    if (r.rank === 17 && k.tier > 0) list.append(h('li', { class: 'zone', 'aria-hidden': 'true' }, '▼ Drop zone'));
    const ttl = r.me ? trTitle() : '';
    list.append(h('li', { class: r.me ? 'me' : '', 'aria-label': `${ord(r.rank)}: ${r.me ? 'You' : r.name}${ttl ? `, ${ttl}` : ''}, ${fmt(r.xp)} XP` }, h('span', { class: 'rk' }, r.rank), r.me ? myAvatarEl(36) : monoEl(r.glyph),
      h('span', { class: 'nm' + (ttl ? ' ttl' : '') }, ttl ? [h('span', {}, S.profile.name + ' (you)'), h('small', {}, ttl)] : r.me ? S.profile.name + ' (you)' : r.name), h('span', { class: 'xp' }, fmt(r.xp))));
  });
  v.append(h('h2', { class: 'sec' }, 'This week', h('small', {}, 'XP earned since Monday')));
  if (weekDays() < 1) v.append(h('p', { class: 'res-sub', style: 'font-size:13px;margin:-2px 2px 8px' }, 'The week just started. Rivals log their matches through the day.'));
  v.append(list,
    h('p', { class: 'res-sub', style: 'font-size:12px;margin-top:14px' }, 'Every match earns XP toward your league. Kiln rivals are simulated players on a weekly schedule. Gold Leaf top three earn an exclusive glaze.'));
}

/* ---------- collection ---------- */
// Shown inside the Style sub-screen, so it re-renders through refresh().
function collectionView(v) {
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Category' });
  Object.keys(COSMETICS).forEach(c => { const b = h('button', { 'aria-pressed': String(UIH.cat === c), 'data-fk': 'seg:' + c }, CAT_LABEL[c]); b.addEventListener('click', () => { UIH.cat = c; refresh(); }); seg.append(b); });
  v.append(seg);
  const cat = UIH.cat;
  // live preview of what is equipped
  const pv = h('div', { class: `preview table-${S.equip.table} glaze-${S.equip.glaze} num-${S.equip.num} tray-${S.equip.tray}`, 'aria-hidden': 'true' });
  const tr = h('div', { class: 'tray ptray', style: 'pointer-events:none' }, h('div', { class: 'row' }, trayGroups([3, 4, 6, 6])));
  pv.append(tr);
  v.append(pv);
  const grid = h('div', { class: 'cgrid' });
  COSMETICS[cat].forEach(it => {
    const own = owns(cat, it.id), on = S.equip[cat] === it.id;
    const meta = on ? `${icon('check', 13)} Equipped` : own ? 'Owned · tap to equip' : howText(it, true, cat);
    const b = h('button', { class: 'citem' + (on ? ' on' : ''), 'data-fk': `${cat}:${it.id}`, 'aria-label': `${it.name}. ${on ? 'Equipped' : own ? 'Owned' : howText(it, false, cat)}` },
      miniPreview(cat, it.id), h('span', { class: 'cname' }, it.name),
      h('span', { class: 'cmeta', html: meta }), !own && (it.rarity || it.how === 'trophy') ? rarTag(itemRarity(cat, it)) : null);
    b.addEventListener('click', () => collectTap(cat, it));
    grid.append(b);
  });
  v.append(grid, h('p', { class: 'res-sub', style: 'font-size:12px;margin-top:14px' }, 'Shop items cost Sparks. Others unlock by level, by a first win at a table, in the Kiln, or by finishing trophies. Trophy items are never sold.'));
}
// How a locked item unlocks: brief for the Style grid (HTML), long for labels and toasts. cat is needed for trophy items.
function howText(it, brief, cat) {
  if (it.how === 'shop') return brief ? `${curIcon('sparks', 13)}<span class="cprice">${fmt(it.price)}</span>` : `${fmt(it.price)} Sparks`;
  if (it.how === 'level') return brief ? `${icon('lock', 13)} Level ${it.lvl}` : `Unlocks at level ${it.lvl}`;
  if (it.how === 'venue') return brief ? `${icon('lock', 13)} Win at ${V[it.venue].name}` : `First win at ${V[it.venue].name}`;
  if (it.how === 'kiln') return brief ? `${icon('lock', 13)} Gold Leaf top 3` : 'Finish top three in the Gold Leaf league';
  if (it.how === 'trophy') return brief ? `${icon('lock', 13)} ${TR_PLAT_SET.some(x => x.cat === cat && x.id === it.id) ? 'Platinum Trivet' : 'Trophy reward'}` : trItemSource(cat, it.id) || 'Earned in the Trophy Cabinet';
  return '';
}
function miniPreview(cat, id) {
  const base = { table: S.equip.table, glaze: S.equip.glaze, num: S.equip.num, tray: S.equip.tray };
  base[cat === 'sound' ? 'x' : cat] = id;
  const box = h('span', { class: `cprev table-${base.table} glaze-${base.glaze} num-${base.num} tray-${base.tray}`, 'aria-hidden': 'true' });
  if (cat === 'tray' || cat === 'table') { const t = h('span', { class: 'mtray' }); [4, 5, 8].forEach(x => t.append(chipEl(x))); box.append(t); }
  else if (cat === 'sound') [1, 3, 5].forEach(x => box.append(chipEl(x)));
  else [1, 5, 8].forEach(x => box.append(chipEl(x)));
  return box;
}
function collectTap(cat, it) {
  if (cat === 'sound') [1, 3, 5, 8].forEach((x, i) => setTimeout(() => SND.clink(x, it.id), i * 110));
  if (owns(cat, it.id)) { S.equip[cat] = it.id; save(); applyTheme(); refresh(); return; }
  if (it.how !== 'shop') { toast(howText(it, false, cat)); return; }
  sheet((p, close) => {
    p.append(h('div', { class: 'eyebrow', style: 'padding-inline:4px;margin-bottom:8px' }, `${it.rarity} ${CAT_LABEL[cat].toLowerCase().replace(/s$/, '')}`), h('h3', {}, it.name));
    const pr = miniPreview(cat, it.id); pr.style.cssText = 'height:110px;border-radius:22px;margin-top:14px;display:flex'; p.append(pr);
    const can = S.sparks >= it.price;
    p.append(h('p', {}, can ? `Unlock for ${fmt(it.price)} Sparks and equip it now.` : `You need ${amountText('sparks', it.price - S.sparks).replace(/ /, ' more ')}.`));
    const buy = h('button', { class: 'btn cta', disabled: !can }, can ? h('span', { style: 'display:grid', html: curIcon('sparks', 18) }) : null, `Unlock · ${fmt(it.price)}`);
    buy.addEventListener('click', () => { if (owns(cat, it.id) || S.sparks < it.price) return; S.sparks -= it.price; grant(cat, it.id); S.equip[cat] = it.id; save(); applyTheme(); close(); refresh(); const n = $(`#app > .screen:not([hidden]) [data-fk="${cat}:${it.id}"]`); if (n) n.focus({ preventScroll: true }); toast(`${it.name} unlocked`); });
    p.append(h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Not now'), buy));
  }, { label: it.name });
}

/* ---------- settings ---------- */
function settingsSheet() {
  sheet((p, close) => {
    p.append(h('h3', {}, 'Settings'),
      setRow('Fast AI', 'Shorter thinking pauses. Always on at four seats.', S.settings.fastAI, v => { S.settings.fastAI = v; save(); }),
      setRow('Pro view', 'Heat as colour only, no previews. +10% XP.', S.settings.pro, v => { S.settings.pro = v; save(); }),
      setRow('Sound', 'Each number rings its own note.', S.settings.sound, v => { S.settings.sound = v; save(); if (v) { SND.unlock(); SND.clink(5); } }),
      setRow('Colour-blind heat', 'Show heat as brightness instead of hue.', S.settings.monoHeat, v => { S.settings.monoHeat = v; save(); applyTheme(); }),
      setRow('Reduce motion', 'Skip chip flights and glows.', S.settings.reduceMotion, v => { S.settings.reduceMotion = v; save(); applyTheme(); }));
    const how = h('button', { class: 'btn' }, 'How to play'); how.addEventListener('click', () => { close(); setTimeout(howSheet, 300); });
    const reset = h('button', { class: 'btn ghost' }, 'Reset progress'); reset.addEventListener('click', () => { close(); setTimeout(resetSheet, 300); });
    p.append(h('div', { class: 'btnrow' }, how, reset));
  }, { label: 'Settings', onClose: () => { if (CUR === 'home' || CUR === 'sub') refresh(); } });
}
function howSheet() {
  sheet((p, close) => {
    p.append(h('h3', {}, 'How Scoop works'), howList());
    const les = h('button', { class: 'btn cta' }, 'Play the lesson'); les.addEventListener('click', () => { close(); startTutorial(); });
    p.append(h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Close'), les));
  }, { label: 'How to play' });
}
function resetSheet() {
  sheet((p, close) => {
    p.append(h('h3', {}, 'Reset all progress?'), h('p', {}, 'Sparks, Gems, boosters, level, Kiln standing, season progress, stats, trophies and titles, your name and avatar, and every unlocked item go back to the start. This cannot be undone.'),
      h('p', {}, 'Your simulated trivet+ membership and this month\'s premium season pass are kept, as a real store would restore them.'));
    const r = h('button', { class: 'btn cta' }, 'Reset');
    r.addEventListener('click', () => {
      const plus = S.plus, prem = ensureSeason().premium;
      S = DEFAULT(); S.plus = plus; S.season.premium = prem;
      save(); applyTheme(); arcReset(); UIH.tab = 'play'; UIH.carX = null; close(); go('home'); toast('Progress reset');
    });
    p.append(h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Cancel'), r));
  }, { label: 'Reset progress' });
}

/* ================= boot ================= */
function initGlobal() {
  $$('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#t-back').innerHTML = icon('back', 20); $('#t-menu').innerHTML = icon('dots', 20); $('#rc-back').innerHTML = icon('back', 20);
  $('#rc-back').addEventListener('click', () => go('result'));
  $('#sub-back').innerHTML = icon('back', 20); $('#sub-back').addEventListener('click', popScreen);
  document.addEventListener('keydown', e => {
    if (overlayOpen()) return;
    if (e.key === 'Escape' && !$('#sheet').hidden) { if (sheetDismiss) closeSheet(); return; }
    if (e.key === 'Escape' && CUR === 'sub' && !e.defaultPrevented) { popScreen(); return; }
    tableKeys(e);
  });
  document.addEventListener('pointerdown', () => SND.unlock(), { once: true });
  // Another tab saved: adopt its state, so this tab never writes stale progress over newer purchases or rewards.
  window.addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue) return;
    S = load(); applyTheme(); updatePills();
    if (CUR === 'home' || CUR === 'sub') refresh();
  });
  sysRM.addEventListener && sysRM.addEventListener('change', applyTheme);
}
function boot(data) {
  S = data && data.S ? data.S : load();
  if (S.kiln.week !== isoWeekNum()) settleKiln();
  ensureSeason(); adState();
  save();
  applyTheme(); initGlobal(); initTableInput();
  go('home');
  // go() parks focus on the active tab; on first load that would draw a focus ring nobody asked for.
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  trInit();
  try { window.claude?.hot?.snapshot?.(() => ({ S })); } catch (e) { }
}
try { window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {}); } catch (e) { if (!S) boot({}); }
