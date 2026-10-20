/* ================= season pass ================= */
// A monthly 40-tier track. All match XP lands in S.season.xp (core addXP); every tier has a free and a premium reward.
// Claims are written to S before anything is revealed, so leaving mid-reveal never loses or repeats a reward.
const SSN_MONTHS = [
  { name: 'Frost Glaze', e: '🧊', col: '#CFE0FA', month: 'January' },
  { name: 'Rose Glaze', e: '🌹', col: '#FFD3DE', month: 'February' },
  { name: 'Herb Garden', e: '🌿', col: '#CDEBD6', month: 'March' },
  { name: 'Celadon Rain', e: '🌧️', col: '#CDEFEA', month: 'April' },
  { name: 'Lemon Curd', e: '🍋', col: '#F1EEB6', month: 'May' },
  { name: 'Berry Glaze', e: '🫐', col: '#D8DAF8', month: 'June' },
  { name: 'Heatwave', e: '☀️', col: '#FFE7A8', month: 'July' },
  { name: 'Firepit', e: '🔥', col: '#FFCBB8', month: 'August' },
  { name: 'Harvest Oven', e: '🍞', col: '#F3E6D3', month: 'September' },
  { name: 'Ember', e: '🍂', col: '#FFD9C2', month: 'October' },
  { name: 'Slow Simmer', e: '🍲', col: '#DDE5CC', month: 'November' },
  { name: 'Midwinter', e: '✨', col: '#E3D3F7', month: 'December' },
];
const SSN_PRICE = '£9.99';
const ssnTheme = () => SSN_MONTHS[clamp((+ensureSeason().id.slice(5) || 1) - 1, 0, 11)];

// The same 40 tiers every month. Free: modest amounts, a rarity box every 5th tier, a Golden Chest at 40.
// Premium: richer amounts, a chest every 5th tier from 4, a few epic/legendary boxes and an exclusive every 10th.
const SSN_FREE_BOX = { 5: 'common', 10: 'common', 15: 'rare', 20: 'rare', 25: 'epic', 30: 'epic', 35: 'legendary' };
const SSN_PREM_ITEM = { 10: ['emote', 'royal'], 20: ['avatar', 'teapot'], 30: ['emote', 'boiling'], 40: ['avatar', 'crystal'] };
const SSN_PREM_CHEST = { 4: 'wooden', 9: 'wooden', 14: 'silver', 19: 'silver', 24: 'silver', 29: 'golden', 34: 'golden', 39: 'golden' };
const SSN_PREM_BOX = { 12: 'epic', 22: 'epic', 32: 'legendary', 37: 'legendary' };
const SEASON_TRACK = (() => {
  const boosts = ['spins', 'peeks', 'swaps'], seen = {};
  // nth(kind): how many tiers carrying that kind of reward came before this one, so amounts climb evenly.
  const nth = kind => (seen[kind] = (seen[kind] ?? -1) + 1);
  return Array.from({ length: SEASON.tiers }, (_, i) => {
    const t = i + 1;
    let free, prem;
    if (t === SEASON.tiers) free = { type: 'chest', id: 'golden' };
    else if (SSN_FREE_BOX[t]) free = { type: 'box', rarity: SSN_FREE_BOX[t] };
    else if (t % 5 === 2) { const j = nth('fb'); free = { type: boosts[j % 3], n: 1 + Math.floor(j * 3 / 8) }; }     // 8 tiers: 1-3
    else if (t % 5 === 4) free = { type: 'gems', n: Math.round(5 + nth('fg') * 10 / 7) };                           // 8 tiers: 5-15
    else free = { type: 'sparks', n: 500 + nth('fs') * 300 };                                                       // 16 tiers: 500-5,000
    if (SSN_PREM_ITEM[t]) prem = { type: 'item', cat: SSN_PREM_ITEM[t][0], id: SSN_PREM_ITEM[t][1] };
    else if (SSN_PREM_CHEST[t]) prem = { type: 'chest', id: SSN_PREM_CHEST[t] };
    else if (SSN_PREM_BOX[t]) prem = { type: 'box', rarity: SSN_PREM_BOX[t] };
    else {
      const c = nth('p'), j = Math.floor(c / 3);                                                                     // 8 tiers of each
      prem = c % 3 === 0 ? { type: 'gems', n: Math.round((15 + j * 45 / 7) / 5) * 5 }                               // 15-60
        : c % 3 === 1 ? { type: 'sparks', n: Math.round((2000 + j * 18000 / 7) / 500) * 500 }                      // 2,000-20,000
        : { type: boosts[j % 3], n: 3 + j };                                                                         // 3-10
    }
    return { t, free, prem };
  });
})();

const SSN_STAR = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.8 6.2 20.1l1.4-6.4L2.7 9.3l6.5-.7z" fill="currentColor"/></svg>';
const SSN_GSTAR = '<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 3.2l3.8 7.7 8.5 1.2-6.2 6 1.5 8.5L16 22.6l-7.6 4 1.5-8.5-6.2-6 8.5-1.2z" fill="url(#g-gold)" stroke="#000" stroke-opacity=".18" stroke-linejoin="round"/><path d="M13.6 11.6l1.7-3.4" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" stroke-linecap="round"/></svg>';
const ssnShort = short;
const ssnLabel = r => CURS.includes(r.type) ? `${ssnShort(r.n)} ${curName(r.type, r.n)}` : rewardName(r);
// ensureSeason() plus a guard for saves whose claim lists went missing.
function ssnState() {
  const s = ensureSeason();
  if (!Array.isArray(s.claimedFree)) s.claimedFree = [];
  if (!Array.isArray(s.claimedPrem)) s.claimedPrem = [];
  if (!Number.isFinite(s.xp) || s.xp < 0) s.xp = 0;
  return s;
}
const ssnClaimed = (side, t) => ssnState()[side === 'prem' ? 'claimedPrem' : 'claimedFree'].includes(t);
function ssnProgress() {
  const s = ssnState(), tier = seasonTier(), max = tier >= SEASON.tiers;
  const into = max ? SEASON.xpPerTier : clamp(Math.floor(s.xp - tier * SEASON.xpPerTier), 0, SEASON.xpPerTier);
  return { s, tier, max, into, p: into / SEASON.xpPerTier };
}

function seasonClaimable() {
  const s = ssnState(), tier = seasonTier();
  let n = 0;
  for (let t = 1; t <= tier; t++) { if (!ssnClaimed('free', t)) n++; if (s.premium && !ssnClaimed('prem', t)) n++; }
  return n;
}

/* ---------- the Play tab ring ---------- */
function seasonRing() {
  const { tier, p } = ssnProgress(), n = seasonClaimable(), R = 19.5, C = 2 * Math.PI * R;
  const b = h('button', { class: 'ssn-ring', style: `--sc:${ssnTheme().col}`, 'data-fk': 'season', 'aria-label': `Season pass, tier ${tier}${n ? `, ${n} reward${n === 1 ? '' : 's'} to claim` : ''}` });
  b.innerHTML = `<svg viewBox="0 0 44 44" aria-hidden="true" focusable="false"><circle class="ssn-trk" cx="22" cy="22" r="${R}"/>`
    + (p > 0 ? `<circle class="ssn-arc" cx="22" cy="22" r="${R}" stroke-dasharray="${(C * p).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 22 22)"/>` : '')
    + `</svg><b aria-hidden="true">${tier}</b>${n ? '<i class="ssn-dot" aria-hidden="true"></i>' : ''}`;
  b.addEventListener('click', openSeason);
  return b;
}

/* ---------- the screen ---------- */
let ssnCentreNext = false;
function openSeason() {
  ensureSeason(); ssnCentreNext = true;
  pushScreen(() => ssnTheme().name, ssnBuild, { cls: 'ssn-screen', right: () => curPill('gems'), help: ssnHowSheet });
}
function ssnBuild(box) {
  const th = ssnTheme(), pr = ssnProgress(), n = seasonClaimable();
  const wrap = h('div', { class: 'ssn-wrap', style: `--sc:${th.col}` });
  wrap.append(ssnHero(th, pr));
  if (!pr.s.premium) wrap.append(ssnPremCard());
  const all = n > 0 ? h('button', { class: 'btn cta wide ssn-all', 'data-fk': 'ssn-all' }, `Claim all (${n})`) : null;
  if (all) all.addEventListener('click', ssnClaimAll);
  wrap.append(h('div', { class: 'ssn-head' }, all,
    h('div', { class: 'ssn-cols', 'aria-hidden': 'true' }, h('span', {}, 'Free'), h('span'),
      h('span', { class: 'ssn-p', html: (pr.s.premium ? SSN_STAR : icon('lock', 13)) + '<span>Premium</span>' }))));
  const list = h('ol', { class: 'ssn-track', 'aria-label': `Reward track, ${SEASON.tiers} tiers` });
  if (pr.tier === 0) list.append(ssnHere(pr));
  SEASON_TRACK.forEach(row => { list.append(ssnRow(row, pr)); if (row.t === pr.tier) list.append(ssnHere(pr)); });
  wrap.append(list, h('p', { class: 'ssn-foot' }, 'Unclaimed rewards vanish when the season ends. Items you already own turn into Gems.'));
  box.append(wrap);
  // Tier 0 has no row to centre, so the screen opens at the top with the hero and the premium offer.
  if (ssnCentreNext) { ssnCentreNext = false; if (pr.tier > 0) requestAnimationFrame(() => ssnCentre(box)); }
}
// Put the current tier's row in the middle of the scroller.
function ssnCentre(box) {
  const el = box.isConnected && box.querySelector('.ssn-row.ssn-cur');
  if (!el) return;
  const br = box.getBoundingClientRect(), er = el.getBoundingClientRect();
  box.scrollTop = Math.max(0, box.scrollTop + er.top - br.top - (br.height - er.height) / 2);
}

function ssnHero(th, pr) {
  const left = durText(seasonEndsAt() - Date.now()), next = pr.tier + 1;
  return h('section', { class: 'ssn-hero', 'aria-labelledby': 'ssn-name' },
    h('span', { class: 'ssn-art', 'aria-hidden': 'true' }, th.e),
    h('div', { class: 'eyebrow' }, `Season · ${th.month}`),
    h('h2', { id: 'ssn-name', tabindex: '-1' }, th.name),
    h('div', { class: 'ssn-meta' },
      h('span', { class: 'ssn-ends', html: `${icon('clock', 15)}<span>Ends in ${left}</span>` }),
      pr.s.premium ? h('span', { class: 'ssn-pbadge', html: `${SSN_STAR}<span>Premium</span>` }) : null),
    h('div', { class: 'ssn-prog' },
      h('div', { class: 'ssn-tier' }, h('span', {}, 'Tier'), h('b', {}, pr.tier)),
      h('div', { class: 'ssn-barbox' },
        h('div', { class: 'ssn-barlbl' }, h('b', {}, pr.max ? 'Max tier reached' : `${fmt(pr.into)} / ${fmt(SEASON.xpPerTier)} XP`), h('span', {}, pr.max ? 'Complete' : `to tier ${next}`)),
        h('div', { class: 'ssn-bar', role: 'progressbar', 'aria-label': pr.max ? 'Season progress' : `Progress to tier ${next}`, 'aria-valuemin': 0, 'aria-valuemax': SEASON.xpPerTier, 'aria-valuenow': pr.into, 'aria-valuetext': pr.max ? 'Max tier reached' : `${pr.into} of ${SEASON.xpPerTier} XP` },
          h('i', { style: `width:${(pr.p * 100).toFixed(1)}%` })))),
    h('p', { class: 'ssn-earn', html: `${curIcon('sparks', 15)}<span>Earn season XP from every match</span>` }));
}
function ssnPremCard() {
  const ex = Object.keys(SSN_PREM_ITEM).map(t => SEASON_TRACK[t - 1].prem);
  const chests = SEASON_TRACK.filter(r => r.prem.type === 'chest').length;
  const b = h('button', { class: 'btn cta wide', 'data-fk': 'ssn-prem' }, `Unlock Premium · ${SSN_PRICE}`);
  b.addEventListener('click', ssnBuy);
  return h('section', { class: 'ssn-premcard', 'aria-labelledby': 'ssn-ph' },
    h('div', { class: 'ssn-ptop' }, h('span', { class: 'ssn-crest', html: SSN_GSTAR }),
      h('div', {}, h('h3', { id: 'ssn-ph' }, 'Premium track'), h('p', {}, 'Unlock every reward on the right'))),
    h('div', { class: 'ssn-excl' },
      h('span', { class: 'ssn-exrow', 'aria-hidden': 'true' }, ex.map(r => h('span', { class: 'ssn-ex', style: `--rc:${RARITY[rewardRarity(r)].col}` }, rewardIconEl(r, 30)))),
      h('span', { class: 'ssn-extxt' }, h('b', {}, `${ex.length} exclusives`), h('span', {}, `${chests} chests and a second reward at every tier`))),
    b);
}

/* ---------- the track ---------- */
function ssnRow(row, pr) {
  const t = row.t, on = pr.tier >= t;
  const mid = h('span', { class: 'ssn-mid' + (on ? ' ssn-on' : '') + (t === 1 && pr.tier > 0 ? ' ssn-first' : '') + (t === SEASON.tiers && pr.tier < t ? ' ssn-last' : '') },
    h('span', { class: 'ssn-node' + (t % 10 === 0 ? ' ssn-mile' : '') + (t === pr.tier ? ' ssn-cur' : ''), 'aria-hidden': 'true' }, t));
  return h('li', { class: 'ssn-row' + (t === pr.tier ? ' ssn-cur' : ''), 'data-t': t }, ssnTile(row, 'free', pr), mid, ssnTile(row, 'prem', pr));
}
function ssnTile(row, side, pr) {
  const t = row.t, r = row[side], prem = side === 'prem';
  const state = ssnClaimed(side, t) ? 'claimed' : prem && !pr.s.premium ? 'locked' : pr.tier >= t ? 'ready' : 'ahead';
  const rar = CURS.includes(r.type) ? null : rewardRarity(r);
  const say = { claimed: 'Claimed', locked: 'Unlock Premium to claim', ready: 'Ready to claim', ahead: `Reach tier ${t} to claim` }[state];
  const b = h('button', { class: `ssn-tile ssn-${state}${prem ? ' ssn-prem' : ''}${rar ? ' ssn-rar' : ''}${SSN_PREM_ITEM[t] && prem ? ' ssn-excl' : ''}`, style: rar ? `--rc:${RARITY[rar].col}` : null,
    'data-fk': `ssn:${prem ? 'p' : 'f'}:${t}`, 'aria-label': `Tier ${t}, ${prem ? 'premium' : 'free'}: ${rewardName(r)}${rar && r.type === 'item' ? `, ${RARITY[rar].label}` : ''}. ${say}` },
    h('span', { class: 'ssn-ic' }, rewardIconEl(r, 44)), h('span', { class: 'ssn-lbl' }, ssnLabel(r)),
    state === 'ready' ? h('span', { class: 'ssn-claim' }, 'Claim') : null,
    state === 'claimed' ? h('i', { class: 'ssn-badge ssn-ok', html: icon('check', 13) }) : state === 'locked' ? h('i', { class: 'ssn-badge', html: icon('lock', 12) }) : null);
  b.addEventListener('click', () => ssnClaim(t, side));
  return b;
}
function ssnHere(pr) {
  return h('li', { class: 'ssn-here' },
    h('span', { class: 'ssn-mid' + (pr.tier === 0 ? ' ssn-first' : '') + (pr.max ? ' ssn-last' : '') }),
    h('span', { class: 'ssn-pin' }, h('b', {}, 'You are here'), h('span', {}, pr.max ? 'Max tier reached' : `${fmt(pr.into)} / ${fmt(SEASON.xpPerTier)} XP`)));
}

/* ---------- claiming ---------- */
function ssnClaim(t, side) {
  const s = ssnState(), prem = side === 'prem', r = SEASON_TRACK[t - 1][side];
  if (ssnClaimed(side, t)) { toast(`Tier ${t} ${prem ? 'premium' : 'free'} reward already claimed`); return; }
  if (prem && !s.premium) { toast('Unlock Premium to claim'); return; }
  if (seasonTier() < t) { toast(`Reach tier ${t} to claim`); return; }
  (prem ? s.claimedPrem : s.claimedFree).push(t);
  const where = `Tier ${t} · ${prem ? 'Premium' : 'Free'}`;
  // Chests and boxes get their shake-and-open intro; anything else goes straight to the reward.
  revealRewards([r], r.type === 'chest' || r.type === 'box' ? { eyebrow: where } : { title: where, skipIntro: true });
}
// Marks every reachable reward claimed first, then applies and saves them all before the reveal plays.
// The reveal is condensed: each currency appears once with its total (chest and box Sparks included), then items, rarest last.
// A big haul plays as a short run of reveals, each with a summary small enough to fit the smallest screen.
const SSN_BATCH = 9;
function ssnClaimAll() {
  const s = ssnState(), tier = seasonTier(), list = [];
  for (let t = 1; t <= tier; t++) {
    if (!ssnClaimed('free', t)) { s.claimedFree.push(t); list.push(SEASON_TRACK[t - 1].free); }
    if (s.premium && !ssnClaimed('prem', t)) { s.claimedPrem.push(t); list.push(SEASON_TRACK[t - 1].prem); }
  }
  if (!list.length) return;
  const onDone = () => ssnFocusTile(`ssn:f:${tier}`);
  const got = list.map(applyReward); save(); updatePills();
  // Even batches (28 rewards play as 7+7+7+7, not 9+9+9+1), so every batch ends on its own summary.
  const show = ssnCondense(got), parts = [], eyebrow = `${ssnTheme().name} season`, size = Math.ceil(show.length / Math.ceil(show.length / SSN_BATCH));
  for (let i = 0; i < show.length; i += size) parts.push(show.slice(i, i + size));
  parts.forEach((part, i) => revealGot(part, { title: parts.length > 1 ? `Season rewards · ${i + 1} of ${parts.length}` : 'Season rewards', eyebrow,
    skipIntro: i > 0 || show.length === 1, onDone: i === parts.length - 1 ? onDone : null }));
}
function ssnCondense(got) {
  const sums = {}, items = [];
  const walk = (g, from) => {
    if (g.contents) g.contents.forEach(c => walk(c, g.name));
    else if (CURS.includes(g.type)) sums[g.type] = (sums[g.type] || 0) + g.n;
    else items.push(from ? { ...g, from } : g);
  };
  got.forEach(g => walk(g));
  const cur = CURS.filter(k => sums[k]).map(k => ({ type: k, n: sums[k], rarity: 'common', name: amountText(k, sums[k]) }));
  return [...cur, ...items.sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity))];
}
function ssnFocusTile(fk) {
  const box = $('#sub-views'), el = CUR === 'sub' && box ? box.querySelector(`[data-fk="${CSS.escape(fk)}"]`) : null;
  if (!el) return;
  el.focus({ preventScroll: true });
  const br = box.getBoundingClientRect(), er = el.getBoundingClientRect(), head = box.querySelector('.ssn-head');
  const top = br.top + (head ? head.getBoundingClientRect().height : 0) + 8;
  if (er.top < top) box.scrollTop -= top - er.top; else if (er.bottom > br.bottom - 8) box.scrollTop += er.bottom - br.bottom + 8;
}

/* ---------- premium ---------- */
function ssnBuy() {
  const th = ssnTheme();
  mockPurchase({ title: 'Premium season pass', price: SSN_PRICE, sub: 'For this month\'s season only.', iconEl: ssnCrestBig(th),
    onSuccess: () => {
      const s = ensureSeason(); if (s.premium) return;
      s.premium = true; save(); refresh();
      const n = seasonClaimable();
      toast(n ? `Premium unlocked. ${n} reward${n === 1 ? '' : 's'} ready to claim` : `Premium unlocked for ${th.name}`);
      const t = CUR === 'sub' ? $('#sub-views [data-fk="ssn-all"]') || $('#ssn-name') : null;
      if (t) t.focus({ preventScroll: true });
    } });
}
function ssnCrestBig(th) {
  return h('span', { class: 'ssn-crestbig', style: `--sc:${th.col}`, 'aria-hidden': 'true' }, h('span', {}, th.e), h('i', { html: SSN_GSTAR }));
}

/* ---------- help ---------- */
function ssnHowSheet() {
  const th = ssnTheme(), lastDay = new Date(seasonEndsAt() - 1).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  const row = (n, txt) => h('div', {}, h('i', {}, n), h('span', {}, txt));
  sheet((p, close) => {
    p.append(h('div', { class: 'eyebrow ssn-sheye' }, `${th.name} · ${th.month}`), h('h3', {}, 'How the season pass works'),
      h('div', { class: 'how' },
        row('1', 'Every match earns season XP: a point per chip you scoop, 10 per hand, and bonuses for traps, boil-overs and your finishing place. Pricier tables multiply it (up to ×2.5 at The Glasshouse), Pro view adds 10%, and your first win of the day doubles it.'),
        row('2', `Every ${SEASON.xpPerTier} XP takes you up a tier. There are ${SEASON.tiers} tiers, so ${fmt(SEASON.tiers * SEASON.xpPerTier)} XP completes the season.`),
        row('3', 'Each tier has a free reward on the left. Premium adds a second one on the right, with chests and four exclusives. Premium covers this month\'s season only.'),
        row('4', `Claim whenever you like. Unclaimed rewards vanish when the season ends after ${lastDay}, and a new season starts at tier 0.`),
        row('5', 'Items you already own turn into Gems instead.')),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Close')));
  }, { label: 'How the season pass works' });
}
