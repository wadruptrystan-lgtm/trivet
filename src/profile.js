/* ================= profile ================= */
// The Profile tab and its screens: name, avatar and emote pickers, bankroll ranks, the playstyle read-out,
// Statistics, and the way into the Trophy Cabinet. Public: profileView(v), rankSheet(), playstyleOf(bucket).

/* ---------- playstyle ---------- */
// Looseness L = feedHeat / feeds (the heat you leave in trays you feed). Aggression A = (traps + boils) / turns.
// Thresholds come from calib2.js: 400 simulated matches per AI personality in seat 0 at each table, at that table's
// sharpness and seat count, against mixed rivals; each is the median per-match value pooled over the personalities.
// Heat left climbs with every extra rival between turns and with sloppier play, so each table is read against its own
// median, and the career bucket against the mix of tables you actually played. PRF_T_MIX (every table pooled) is the
// fallback. At these thresholds the six personalities spread over all four quadrants at every table.
const PRF_T = { cafe: { L: .35, A: .21 }, noodle: { L: .40, A: .175 }, tea: { L: .255, A: .235 }, supper: { L: .41, A: .18 }, glasshouse: { L: .365, A: .215 } };
const PRF_T_MIX = { L: .35, A: .21 };
const PRF_SCALE = { L: .06, A: .045 }; // tanh softness: the personalities land between about ±0.3 and ±0.95
const PRF_MIN_TURNS = 20;
const PRF_STYLES = {
  trapper: { name: 'Trapper', emoji: '🪤', axes: 'Tight and aggressive', col: '#B386FF', blurb: 'Keeps trays cool for rivals and sets them up for yourself', share: 'I keep trays cool for rivals and set them up for myself.' },
  hothead: { name: 'Hothead', emoji: '🔥', axes: 'Loose and aggressive', col: '#FF6A4D', blurb: "Pushes heat everywhere and boils what you can't take", share: "I push heat everywhere and boil what I can't take." },
  counter: { name: 'Counter', emoji: '🧮', axes: 'Tight and passive', col: '#7FB2F0', blurb: 'Plays safe, counts chips, waits for sure scoops', share: 'I play safe, count chips and wait for sure scoops.' },
  feeder: { name: 'Feeder', emoji: '🍽️', axes: 'Loose and passive', col: '#FFB37A', blurb: 'Generous with heat; rivals love sitting with you', share: 'I am generous with heat, and rivals love sitting with me.' },
};
const prfT = m => PRF_T[m === 'daily' ? 'tea' : m] || PRF_T_MIX; // the Daily Tray is a Tea House table against June
// Thresholds for a bucket: its own table's, or for the career bucket the mix of the tables behind it.
function prfStyleT(b) {
  const all = S.stats2 || {}, mode = STAT_MODES.find(m => all[m] === b);
  if (mode && mode !== 'all') return prfT(mode);
  if (!mode) return PRF_T_MIX;
  let wL = 0, nL = 0, wA = 0, nA = 0;
  STAT_MODES.forEach(m => {
    const x = m !== 'all' && all[m]; if (!x) return;
    const t = prfT(m);
    wL += (x.feeds || 0) * t.L; nL += x.feeds || 0; wA += (x.turns || 0) * t.A; nA += x.turns || 0;
  });
  // The table buckets add up to the career one; saves from before the stats rework don't, so use the pooled medians.
  return { L: nL && nL >= .9 * (b.feeds || 0) ? wL / nL : PRF_T_MIX.L, A: nA && nA >= .9 * (b.turns || 0) ? wA / nA : PRF_T_MIX.A };
}
function playstyleOf(bucket) {
  const b = bucket || statBucket('all'), turns = b.turns || 0, T = prfStyleT(b);
  const L = b.feeds ? (b.feedHeat || 0) / b.feeds : T.L, A = turns ? ((b.traps || 0) + (b.boils || 0)) / turns : T.A;
  const x = Math.tanh((L - T.L) / PRF_SCALE.L), y = Math.tanh((A - T.A) / PRF_SCALE.A);
  const key = y >= 0 ? (x >= 0 ? 'hothead' : 'trapper') : (x >= 0 ? 'feeder' : 'counter'), st = PRF_STYLES[key];
  return { key, name: st.name, emoji: st.emoji, blurb: st.blurb, x, y, enough: turns >= PRF_MIN_TURNS, turnsNeeded: Math.max(0, PRF_MIN_TURNS - turns), L, A, axes: st.axes };
}

/* ---------- small helpers ---------- */
const prfRate = (n, d) => d > 0 ? (n || 0) / d : null;
const prfNA = () => h('span', { class: 'prf-na' }, h('span', { 'aria-hidden': 'true' }, '—'), h('span', { class: 'sr-only' }, 'No data yet'));
const prfPctEl = p => p == null ? prfNA() : h('span', { class: 'prf-pc' }, String(Math.round(clamp(p, 0, 1) * 100)), h('small', {}, '%'));
const prfShort = short;
const prfAva = id => AVATARS.find(x => x.id === id) || AVATARS.find(x => x.id === 'otter');
const prfIco = (kid, bg) => h('span', { class: 'prf-ico', style: `--pc:${bg}`, 'aria-hidden': 'true' }, kid);
const prfChev = () => h('span', { class: 'prf-chev', html: icon('chev', 18) });
const prfHeatCol = p => p >= .5 ? 'var(--heat-hot)' : p >= .2 ? 'var(--heat-warm)' : 'var(--heat-cool)';
function prfDur(ms) {
  const m = Math.floor((ms || 0) / 6e4), hr = Math.floor(m / 60);
  return !m ? (ms > 0 ? 'Under 1m' : null) : hr ? `${hr}h ${m % 60}m` : `${m}m`;
}
function prfDate(k, short) {
  if (typeof k !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return null;
  const [y, m, d] = k.split('-').map(Number), dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-GB', short ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}
// 4 characters from the save's own seed: no 0/O or 1/I to misread.
function prfInviteCode() {
  const A = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = Scoop.hash32(S.seed >>> 0, 0x7A11), out = '';
  for (let i = 0; i < 4; i++) { out += A[s & 31]; s >>>= 5; }
  return 'TRV-' + out;
}
// Tab strips are rebuilt on every refresh: put each back where it was, then make sure the pressed tab is fully in view.
const prfSegX = {};
function prfSegKeep(seg, key) {
  seg.addEventListener('scroll', () => { prfSegX[key] = seg.scrollLeft; }, { passive: true });
  requestAnimationFrame(() => {
    seg.scrollLeft = prfSegX[key] || 0;
    const s = seg.querySelector('[aria-pressed="true"]'); if (!s) return;
    const l = s.offsetLeft - 16, r = s.offsetLeft + s.offsetWidth + 16 - seg.clientWidth;
    if (seg.scrollLeft > l) seg.scrollLeft = l; else if (seg.scrollLeft < r) seg.scrollLeft = r;
  });
}
function prfFocus(fk) { const t = $(`#app > .screen:not([hidden]) [data-fk="${CSS.escape(fk)}"]`); if (t) t.focus({ preventScroll: true }); }

/* ---------- the tab ---------- */
// The playstyle dot glides in when the chart first scrolls into view after you open the tab, or when your style moves.
let prfArrive = true, prfDotKey = null, prfHooked = false, prfIO = null;
function profileView(v) {
  if (!prfHooked) {
    const t = $('#home .tabs');
    if (t) { prfHooked = true; t.addEventListener('click', e => { if (e.target.closest('[data-tab="profile"]') && UIH.tab !== 'profile') prfArrive = true; }, true); }
  }
  const b = statBucket('all'), rk = bankRank();
  v.append(prfHead(rk), prfFriends(), prfRankCard(rk), prfStyleSec(b), prfSummary(b), prfMenu());
}
function prfHead(rk) {
  const plus = plusActive(), a = prfAva(S.profile.avatar);
  const ava = h('button', { class: 'prf-ava', 'data-fk': 'prf-ava', 'aria-label': `Change avatar. Now ${a.name}` }, myAvatarEl(104), h('span', { class: 'prf-pen', html: icon('edit', 15) }));
  ava.addEventListener('click', prfAvatarScreen);
  const ed = h('button', { class: 'iconbtn prf-edit', 'data-fk': 'prf-name', 'aria-label': 'Edit name', html: icon('edit', 18) });
  ed.addEventListener('click', prfNameSheet);
  const ttl = trTitle();
  return h('section', { class: 'prf-head' + (plus ? ' plus' : ''), 'aria-label': 'Your profile' },
    h('div', { class: 'prf-avawrap' }, ava, plus ? h('span', { class: 'prf-plustag' }, 'trivet+') : null),
    h('div', { class: 'prf-namerow' }, h('span', { 'aria-hidden': 'true' }), h('h1', { class: 'prf-name' + (S.profile.name.length > 12 ? ' long' : '') }, S.profile.name), ed),
    ttl ? h('p', { class: 'prf-title' }, h('span', { class: 'sr-only' }, 'Title: '), ttl) : null,
    h('p', { class: 'prf-sub' }, `Level ${level().level} · ${rk.name} rank`), prfCabLine());
}
// Cabinet level and medal counts under the name; opens the Trophies screen.
function prfCabLine() {
  const sm = trSummary(), T = ['bronze', 'silver', 'gold'], cnt = k => sm.tiers[k][0];
  const b = h('button', { class: 'prf-cab', 'data-fk': 'prf-cab', 'aria-label': `Cabinet level ${sm.level}: ${T.map(k => `${cnt(k)} ${k}`).join(', ')}${sm.plat ? ', and the Platinum Trivet' : ''}. Open trophies` },
    h('b', {}, `Cabinet level ${sm.level}`),
    h('span', { class: 'prf-cabm', 'aria-hidden': 'true' }, T.map(k => h('span', { class: 'prf-cabt' + (cnt(k) ? '' : ' off') }, trMedal(k, 16), cnt(k))), sm.plat ? trMedal('platinum', 16) : null),
    h('span', { class: 'prf-chev', html: icon('chev', 14) }));
  b.addEventListener('click', trOpenCabinet);
  return b;
}

/* ---------- name ---------- */
const PRF_NAME_OK = /^[\p{L}\p{M}\p{Nd} ._-]+$/u; // letters (with their accents), digits, spaces and . _ -
function prfNameErr(s) {
  if (!s) return 'Enter a name.';
  if (!PRF_NAME_OK.test(s)) return 'Use letters, numbers, spaces, dots, dashes or underscores.';
  if (!/[\p{L}\p{Nd}]/u.test(s)) return 'Include at least one letter or number.';
  if (s.length > 16) return 'Keep it to 16 characters.';
  return '';
}
function prfNameSheet() {
  sheet((p, close) => {
    const inp = h('input', { class: 'prf-input', id: 'prf-name-in', type: 'text', maxlength: '16', autocomplete: 'nickname', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'done', 'aria-describedby': 'prf-name-msg prf-name-rule', 'aria-invalid': 'false' });
    inp.value = S.profile.name;
    const msg = h('p', { class: 'prf-err', id: 'prf-name-msg', 'aria-live': 'polite' });
    const left = h('span', { class: 'prf-left', 'aria-hidden': 'true' });
    const show = e => { msg.textContent = e; inp.setAttribute('aria-invalid', e ? 'true' : 'false'); };
    const sync = () => { left.textContent = `${inp.value.length}/16`; };
    // Flag a bad character as it is typed; other problems wait for Save, then update live until fixed.
    inp.addEventListener('input', () => {
      sync(); const v = inp.value.normalize('NFC').trim(), e = prfNameErr(v);
      if (inp.getAttribute('aria-invalid') === 'true' || (v && !PRF_NAME_OK.test(v))) show(e);
    });
    let used = false;
    const form = h('form', { class: 'prf-form', id: 'prf-name-form', novalidate: true });
    form.addEventListener('submit', e => {
      e.preventDefault(); if (used || !sheetOpen()) return;
      const v = inp.value.normalize('NFC').trim().replace(/\s+/g, ' '), err = prfNameErr(v);
      if (err) { show(err); inp.focus(); return; }
      used = true;
      const changed = v !== S.profile.name;
      if (changed) { S.profile.name = v; save(); }
      close(); refresh(); prfFocus('prf-name');
      toast(changed ? `Name saved: ${v}` : 'Name unchanged');
    });
    form.append(h('label', { class: 'prf-lbl', for: 'prf-name-in' }, 'Display name', left), inp, msg,
      h('p', { class: 'prf-rule', id: 'prf-name-rule' }, 'Up to 16 letters, numbers, spaces, dots, dashes or underscores.'));
    sync();
    p.append(h('h3', {}, 'Your name'), h('p', {}, 'Shown on your profile and in the Kiln.'), form,
      h('div', { class: 'btnrow' }, h('button', { class: 'btn', type: 'button', onclick: close }, 'Cancel'), h('button', { class: 'btn cta', type: 'submit', form: 'prf-name-form' }, 'Save')));
    // sheet() focuses the first button on the next frame; the text box should win.
    requestAnimationFrame(() => requestAnimationFrame(() => { if (inp.isConnected) { inp.focus({ preventScroll: true }); inp.select(); } }));
  }, { label: 'Your name' });
}

/* ---------- friends ---------- */
function prfFriends() {
  const cnt = h('button', { class: 'prf-fcount', 'data-fk': 'prf-friends', 'aria-label': '0 friends. About friends' },
    prfIco('👥', '#CFE0FA'), h('span', { class: 'prf-ftx' }, h('b', {}, '0'), h('span', {}, 'friends')), prfChev());
  const inv = h('button', { class: 'btn prf-invite', 'data-fk': 'prf-invite', html: icon('plus', 18) + '<span>Invite friends</span>' });
  cnt.addEventListener('click', prfFriendsSheet); inv.addEventListener('click', prfFriendsSheet);
  return h('div', { class: 'card prf-friends' }, cnt, inv);
}
function prfFriendsSheet() {
  sheet((p, close) => {
    const code = prfInviteCode();
    const cb = h('button', { class: 'btn smallbtn prf-copy', 'aria-label': `Copy invite code ${code.split('').join(' ')}`, html: icon('copy', 16) + '<span>Copy</span>' });
    cb.addEventListener('click', () => copyText(code, cb));
    p.append(h('div', { class: 'prf-sheetart', 'aria-hidden': 'true' }, '👥'), h('h3', {}, 'Friends are on the way'),
      h('p', {}, 'Friends and online play are not in this prototype yet. Every rival at the table, and everyone in the Kiln, is a computer player.'),
      h('div', { class: 'prf-codebox' }, h('div', { class: 'prf-codetx' }, h('span', { class: 'eyebrow' }, 'Your invite code'), h('code', {}, code)), cb),
      h('p', { class: 'prf-fine' }, 'The code is made from this device’s save. It doesn’t link to anyone yet.'),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Close')));
  }, { label: 'Friends' });
}

/* ---------- rank ---------- */
function prfRankCard(rk) {
  const nx = rk.next, w = rk.prog > 0 ? `max(8px,${(rk.prog * 100).toFixed(1)}%)` : '0';
  const b = h('button', { class: 'prf-rank', style: `--rank:${rk.col}`, 'data-fk': 'prf-rank', 'aria-label': `${rk.name} rank. Best bankroll ${fmt(rk.best)} Sparks. ${nx ? `${nx.name} at ${fmt(nx.min)}.` : 'Top rank.'} Kiln payouts times ${rk.mult}. See every rank` },
    h('span', { class: 'prf-rtop' }, rankBadge(rk.i, 44),
      h('span', { class: 'prf-rtx' }, h('b', {}, `${rk.name} rank`), h('span', {}, 'Best bankroll ', h('span', { class: 'prf-cur', html: curIcon('sparks', 14) }), fmt(rk.best))), prfChev()),
    h('span', { class: 'prf-bar' }, h('i', { style: `width:${w}` })),
    h('span', { class: 'prf-rfoot' }, h('span', {}, nx ? `${nx.name} at ${fmt(nx.min)}` : 'Top rank reached'), h('span', { class: 'prf-mult' }, `Kiln payouts ×${rk.mult}`)));
  b.addEventListener('click', rankSheet);
  return b;
}
const PRF_PLACES = [['1st', 3, '#F3C452', '1'], ['2nd', 2, '#C9D2DE', '2'], ['3rd', 1.5, '#D99A6C', '3'], ['4th–10th', 1, '#6E6378', '4'], ['11th+', .25, '#463D50', '11']];
function prfMedal(col, n) {
  return h('span', { class: 'prf-medal', 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M6.5 1.5h4.2l2 6.2H8.5z" fill="#5DB9F5"/><path d="M17.5 1.5h-4.2l-2 6.2h4.2z" fill="#3E7FC0"/><circle cx="12" cy="14.6" r="7.6" fill="${col}"/><circle cx="12" cy="14.6" r="7.6" fill="none" stroke="#000" stroke-opacity=".18"/><text x="12" y="17.9" text-anchor="middle" font-size="${n.length > 1 ? 7.6 : 9.5}" font-weight="800" fill="#251C2B" font-family="Manrope,system-ui,sans-serif">${n}</text></svg>` });
}
function prfRankPage(r, i, me, base, tierName) {
  const cur = i === me.i, got = i < me.i, nx = BANK_RANKS[i + 1];
  const state = cur ? h('span', { class: 'prf-rstate cur' }, 'Your rank') : got ? h('span', { class: 'prf-rstate got', html: icon('check', 13) + 'Unlocked' }) : h('span', { class: 'prf-rstate', html: icon('lock', 13) + 'Locked' });
  const pg = h('section', { class: 'prf-rpage' + (cur ? ' cur' : '') + (i > me.i ? ' locked' : ''), style: `--rank:${r.col}`, 'aria-label': `${r.name} rank, ${i + 1} of ${BANK_RANKS.length}` },
    h('div', { class: 'prf-rphead' }, h('span', { class: 'prf-rpbadge' }, rankBadge(i, 56), i > me.i ? h('span', { class: 'prf-rplock', html: icon('lock', 12) }) : null),
      h('div', {}, h('h4', {}, r.name), h('span', { class: 'prf-rpmin' }, r.min ? `${fmt(r.min)} bankroll` : 'Where everyone starts'))),
    h('div', { class: 'prf-rpmeta' }, state, h('span', { class: 'prf-rpmult' }, 'Kiln payouts ', h('b', {}, '×' + r.mult))));
  if (cur) pg.append(h('div', { class: 'prf-rpprog' }, h('span', { class: 'prf-bar' }, h('i', { style: `width:${me.prog > 0 ? `max(8px,${(me.prog * 100).toFixed(1)}%)` : '0'}` })),
    h('span', {}, nx ? `${fmt(me.best)} of ${fmt(nx.min)} to ${nx.name}` : 'The top rank. Nothing left to reach.')));
  const rows = h('ul', { class: 'prf-pay' }, PRF_PLACES.map(([pl, pm, col, n]) => {
    const amt = Math.round(base * pm * r.mult);
    return h('li', {}, prfMedal(col, n), h('span', { class: 'prf-pl' }, pl === '4th–10th' || pl === '11th+' ? pl : `${pl} place`),
      h('span', { class: 'prf-amt' }, h('span', { class: 'prf-cur', html: curIcon('sparks', 14) }), h('span', { 'aria-hidden': 'true' }, prfShort(amt)), h('span', { class: 'sr-only' }, `${fmt(amt)} Sparks`)));
  }));
  pg.append(h('div', { class: 'prf-payh' }, h('span', { class: 'eyebrow' }, 'Kiln payouts at this rank'), h('small', {}, `${tierName} league`)), rows);
  return pg;
}
function rankSheet() {
  const me = bankRank(), tier = clamp(S.kiln.tier | 0, 0, Scoop.KILN.base.length - 1), base = Scoop.KILN.base[tier], tierName = Scoop.KILN.tiers[tier];
  sheet((p, close) => {
    const pager = h('div', { class: 'prf-pager', tabindex: '0', role: 'group', 'aria-label': 'Ranks. Use the arrow keys to move between them' }, BANK_RANKS.map((r, i) => prfRankPage(r, i, me, base, tierName)));
    const dots = h('div', { class: 'prf-dots', 'aria-hidden': 'true' }, BANK_RANKS.map((r, i) => h('i', { class: i === me.i ? 'me' : '' })));
    const pages = [...pager.children], at = () => { const w = pages[0].offsetWidth + 10; return clamp(Math.round(pager.scrollLeft / w), 0, pages.length - 1); };
    const go2 = (i, smooth) => pager.scrollTo({ left: pages[clamp(i, 0, pages.length - 1)].offsetLeft - pages[0].offsetLeft, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
    const live = h('div', { class: 'sr-only', 'aria-live': 'polite' }); let shown = -1;
    const sync = () => { const i = at(); [...dots.children].forEach((d, j) => d.classList.toggle('on', j === i)); if (shown >= 0 && i !== shown) live.textContent = `${pages[i].getAttribute('aria-label') || BANK_RANKS[i].name + ' rank'}, ${i + 1} of ${pages.length}`; shown = i; };
    pager.addEventListener('scroll', sync, { passive: true });
    pager.addEventListener('keydown', e => {
      const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (k) { e.preventDefault(); go2(at() + k, true); } else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); go2(e.key === 'Home' ? 0 : pages.length - 1, true); }
    });
    [...dots.children].forEach((d, i) => d.addEventListener('click', () => go2(i, true)));
    p.append(h('h3', {}, 'Bankroll ranks'), h('p', {}, 'Rank follows the most Sparks you have ever held. Spending never lowers it.'), pager, dots, live,
      h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Close')));
    requestAnimationFrame(() => { go2(me.i); sync(); });
  }, { label: 'Bankroll ranks' });
}

/* ---------- playstyle card ---------- */
let prfGid = 0;
function prfChart(ps) {
  const cx = 150, cy = 132, R = 100, st = PRF_STYLES[ps.key], ax = Math.abs(ps.x), ay = Math.abs(ps.y);
  const P = (x, y) => `${(cx + x * R).toFixed(1)},${(cy - y * R).toFixed(1)}`;
  const quads = [['trapper', -1, 1], ['hothead', 1, 1], ['counter', -1, -1], ['feeder', 1, -1]];
  let svg = '';
  quads.forEach(([k, sx, sy]) => { const on = ps.enough && k === ps.key; svg += `<path d="M${cx},${cy}L${P(sx, 0)}L${P(0, sy)}Z" fill="${PRF_STYLES[k].col}" fill-opacity="${on ? .22 : .07}"/>`; });
  [1 / 3, 2 / 3].forEach(f => { svg += `<path class="prf-grid" d="M${P(0, f)}L${P(f, 0)}L${P(0, -f)}L${P(-f, 0)}Z"/>`; });
  svg += `<path class="prf-grid" d="M${P(0, 1)}L${P(0, -1)}M${P(-1, 0)}L${P(1, 0)}"/><path class="prf-edge" d="M${P(0, 1)}L${P(1, 0)}L${P(0, -1)}L${P(-1, 0)}Z"/>`;
  // Each archetype sits in the free corner beside its quadrant, outside the diamond, so the dot never covers it.
  quads.forEach(([k, sx, sy]) => {
    const on = ps.enough && k === ps.key, x = cx + sx * 106, y = cy - sy * 84;
    svg += `<g class="prf-q${on ? ' on' : ''}" style="--qc:${PRF_STYLES[k].col}"><text class="prf-qemo" x="${x}" y="${y - 6}">${PRF_STYLES[k].emoji}</text><text class="prf-qname" x="${x}" y="${y + 19}">${PRF_STYLES[k].name.toUpperCase()}</text></g>`;
  });
  const lit = n => ps.enough && ((n === 'a' && ps.y >= 0) || (n === 'p' && ps.y < 0) || (n === 't' && ps.x < 0) || (n === 'l' && ps.x >= 0)) ? ' on' : '';
  svg += `<text class="prf-lab${lit('a')}" x="${cx}" y="${cy - R - 14}">AGGRESSIVE</text><text class="prf-lab${lit('p')}" x="${cx}" y="${cy + R + 23}">PASSIVE</text>`
    + `<text class="prf-lab${lit('t')}" x="${cx - R - 25}" y="${cy + 4}">TIGHT</text><text class="prf-lab${lit('l')}" x="${cx + R + 25}" y="${cy + 4}">LOOSE</text>`;
  // The square of (x, y) folds radially onto the diamond, so every corner of the square reaches the diamond's edge.
  const s = ax + ay ? Math.max(ax, ay) / (ax + ay) * .9 : 0, dx = cx + ps.x * s * R, dy = cy - ps.y * s * R;
  const key = `${ps.key}:${dx.toFixed(0)},${dy.toFixed(0)}:${ps.enough}`, anim = !reduced() && typeof IntersectionObserver === 'function' && (prfArrive || key !== prfDotKey);
  const gid = 'prf-glow' + (++prfGid);
  svg += `<defs><radialGradient id="${gid}"><stop offset="0" stop-color="${ps.enough ? st.col : '#5E5568'}" stop-opacity=".55"/><stop offset="1" stop-color="${ps.enough ? st.col : '#5E5568'}" stop-opacity="0"/></radialGradient></defs>`
    + `<line class="prf-dline${anim ? ' prf-pend' : ''}" x1="${cx}" y1="${cy}" x2="${dx.toFixed(1)}" y2="${dy.toFixed(1)}"/>`
    + `<g class="prf-dot${ps.enough ? '' : ' off'}${anim ? ' prf-pend' : ''}" style="--tx:${dx.toFixed(1)}px;--ty:${dy.toFixed(1)}px;--dc:${ps.enough ? st.col : 'var(--faint)'}"><circle class="prf-halo" r="22" fill="url(#${gid})"/><circle class="prf-core" r="7.5"/></g>`;
  const label = ps.enough ? `Playstyle: ${st.name}. ${st.axes}.` : `Playstyle not read yet. Play ${ps.turnsNeeded} more turn${ps.turnsNeeded === 1 ? '' : 's'} to reveal your style.`;
  const el = h('div', { class: 'prf-chart', role: 'img', 'aria-label': label, html: `<svg viewBox="0 0 300 266" aria-hidden="true" focusable="false">${svg}</svg>` });
  if (prfIO) { prfIO.disconnect(); prfIO = null; } // the previous render's chart is gone
  if (anim) {
    const io = prfIO = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting) || !el.isConnected) return;
      io.disconnect(); prfIO = null; prfArrive = false; prfDotKey = key;
      $$('.prf-pend', el).forEach(n => { n.classList.remove('prf-pend'); n.classList.add('prf-go'); });
    }, { threshold: .6 });
    requestAnimationFrame(() => { if (el.isConnected) io.observe(el); });
  } else prfDotKey = key;
  return el;
}
function prfStyleSec(b) {
  const ps = playstyleOf(b), st = PRF_STYLES[ps.key], turns = b.turns || 0;
  const card = h('div', { class: 'card prf-style' + (ps.enough ? '' : ' dim'), style: `--sc:${st.col}` }, prfChart(ps));
  if (ps.enough) {
    const line = `My trivet playstyle is ${st.name} ${st.emoji}. ${st.axes}: ${st.share}`;
    const sb = h('button', { class: 'btn smallbtn prf-sharebtn', 'data-fk': 'prf-share', 'aria-label': 'Share my playstyle (copies it)', html: icon('share', 16) + '<span>Share</span>' });
    sb.addEventListener('click', () => copyText(line, sb));
    card.append(h('div', { class: 'prf-arch' }, h('span', { class: 'prf-archemo', 'aria-hidden': 'true' }, st.emoji),
      h('div', {}, h('h3', {}, st.name), h('span', { class: 'eyebrow' }, st.axes))),
      h('p', { class: 'prf-blurb' }, st.blurb + '.'),
      h('div', { class: 'copyline prf-shareline' }, h('code', {}, line), sb));
  } else {
    const n = ps.turnsNeeded;
    card.append(h('div', { class: 'prf-arch' }, h('span', { class: 'prf-archemo', 'aria-hidden': 'true' }, '🫖'),
      h('div', {}, h('h3', {}, 'Still brewing'), h('span', { class: 'eyebrow' }, `${turns} of ${PRF_MIN_TURNS} turns`))),
      h('p', { class: 'prf-blurb' }, `Play ${n} more turn${n === 1 ? '' : 's'} to reveal your style.`),
      h('span', { class: 'prf-bar prf-brew', role: 'progressbar', 'aria-label': 'Turns played toward your playstyle', 'aria-valuemin': '0', 'aria-valuemax': String(PRF_MIN_TURNS), 'aria-valuenow': String(turns) }, h('i', { style: `width:${turns ? `max(8px,${(turns / PRF_MIN_TURNS * 100).toFixed(1)}%)` : '0'}` })));
  }
  return h('section', { 'aria-labelledby': 'prf-h-style' }, h('h2', { class: 'sec', id: 'prf-h-style' }, 'Playstyle', h('small', {}, turns ? `From ${fmt(turns)} turn${turns === 1 ? '' : 's'}` : 'All tables')), card);
}

/* ---------- summary and menu ---------- */
function prfSummary(b) {
  const t = (label, val) => h('div', { class: 'tile prf-tile' }, h('div', { class: 'tl2' }, label), h('div', { class: 'tv' }, val));
  const more = h('button', { class: 'btn wide prf-more', 'data-fk': 'prf-allstats' }, 'All statistics', h('span', { class: 'prf-chev', html: icon('chev', 16) }));
  more.addEventListener('click', prfStatsScreen);
  return h('section', { 'aria-labelledby': 'prf-h-stats' }, h('h2', { class: 'sec', id: 'prf-h-stats' }, 'Statistics', h('small', {}, 'All tables')),
    h('div', { class: 'tiles' }, t('Matches', fmt(b.matches || 0)), t('Win rate', prfPctEl(prfRate(b.wins, b.matches))),
      t('Scoop rate', prfPctEl(prfRate(b.scoopsTaken, b.scoopChances))), t('Biggest scoop', b.biggest ? h('span', {}, String(b.biggest), h('small', {}, b.biggest === 1 ? ' chip' : ' chips')) : prfNA())),
    more);
}
function prfMenu() {
  const a = prfAva(S.profile.avatar), sm = trSummary();
  const chip = chipEl(5); chip.style.setProperty('--d', '26px');
  const rows = [
    ['avatar', h('span', { class: 'prf-ico', 'aria-hidden': 'true' }, myAvatarEl(40)), 'Avatar', a.name, prfAvatarScreen],
    ['emotes', prfIco((emoteOf(S.emoteSet[1]) || EMOTES[1]).e, '#FFD3DE'), 'Emotes', `${S.emoteSet.length} at the table`, prfEmotesScreen],
    ['style', prfIco(chip, 'var(--surface-2)'), 'Style', 'Glazes, numerals, trays…', () => pushScreen('Style', box => collectionView(box))],
    ['trophies', prfIco('🏆', '#FFE7A8'), 'Trophies', [`${sm.earned} of ${sm.total}`, sm.fresh ? h('em', {}, ` · ${sm.fresh} new`) : null], trOpenCabinet],
    ['lesson', prfIco('📖', '#F3E6D3'), 'Replay the lesson', 'Three quick lessons on a real table', startTutorial],
  ];
  return h('div', { class: 'prf-menu', role: 'group', 'aria-label': 'More' }, rows.map(([k, ic, label, hint, fn]) => {
    const b = h('button', { class: 'prf-mrow', 'data-fk': 'prf-m:' + k }, ic, h('span', { class: 'prf-mtx' }, h('b', {}, label), h('span', {}, hint)), prfChev());
    b.addEventListener('click', fn);
    return b;
  }));
}

/* ---------- statistics ---------- */
let prfMode = 'all';
const prfModeName = m => m === 'all' ? 'Total' : m === 'daily' ? 'Daily Tray' : V[m].name;
// cuts split a rate into 4 bands; calibrated so the AI personalities spread over the middle two.
const PRF_TILES = [
  { label: 'Scoop rate', n: b => b.scoopsTaken, d: b => b.scoopChances, cuts: [.6, .8, .92], reads: ['Hesitant', 'Steady', 'Sharp', 'Ruthless'] },
  { label: 'Heat left', n: b => b.feedHeat, d: b => b.feeds, cuts: [.2, .35, .5], reads: ['Cool', 'Mild', 'Warm', 'Hot'] },
  { label: 'Trap rate', n: b => b.traps, d: b => b.feeds, cuts: [.15, .28, .4], reads: ['Rare', 'Casual', 'Crafty', 'Devious'] },
  { label: 'Boil rate', n: b => b.boils, d: b => b.turns, cuts: [.01, .03, .06], reads: ['Gentle', 'Measured', 'Spiky', 'Spoiler'] },
];
const PRF_BAND = ['var(--heat-cool)', 'var(--heat-soft)', 'var(--heat-warm)', 'var(--heat-hot)'];
const PRF_STAGES = ['Early', 'Mid', 'Late', 'Empty bag'];
function prfStatsScreen() { pushScreen('Statistics', prfStatsBuild, { help: prfGlossary }); }
function prfStatsBuild(box) {
  const seg = h('div', { class: 'seg prf-seg', role: 'group', 'aria-label': 'Table' });
  STAT_MODES.forEach(m => {
    const b = h('button', { 'aria-pressed': String(m === prfMode), 'data-fk': 'prf-mode:' + m }, prfModeName(m));
    b.addEventListener('click', () => { if (prfMode === m) return; prfMode = m; refresh(); });
    seg.append(b);
  });
  box.append(seg); prfSegKeep(seg, 'stats');
  const b = statBucket(prfMode);
  if (!b.turns && !b.matches) { box.append(prfEmpty()); return; }
  box.append(prfStyleTiles(b), prfStages(b), prfWinCard('hands', 'Hands', b.hands, b.handWins, 'Won'), prfWinCard('matches', 'Matches', b.matches, b.wins, 'First places'), prfGifts(b), prfDetails(b));
}
function prfEmpty() {
  const m = prfMode, art = m === 'all' ? ['🫖', '#F3E6D3'] : m === 'daily' ? ['🗓️', '#FFD3DE'] : VENUE_ART[m];
  const cta = h('button', { class: 'btn cta', 'data-fk': 'prf-empty-go' }, 'Find a table');
  cta.addEventListener('click', () => { UIH.tab = 'play'; UIH.carX = null; go('home'); });
  return h('div', { class: 'card prf-empty' }, h('span', { class: 'prf-emptyart', style: `--pc:${art[1]}`, 'aria-hidden': 'true' }, art[0]),
    h('h2', {}, 'Nothing here yet'),
    h('p', {}, m === 'all' ? 'Play a match and your numbers start filling in here.' : m === 'daily' ? 'Play the Daily Tray against June and your numbers show up here.' : `Play a match at ${V[m].name} and your numbers show up here.`), cta);
}
function prfSec(id, title, note, ...kids) {
  return h('section', { 'aria-labelledby': 'prf-h-' + id }, h('h2', { class: 'sec', id: 'prf-h-' + id }, title, note ? h('small', {}, note) : null), ...kids);
}
function prfStyleTiles(b) {
  return prfSec('sty', 'Style', null, h('div', { class: 'prf-stiles' }, PRF_TILES.map(t => {
    const p = prfRate(t.n(b), t.d(b)), band = p == null ? -1 : t.cuts.filter(c => p >= c).length;
    return h('div', { class: 'prf-stile', style: band >= 0 ? `--bc:${PRF_BAND[band]}` : null },
      h('div', { class: 'prf-slab' }, t.label), h('div', { class: 'prf-sval' }, prfPctEl(p)),
      h('div', { class: 'prf-seg4', 'aria-hidden': 'true' }, [0, 1, 2, 3].map(i => h('i', { class: i <= band ? 'on' : null }))),
      h('div', { class: 'prf-sread' }, band >= 0 ? t.reads[band] : 'Not yet'));
  })));
}
// A ring gauge. arc < 1 leaves a gap at the bottom; p null draws only the track.
function prfRing(p, o) {
  const sw = o.sw * 100 / o.size, r = 50 - sw / 2 - .5, C = 2 * Math.PI * r, arc = o.arc || 1, rot = arc < 1 ? 90 + (1 - arc) * 180 : -90;
  const len = p == null ? 0 : C * arc * clamp(p, 0, 1), id = 'prf-rg' + (++prfGid);
  const ring = `<circle class="prf-trk" cx="50" cy="50" r="${r.toFixed(2)}" stroke-width="${sw.toFixed(2)}" stroke-dasharray="${(C * arc).toFixed(2)} ${C.toFixed(2)}" transform="rotate(${rot} 50 50)"/>`
    + (len > .01 ? `<circle class="prf-arc" cx="50" cy="50" r="${r.toFixed(2)}" stroke-width="${sw.toFixed(2)}" stroke="${o.grad ? `url(#${id})` : o.col}" style="--len:${len.toFixed(2)};--c:${C.toFixed(2)}" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}" transform="rotate(${rot} 50 50)"/>` : '');
  const defs = o.grad ? `<defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FFD9B8"/><stop offset=".55" stop-color="#FFB37A"/><stop offset="1" stop-color="#FF6A4D"/></linearGradient></defs>` : '';
  return h('span', { class: 'prf-ring' + (o.cls ? ' ' + o.cls : ''), style: `--rs:${o.size}px` },
    h('span', { class: 'prf-rsvg', html: `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${defs}${ring}</svg>` }),
    h('span', { class: 'prf-rlab' }, o.text != null ? h('span', { class: 'prf-pc' }, o.text) : prfPctEl(p), o.sub ? h('small', {}, o.sub) : null));
}
function prfStages(b) {
  return prfSec('stage', 'Heat by stage', 'Heat left by how full the bag was', h('div', { class: 'card prf-stages' }, PRF_STAGES.map((l, i) => {
    const p = prfRate(b.stageHeat[i], b.stageFeeds[i]);
    return h('div', { class: 'prf-stage' }, prfRing(p, { size: 64, sw: 6, col: p == null ? null : prfHeatCol(p) }), h('span', {}, l));
  })));
}
function prfWinCard(id, title, played, won, wonLabel) {
  const p = prfRate(won, played);
  return prfSec(id, title, null, h('div', { class: 'card prf-win' }, prfRing(p, { size: 116, sw: 9, arc: .75, grad: true, sub: 'Win rate', cls: 'big' }),
    h('dl', { class: 'prf-dl' }, h('div', {}, h('dt', {}, 'Played'), h('dd', {}, fmt(played || 0))), h('div', {}, h('dt', {}, wonLabel), h('dd', {}, fmt(won || 0))))));
}
function prfGifts(b) {
  const n = b.gifts || 0, c = b.giftChips || 0;
  return prfSec('gifts', 'Gifts', null, h('div', { class: 'card prf-gifts' }, prfIco('🎁', '#FFD3DE'),
    h('div', { class: 'prf-gtx' }, h('b', {}, 'Trays you fed that a rival scooped'), h('span', {}, `${fmt(c)} chip${c === 1 ? '' : 's'} given`)),
    h('span', { class: 'prf-gnum num' }, fmt(n))));
}
function prfDetails(b) {
  const tiles = [['Chips scooped', fmt(b.chips || 0)], ['Scoops', fmt(b.scoops || 0)], ['Biggest scoop', b.biggest ? String(b.biggest) : null], ['Full trays', fmt(b.fullTrays || 0)],
    ['Traps sprung', fmt(b.sprung || 0)], ['Boil-overs', fmt(b.boils || 0)], ['Peeks used', fmt(b.peeksUsed || 0)], ['Swaps used', fmt(b.swapsUsed || 0)],
    ['Emotes sent', fmt(b.emotes || 0)], ['Time at the table', prfDur(b.playMs)], ['Playing since', prfDate(b.firstPlayed), true]];
  return prfSec('det', 'Details', null, h('div', { class: 'prf-dtiles' }, tiles.map(([l, v, wide]) => h('div', { class: 'prf-dtile' + (wide ? ' wide' : '') }, h('span', {}, l), h('b', {}, v == null ? prfNA() : v)))));
}
const PRF_GLOSS = [
  ['Playstyle', 'Heat left decides tight or loose; traps and boil-overs per turn decide passive or aggressive.'],
  ['Scoop rate', 'Of your turns with a scoop on offer, the share where you took one.'],
  ['Heat left', 'Average heat in trays you feed: the chance a rival can finish one before your next turn.'],
  ['Trap rate', 'Share of your feeds after which you still held a chip that completes that tray.'],
  ['Boil rate', 'Share of your turns where your chip boiled a tray over.'],
  ['Heat by stage', 'Heat left with over two thirds of the bag to come (Early), over a third (Mid), less (Late) and none (Empty bag).'],
  ['Hands', 'Hands played, and hands where you scored the most. Ties count as wins.'],
  ['Matches', 'Matches played, and matches you finished in first place.'],
  ['Gifts', 'Trays you fed last that a rival then scooped, and the chips in them.'],
  ['Chips scooped', 'Every chip in every tray you scooped: your points.'],
  ['Scoops', 'Trays you scooped.'],
  ['Biggest scoop', 'The most chips you have taken in a single scoop.'],
  ['Full trays', 'Six-chip trays you scooped.'],
  ['Traps sprung', 'Hot trays you fed and then scooped yourself.'],
  ['Boil-overs', 'Trays you boiled over with a sixth chip.'],
  ['Peeks used', 'Times you looked at a chip the next rival holds.'],
  ['Swaps used', 'Times you traded a chip in your hand for one from the bag.'],
  ['Emotes sent', 'Emotes you sent at the table.'],
  ['Time at the table', 'Time spent in matches, lessons not included.'],
  ['Playing since', 'The day of your first counted match on this device.'],
];
function prfGlossary() {
  sheet((p, close) => {
    p.append(h('h3', {}, 'What the numbers mean'),
      h('dl', { class: 'prf-gloss' }, PRF_GLOSS.map(([t, d]) => h('div', {}, h('dt', {}, t), h('dd', {}, d)))),
      h('p', { class: 'prf-fine' }, 'Only your own turns count. Lessons are left out.'),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Close')));
  }, { label: 'What the numbers mean' });
}

/* ---------- buying avatars and emotes ---------- */
// Confirm sheet for a Gem-priced avatar or emote: spend, grant, then equip (an emote goes into the selected slot).
function prfBuySheet(cat, it) {
  const price = it.price;
  sheet((p, close) => {
    const can = bal('gems') >= price, rar = RARITY[it.rarity] || RARITY.common;
    const art = cat === 'avatar' ? avatarEl(it.id, 96) : h('span', { class: 'prf-bigemo', 'aria-hidden': 'true' }, it.e);
    p.append(h('div', { class: 'eyebrow prf-buyeye' }, `${rar.label} ${CAT_ONE[cat]}`),
      h('h3', { class: 'prf-buyh' }, `Buy ${it.name} for `, h('span', { class: 'prf-gp', html: curIcon('gems', 24) }), fmt(price), h('span', { class: 'sr-only' }, price === 1 ? ' Gem' : ' Gems')),
      h('div', { class: 'prf-buyart', style: `--rc:${rar.col}` }, art),
      h('p', {}, can ? (cat === 'avatar' ? 'It becomes your avatar straight away.' : `It goes into slot ${prfSlot + 1} at the table, in place of ${(emoteOf(S.emoteSet[prfSlot]) || { name: 'nothing' }).name}.`) : `You need ${fmt(price - bal('gems'))} more ${curName('gems', price - bal('gems'))}.`),
      h('p', { class: 'prf-have' }, 'You have ', h('span', { class: 'prf-gp', html: curIcon('gems', 16) }), amountText('gems', bal('gems'))));
    let used = false;
    const ok = h('button', { class: 'btn cta' }, can ? h('span', { class: 'prf-gp', html: curIcon('gems', 18) }) : null, can ? `Buy · ${fmt(price)}` : 'Get Gems');
    ok.addEventListener('click', () => {
      if (used || !sheetOpen()) return; used = true;
      if (!can) { close(); goShop('gems'); return; }
      if (!spend('gems', price)) { used = false; return; }
      grant(cat, it.id);
      if (cat === 'avatar') S.profile.avatar = it.id;
      else { const j = S.emoteSet.indexOf(it.id); if (j < 0) S.emoteSet[prfSlot] = it.id; }
      save(); close(); refresh();
      toast(cat === 'avatar' ? `${it.name} is yours and equipped` : `${it.name} is yours, in slot ${prfSlot + 1}`);
    });
    p.append(h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Cancel'), ok));
  }, { label: `Buy ${it.name}` });
}

/* ---------- avatar screen ---------- */
let prfAvaCat = 'people', prfAvaSel = null;
const prfAvaState = a => S.profile.avatar === a.id ? 'on' : owns('avatar', a.id) ? 'own' : a.price != null ? 'buy' : 'lock';
const PRF_LOCKED = 'Found in chests, boxes and the season pass';
// cat: 'avatar' or 'emote'. Trophy items say which trophies unlock them.
const prfLockText = (it, cat) => it.trophy ? trItemSource(cat, it.id) || 'Earned in the Trophy Cabinet' : it.exclusive ? 'Premium season pass only' : PRF_LOCKED;
function prfAvatarScreen() {
  prfAvaSel = prfAva(S.profile.avatar).id; prfAvaCat = prfAva(prfAvaSel).cat;
  pushScreen('Avatar', prfAvatarBuild, { right: () => curPill('gems') });
}
function prfAvatarBuild(box) {
  const a = prfAva(prfAvaSel), st = prfAvaState(a), rar = RARITY[a.rarity];
  const status = st === 'on' ? icon('check', 14) + '<span>Equipped</span>' : st === 'own' ? '<span>Owned · tap to equip</span>'
    : st === 'buy' ? curIcon('gems', 15) + `<span>${fmt(a.price)}</span>` : icon('lock', 14) + `<span>${prfLockText(a, 'avatar')}</span>`;
  box.append(h('div', { class: 'prf-avprev s-' + st, style: `--rc:${rar.col};--ab:${a.bg}` },
    h('span', { class: 'prf-avbig' }, avatarEl(a.id, 112)), h('h2', {}, a.name),
    h('div', { class: 'prf-avmeta' }, rarTag(a.rarity), h('span', { class: 'prf-avst', html: status }))));
  const seg = h('div', { class: 'seg prf-seg', role: 'group', 'aria-label': 'Avatar category' });
  AVATAR_CATS.forEach(([k, label]) => {
    const list = AVATARS.filter(x => x.cat === k), n = list.filter(x => owns('avatar', x.id)).length;
    const b = h('button', { 'aria-pressed': String(prfAvaCat === k), 'data-fk': 'prf-acat:' + k, 'aria-label': `${label}, ${n} of ${list.length} owned` }, label, h('small', { class: 'prf-segn' }, `${n}/${list.length}`));
    b.addEventListener('click', () => { prfAvaCat = k; refresh(); });
    seg.append(b);
  });
  const grid = h('div', { class: 'prf-agrid' }, AVATARS.filter(x => x.cat === prfAvaCat).map(prfAvaCell));
  prfSegKeep(seg, 'ava');
  box.append(seg, grid, h('p', { class: 'prf-fine prf-foot' }, prfAvaCat === 'mystery' ? 'Mystery avatars only come from chests, boxes and the season pass.' : prfAvaCat === 'trophy' ? 'Trophy avatars are never sold. Tap one to see which trophies earn it.' : 'Tap one you own to wear it. Priced ones cost Gems.'));
  if (prfAvaCat === 'trophy') { const tb = h('button', { class: 'btn smallbtn prf-totr', 'data-fk': 'prf-totr' }, trMedal('gold', 18), 'See your trophies'); tb.addEventListener('click', trOpenCabinet); box.append(tb); }
}
function prfAvaCell(a) {
  const st = prfAvaState(a), rar = RARITY[a.rarity].label;
  const lab = `${a.name}, ${rar}. ${st === 'on' ? 'Equipped' : st === 'own' ? 'Owned. Tap to equip' : st === 'buy' ? `${amountText('gems', a.price)}. Tap to buy` : `Locked. ${prfLockText(a, 'avatar')}`}`;
  const b = h('button', { class: `prf-acell s-${st}${a.id === prfAvaSel ? ' sel' : ''}`, 'data-fk': 'prf-a:' + a.id, 'aria-label': lab, 'aria-current': st === 'on' ? 'true' : null, style: `--rc:${RARITY[a.rarity].col}` },
    h('span', { class: 'prf-aface' }, avatarEl(a.id, 64),
      st === 'on' ? h('span', { class: 'prf-check', html: icon('check', 13) }) : st === 'lock' ? h('span', { class: 'prf-lock', html: icon('lock', 12) }) : null,
      st === 'buy' ? h('span', { class: 'prf-price', html: curIcon('gems', 13) + `<b>${fmt(a.price)}</b>` }) : null),
    h('span', { class: 'prf-aname' }, a.name));
  b.addEventListener('click', () => prfAvaTap(a));
  return b;
}
function prfAvaTap(a) {
  const st = prfAvaState(a), first = prfAvaSel !== a.id;
  prfAvaSel = a.id;
  if (st === 'on') { if (first) refresh(); return; }
  if (st === 'own') { S.profile.avatar = a.id; save(); refresh(); toast(`${a.name} equipped`); return; }
  if (a.price === 0) { grant('avatar', a.id); S.profile.avatar = a.id; save(); refresh(); toast(`${a.name} equipped`); return; }
  refresh();
  if (st === 'lock') { toast(prfLockText(a, 'avatar')); return; }
  prfBuySheet('avatar', a);
}

/* ---------- emotes screen ---------- */
let prfSlot = 0;
function prfEmotesScreen() { prfSlot = 0; pushScreen('Emotes', prfEmotesBuild, { right: () => curPill('gems') }); }
function prfEmotesBuild(box) {
  const set = S.emoteSet, cur = emoteOf(set[prfSlot]);
  const slots = h('div', { class: 'prf-slots', role: 'group', 'aria-label': 'Emotes at the table' }, set.map((id, i) => {
    const e = emoteOf(id), on = i === prfSlot;
    const b = h('button', { class: 'prf-slot' + (on ? ' on' : ''), 'aria-pressed': String(on), 'data-fk': 'prf-slot:' + i, 'aria-label': `Slot ${i + 1}: ${e ? e.name : 'empty'}` },
      h('i', { 'aria-hidden': 'true' }, String(i + 1)), h('span', { 'aria-hidden': 'true' }, e ? e.e : '＋'));
    b.addEventListener('click', () => { prfSlot = i; refresh(); });
    return b;
  }));
  box.append(h('h2', { class: 'sec prf-sec1' }, 'At the table', h('small', {}, `Slot ${prfSlot + 1} · ${cur ? cur.name : 'Empty'}`)), slots,
    h('p', { class: 'prf-hint', html: `${icon('info', 16)}<span>Pick a slot, then tap an emote you own to place it there or swap it in.</span>` }));
  const grid = h('div', { class: 'prf-egrid' }, EMOTES.map(e => {
    const own = owns('emote', e.id), j = set.indexOf(e.id), st = j >= 0 ? 'set' : own ? 'own' : e.price != null ? 'buy' : 'lock';
    const lab = `${e.name}, ${RARITY[e.rarity].label}. ${st === 'set' ? `In slot ${j + 1}` : st === 'own' ? `Owned. Tap to put in slot ${prfSlot + 1}` : st === 'buy' ? `${amountText('gems', e.price)}. Tap to buy` : `Locked. ${prfLockText(e, 'emote')}`}`;
    const b = h('button', { class: `prf-ecell s-${st}`, 'data-fk': 'prf-e:' + e.id, 'aria-label': lab, style: `--rc:${RARITY[e.rarity].col}` },
      h('span', { class: 'prf-eemo', 'aria-hidden': 'true' }, e.e), h('span', { class: 'prf-ename' }, e.name),
      st === 'set' ? h('span', { class: 'prf-eslot', 'aria-hidden': 'true' }, String(j + 1)) : st === 'lock' ? h('span', { class: 'prf-lock', html: icon('lock', 12) }) : null,
      st === 'buy' ? h('span', { class: 'prf-price', html: curIcon('gems', 13) + `<b>${fmt(e.price)}</b>` }) : null);
    b.addEventListener('click', () => prfEmoteTap(e));
    return b;
  }));
  const n = EMOTES.filter(e => owns('emote', e.id)).length;
  box.append(h('h2', { class: 'sec' }, 'All emotes', h('small', {}, `${n} of ${EMOTES.length} owned`)), grid);
}
function prfEmoteTap(e) {
  const set = S.emoteSet;
  if (owns('emote', e.id)) {
    const j = set.indexOf(e.id), was = emoteOf(set[prfSlot]);
    if (j === prfSlot) { toast(`${e.name} is already in slot ${prfSlot + 1}`); return; }
    if (j >= 0) { set[j] = set[prfSlot]; set[prfSlot] = e.id; toast(`Swapped: ${e.name} to slot ${prfSlot + 1}${was ? `, ${was.name} to slot ${j + 1}` : ''}`); }
    else { set[prfSlot] = e.id; toast(`${e.name} in slot ${prfSlot + 1}`); }
    save(); refresh(); return;
  }
  if (e.price == null) { toast(prfLockText(e, 'emote')); return; }
  if (e.price === 0) { grant('emote', e.id); save(); prfEmoteTap(e); return; }
  prfBuySheet('emote', e);
}

