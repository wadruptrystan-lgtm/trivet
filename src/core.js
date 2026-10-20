'use strict';
/* ================= utilities ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
}
const fmt = n => Math.round(n).toLocaleString('en-US');
const pct = p => Math.round(p * 100) + '%';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
const sysRM = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => sysRM.matches || (S && S.settings.reduceMotion);
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

const IC = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2"/>',
  play: '<circle cx="12" cy="11" r="6.5"/><circle cx="7" cy="20.5" r="1.2" fill="currentColor"/><circle cx="12" cy="21.5" r="1.2" fill="currentColor"/><circle cx="17" cy="20.5" r="1.2" fill="currentColor"/>',
  kiln: '<path d="M5 20V10a7 7 0 0 1 14 0v10z"/><path d="M9 20v-4a3 3 0 0 1 6 0v4"/>',
  collection: '<circle cx="8.5" cy="9" r="4.5"/><circle cx="15.5" cy="9" r="4.5"/><circle cx="12" cy="15.5" r="4.5"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  spark: '<path d="M12 2l2.2 6.4L21 10l-5.6 3.9L17.2 21 12 16.8 6.8 21l1.8-7.1L3 10l6.8-1.6z" fill="currentColor" stroke="none"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  dots: '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  shop: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/>',
  league: '<path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 6H5.2a3 3 0 0 0 3 4.2M16 6h2.8a3 3 0 0 1-3 4.2M12 14v4M8.5 20.5h7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r="1.1" fill="currentColor" stroke="none"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M3 9h18M12 9v11"/><path d="M12 9c-1.5-3.5-5.5-4.5-5.5-2S10 9 12 9c2 0 5.5-.5 5.5-2S13.5 5.5 12 9z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  ad: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.2v5.6l4.6-2.8z" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const icon = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;
const trivetArt = (cls = 'trivet-art') => `<svg class="${cls}" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="88" r="62" fill="none" stroke="var(--line)" stroke-width="3"/><circle cx="62" cy="172" r="6" fill="var(--line)"/><circle cx="100" cy="178" r="6" fill="var(--line)"/><circle cx="138" cy="172" r="6" fill="var(--line)"/></svg>`;

/* ================= catalog ================= */
const V = Scoop.VENUES, P = Scoop.PERSONALITIES;
const VENUE_ORDER = ['cafe', 'noodle', 'tea', 'supper', 'glasshouse'];
const VENUE_UI = {
  cafe: { blurb: 'Heads-up against a regular. Every aid switched on.', paid: 'Winner paid', tray: 'enamel' },
  noodle: { blurb: 'Three seats. Hold a tray to see what it needs.', paid: 'Top 2 paid', tray: 'lacquer' },
  tea: { blurb: 'Heads-up and quiet. Heat shows as colour only.', paid: 'Winner paid', tray: 'celadon' },
  supper: { blurb: 'Four seats and Sol at the head of the table.', paid: 'Top 3 paid', tray: 'copper' },
  glasshouse: { blurb: 'The best in town. Twenty seconds a turn.', paid: 'Top 3 paid', tray: 'glass' },
};
const AID_TEXT = { full: 'Heat %, needed numbers and full move previews', 'full-longpress': 'Heat % and previews. Hold a tray to see what it needs', colour: 'Heat colours only' };
const CHATTER = {
  rico: { scoop: ['Hot tray, hot hands.', 'All of it. Mine.', 'Told you it was hot.'], boil: ['Oops. Too hot.'], scooped: ['I was feeding that!', 'Enjoy it.'], win: ['Hot hands win.'], lose: ['Next time I feed faster.'] },
  priya: { scoop: ['Mine. Next!', 'Quick hands.', 'Snap.'], boil: ['Gone.'], scooped: ['Oh, come on.', 'Fair.'], win: ['Next!'], lose: ['Rematch?'] },
  mabel: { scoop: ["I'll take that, dear.", 'Patience pays.', 'There it is.'], boil: ['Shame to waste it.'], scooped: ['Well played, dear.', 'Hm.'], win: ["I did say I'd hold on."], lose: ['Lovely game, dear.'] },
  otto: { scoop: ["Fine, I'll have it."], boil: ['Nobody gets that one.', 'Boiled.', 'Not today.'], scooped: ['Hmph.'], win: ['Spoiled it for you.'], lose: ['You got lucky.'] },
  june: { scoop: ["There's one left. It isn't yours.", 'Counted.', 'As expected.'], boil: ['Too many out.'], scooped: ['Noted.'], win: ['The numbers were mine.'], lose: ['Recounting.'] },
  sol: { scoop: ['Go on. Feed it.', 'Sprung.', 'Thank you.'], boil: ['Shame.'], scooped: ['You read that.'], win: ['Every tray is a trap.'], lose: ['Well read.'] },
};
const TIER_COL = ['#B7826A', '#D2694A', '#8E9AA8', '#EDE6DC', '#D6A945'];

// how: 'default' | 'shop' | 'level' | 'venue' | 'kiln' | 'trophy' (trophy items are never sold, rolled or given by the season pass)
const COSMETICS = {
  glaze: [
    { id: 'porcelain', name: 'Porcelain', how: 'default' },
    { id: 'celadon', name: 'Celadon', how: 'level', lvl: 3 },
    { id: 'terrazzo', name: 'Terrazzo', how: 'shop', rarity: 'common', price: 2500 },
    { id: 'obsidian', name: 'Obsidian', how: 'shop', rarity: 'common', price: 2500 },
    { id: 'brass', name: 'Brass', how: 'shop', rarity: 'rare', price: 10000 },
    { id: 'frost', name: 'Frosted Glass', how: 'shop', rarity: 'rare', price: 10000 },
    { id: 'marble', name: 'Marble', how: 'level', lvl: 18 },
    { id: 'spectrum', name: 'Spectrum Rims', how: 'shop', rarity: 'epic', price: 40000 },
    { id: 'goldleaf', name: 'Gold Leaf Rim', how: 'kiln' },
    { id: 'raku', name: 'Raku', how: 'trophy' },
    { id: 'platinum', name: 'Platinum', how: 'trophy' },
  ],
  num: [
    { id: 'fraunces', name: 'Soft Clay', how: 'default' },
    { id: 'dmserif', name: 'Inkwell', how: 'level', lvl: 6 },
    { id: 'bricolage', name: 'Workshop', how: 'shop', rarity: 'common', price: 2500 },
    { id: 'majormono', name: 'Kiln Stamp', how: 'shop', rarity: 'rare', price: 10000 },
    { id: 'pips', name: 'Pips', how: 'level', lvl: 20 },
  ],
  tray: [
    { id: 'slate', name: 'Slate', how: 'default' },
    { id: 'enamel', name: 'Café Enamel', how: 'venue', venue: 'cafe' },
    { id: 'lacquer', name: 'Lacquer', how: 'venue', venue: 'noodle' },
    { id: 'celadon', name: 'Celadon', how: 'venue', venue: 'tea' },
    { id: 'copper', name: 'Copper', how: 'venue', venue: 'supper' },
    { id: 'glass', name: 'Glass', how: 'venue', venue: 'glasshouse' },
    { id: 'cork', name: 'Cork', how: 'level', lvl: 9 },
    { id: 'neon', name: 'Neon Outline', how: 'shop', rarity: 'rare', price: 10000 },
    { id: 'kintsugi', name: 'Kintsugi', how: 'trophy' },
  ],
  table: [
    { id: 'aubergine', name: 'Aubergine Night', how: 'default' },
    { id: 'ink', name: 'Ink Blue', how: 'shop', rarity: 'common', price: 2500 },
    { id: 'moss', name: 'Moss', how: 'level', lvl: 12 },
    { id: 'espresso', name: 'Espresso', how: 'shop', rarity: 'common', price: 2500 },
    { id: 'lantern', name: 'Lantern Night', how: 'trophy' },
  ],
  sound: [
    { id: 'porcelain', name: 'Porcelain Clinks', how: 'default' },
    { id: 'marimba', name: 'Marimba', how: 'shop', rarity: 'common', price: 2500 },
    { id: 'musicbox', name: 'Music Box', how: 'level', lvl: 15 },
    { id: 'glassharp', name: 'Glass Harp', how: 'shop', rarity: 'rare', price: 10000 },
  ],
};
const CAT_LABEL = { glaze: 'Glazes', num: 'Numerals', tray: 'Trays', table: 'Tables', sound: 'Sounds' };
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8], 7: [0, 2, 3, 4, 5, 6, 8], 8: [0, 1, 2, 3, 5, 6, 7, 8] };

/* ================= persistent state ================= */
const KEY = 'trivet.v1';
let S = null;
function dayKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function weekStart(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function isoWeekNum(d = new Date()) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return y * 100 + w; }
const DAILY_EPOCH = Date.UTC(2026, 0, 1);
const dailyNo = (d = new Date()) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - DAILY_EPOCH) / 864e5) + 1;
function DEFAULT() {
  return {
    v: 1, sparks: 1000, xp: 0, seed: (Math.random() * 4294967296) >>> 0, tutorialDone: false, lastVenue: 'cafe',
    giftDay: null, refillAt: 0, firstWinDay: null,
    daily: { lastDay: null, lastWonDay: null, streak: 0, runWins: 0, line: null },
    kiln: { week: isoWeekNum(), tier: 0, xp: 0, lastWeekXP: 0, result: null },
    owned: { glaze: ['porcelain'], num: ['fraunces'], tray: ['slate'], table: ['aubergine'], sound: ['porcelain'], avatar: [...DEFAULT_OWNED_X.avatar], emote: [...DEFAULT_OWNED_X.emote] },
    equip: { glaze: 'porcelain', num: 'fraunces', tray: 'slate', table: 'aubergine', sound: 'porcelain' },
    settings: { fastAI: false, pro: false, sound: true, monoHeat: false, reduceMotion: false },
    stats: { matches: 0, wins: 0, scoops: 0, chips: 0, biggest: 0, sprung: 0, boils: 0, fullTrays: 0, venue: {} },
    ach: {}, firstWin: {}, cafeOpp: 0,
    wallet: { gems: 50, swaps: 3, peeks: 3, spins: 5 },
    profile: { name: 'Player ' + (1000 + Math.floor(Math.random() * 9000)), avatar: 'otter' },
    season: { id: seasonId(), xp: 0, premium: false, claimedFree: [], claimedPrem: [] },
    arcade: { wheelFreeDay: null, wheelPity: 0, reelsPity: 0, reelsClaimAt: 0 },
    ads: { day: null, watched: 0, got: [], mystery: false },
    plus: { until: 0, lastDay: null },
    emoteSet: ['nice', 'ha', 'wow', 'yikes', 'hot', 'hi'],
    bankPeak: 1000, mockBuys: 0, stats2: {}, troph: TR0(),
  };
}
const DEFAULT_OWNED_X = { avatar: ['chef', 'artist', 'gran', 'otter', 'cat'], emote: ['nice', 'ha', 'wow', 'yikes', 'hot', 'hi'] };
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw), d = DEFAULT();
      const m = { ...d, ...o, daily: { ...d.daily, ...o.daily }, kiln: { ...d.kiln, ...o.kiln }, owned: { ...d.owned, ...o.owned }, equip: { ...d.equip, ...o.equip }, settings: { ...d.settings, ...o.settings }, stats: { ...d.stats, ...o.stats } };
      for (const k of ['wallet', 'profile', 'season', 'arcade', 'ads', 'plus']) m[k] = { ...d[k], ...(o[k] || {}) };
      // Saves from before the stats rework seed the career bucket so totals carry over.
      if (!o.stats2) {
        const a = STAT0(), os = m.stats; ['matches', 'wins', 'scoops', 'chips', 'biggest', 'sprung', 'boils', 'fullTrays'].forEach(k => { a[k] = os[k] || 0; });
        m.stats2 = { all: a };
        for (const vk in os.venue || {}) { const b = STAT0(); b.matches = os.venue[vk].played || 0; b.wins = os.venue[vk].won || 0; m.stats2[vk] = b; }
      }
      // Saves from before trophies get v 0, so trInit() can carry their achievements over once.
      m.troph = o.troph ? { ...TR0(), ...o.troph, c: { ...TR0().c, ...(o.troph.c || {}) } } : { ...TR0(), v: 0 };
      m.bankPeak = Math.max(m.bankPeak || 0, m.sparks);
      m.v = 2;
      return m;
    }
  } catch (e) { }
  return DEFAULT();
}
function save() { if (S) { S.bankPeak = Math.max(S.bankPeak || 0, S.sparks); trAuto(); S.bankPeak = Math.max(S.bankPeak, S.sparks); } try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }

const level = () => Scoop.levelFromXP(S.xp);
const owns = (cat, id) => S.owned[cat].includes(id);
function grant(cat, id) { if (!owns(cat, id)) { S.owned[cat].push(id); return true; } return false; }
function itemOf(cat, id) { return COSMETICS[cat].find(x => x.id === id); }
function addSparks(n) { S.sparks += n; updatePills('sparks', true); }
// Adds XP, applies level rewards. Returns [{level, sparks, item}] for each level gained.
function addXP(n) {
  const before = level().level;
  S.xp += n;
  if (S.kiln.week !== isoWeekNum()) settleKiln();
  S.kiln.xp += n;
  ensureSeason().xp += n;
  const after = level().level, ups = [];
  for (let L = before + 1; L <= after; L++) {
    const sp = 100 * L; S.sparks += sp;
    let item = null;
    for (const cat in COSMETICS) for (const it of COSMETICS[cat]) if (it.how === 'level' && it.lvl === L && grant(cat, it.id)) item = { cat, it };
    ups.push({ level: L, sparks: sp, item });
  }
  return ups;
}
function settleKiln() {
  const k = S.kiln, now = isoWeekNum();
  if (k.week === now) return;
  const rows = kilnRows(k.week, k.tier, k.xp, 7);
  const me = rows.find(r => r.me), place = me.rank;
  const KL = Scoop.KILN, mult = place <= 3 ? KL.placeMult[place - 1] : place <= 10 ? 1 : 0.25;
  const rm = bankRank().mult, reward = Math.round(KL.base[k.tier] * mult * rm);
  let tier = k.tier, move = 'stay';
  if (place <= 4 && tier < 4) { tier++; move = 'up'; } else if (place >= 17 && tier > 0) { tier--; move = 'down'; }
  const rim = k.tier === 4 && place <= 3 && grant('glaze', 'goldleaf');
  S.sparks += reward;
  S.kiln = { week: now, tier, xp: 0, lastWeekXP: k.xp, result: { place, reward, rankMult: rm, rim, move, from: k.tier, to: tier, xp: Math.round(k.xp), seen: false } };
}
function kilnRows(week, tier, myXP, tDays) {
  const rivals = Scoop.kilnRivals(week, tier, S.seed, S.kiln.lastWeekXP || 0);
  const rows = rivals.map(r => ({ name: r.name, glyph: r.glyph, xp: Math.round(Scoop.kilnXPAt(r, tDays)) }));
  rows.push({ name: 'You', glyph: 'Y', xp: Math.round(myXP), me: true });
  rows.sort((a, b) => b.xp - a.xp || (a.me ? -1 : b.me ? 1 : 0));
  rows.forEach((r, i) => r.rank = i + 1);
  return rows;
}
const weekDays = () => clamp((Date.now() - weekStart()) / 864e5, 0, 7);
function untilMonday() {
  const next = weekStart(); next.setDate(next.getDate() + 7);
  const ms = next - Date.now(), d = Math.floor(ms / 864e5), hr = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  return d ? `${d}d ${hr}h` : `${hr}h ${m}m`;
}

/* ================= sound (synthesised; each number is a scale degree) ================= */
const SND = (() => {
  let ctx = null, out = null;
  const SC = [0, 261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
  const PACKS = {
    porcelain: { amp: .45, att: .004, dec: .32, parts: [[2, 'sine', 1], [5.43, 'sine', .22]] },
    marimba: { amp: .6, att: .006, dec: .55, parts: [[1, 'sine', 1], [3.93, 'sine', .28]] },
    musicbox: { amp: .38, att: .003, dec: .95, parts: [[2, 'triangle', .8], [4, 'sine', .28], [6.02, 'sine', .08]] },
    glassharp: { amp: .32, att: .07, dec: 1.25, parts: [[2, 'sine', 1], [3, 'sine', .18]] },
  };
  function ac() {
    if (!S || !S.settings.sound) return null;
    try {
      if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); out = ctx.createGain(); out.gain.value = .32; out.connect(ctx.destination); }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { return null; }
    return ctx;
  }
  function voice(f, t, vel = 1, pack) {
    const c = ctx, P = PACKS[pack || S.equip.sound] || PACKS.porcelain, g = c.createGain();
    g.connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(.001, vel * P.amp), t + P.att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + P.dec);
    for (const [m, type, a] of P.parts) { const o = c.createOscillator(), pg = c.createGain(); o.type = type; o.frequency.value = f * m; pg.gain.value = a; o.connect(pg); pg.connect(g); o.start(t); o.stop(t + P.dec + .05); }
  }
  return {
    unlock() { ac(); },
    clink(v, pack) { const c = ac(); if (c) voice(SC[v] || 440, c.currentTime + .005, .9, pack); },
    trio(vals) {
      const c = ac(); if (!c) return;
      const set = vals[0] === vals[1] && vals[1] === vals[2];
      vals.forEach((v, i) => voice(SC[v] || 440, c.currentTime + .01 + (set ? 0 : i * .09), set ? .6 : .85));
      if (set) voice((SC[vals[0]] || 440) * 2, c.currentTime + .01, .4);
    },
    boil() {
      const c = ac(); if (!c) return;
      const len = .5, buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(2400, c.currentTime); bp.frequency.exponentialRampToValueAtTime(500, c.currentTime + len);
      g.gain.value = .5; src.connect(bp); bp.connect(g); g.connect(out); src.start();
    },
    tick() { const c = ac(); if (c) voice(880, c.currentTime, .25, 'porcelain'); },
    fanfare() { const c = ac(); if (!c) return; [1, 3, 5, 8].forEach((v, i) => voice(SC[v], c.currentTime + i * .1, .7)); },
  };
})();

/* ================= view helpers ================= */
const chipInner = v => `<span class="n" aria-hidden="true">${v}</span><span class="pips" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<i${PIPS[v].includes(i) ? ' class="on"' : ''}></i>`).join('')}</span>`;
function chipEl(v, cls = '', tag = 'span') {
  const el = document.createElement(tag);
  el.className = `chip v${v}${cls ? ' ' + cls : ''}`;
  el.dataset.v = v;
  el.innerHTML = chipInner(v);
  if (tag === 'button') { el.type = 'button'; el.setAttribute('aria-label', `Chip ${v}`); }
  else el.setAttribute('aria-hidden', 'true');
  return el;
}
// Re-face an existing chip button in place (keeps focus and any press in progress).
function setChipFace(el, v) {
  el.classList.remove('v' + el.dataset.v); el.classList.add('v' + v);
  el.dataset.v = v; el.innerHTML = chipInner(v);
}
const monoEl = (glyph, cls = '') => h('span', { class: 'mono ' + cls, 'aria-hidden': 'true' }, glyph);
function lvlRing(cls = 'lvl', R = 18) {
  const L = level(), p = L.need ? L.into / L.need : 1, C = 2 * Math.PI * R;
  const el = h('span', { class: cls, role: 'img', 'aria-label': `Level ${L.level}` });
  el.innerHTML = `<svg viewBox="0 0 ${2 * R + 6} ${2 * R + 6}" aria-hidden="true"><circle class="trk" cx="${R + 3}" cy="${R + 3}" r="${R}"/>${p > 0 ? `<circle class="bar" cx="${R + 3}" cy="${R + 3}" r="${R}" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${R + 3} ${R + 3})"/>` : ''}</svg><b>${L.level}</b>`;
  return el;
}
const sparksPill = o => curPill('sparks', o);
function applyTheme() {
  const a = $('#app'), keep = a.classList.contains('rm') && S.settings.reduceMotion;
  a.className = `table-${S.equip.table} glaze-${S.equip.glaze} num-${S.equip.num} tray-${S.equip.tray}${S.settings.monoHeat ? ' heat-mono' : ''}${S.settings.reduceMotion ? ' rm' : ''}`;
  document.documentElement.classList.toggle('rm', !!S.settings.reduceMotion);
  void keep;
}
let toastT;
function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
let sheetReturn = null, sheetReturnLabel = null, sheetDismiss = true, sheetOnClose = null;
const setScreensInert = on => $$('#app > .screen').forEach(s => { s.inert = on; });
const sheetOpen = () => $('#sheet').classList.contains('open');
// Bottom sheet. The screens behind it are made inert so focus and taps stay inside the sheet.
function sheet(build, o = {}) {
  const root = $('#sheet'); sheetReturn = document.activeElement; sheetReturnLabel = sheetReturn && sheetReturn.getAttribute ? sheetReturn.getAttribute('aria-label') : null;
  sheetDismiss = o.dismiss !== false; sheetOnClose = o.onClose || null;
  if (sheetReturn && sheetReturn.closest && sheetReturn.closest('#sheet')) { sheetReturn = null; }
  root.innerHTML = '';
  const panel = h('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true' });
  build(panel, closeSheet);
  const h3 = panel.querySelector('h3');
  if (h3) { h3.id = 'sheet-title'; panel.setAttribute('aria-labelledby', 'sheet-title'); } else panel.setAttribute('aria-label', o.label || 'Dialog');
  root.append(h('div', { class: 'scrim', onclick: () => { if (sheetDismiss) closeSheet(); } }), panel);
  root.hidden = false;
  setScreensInert(true);
  requestAnimationFrame(() => { root.classList.add('open'); const f = panel.querySelector('button:not(:disabled)'); if (f) { f.focus({ preventScroll: true }); f.scrollIntoView({ block: 'nearest' }); } });
}
function closeSheet() {
  const root = $('#sheet'); if (root.hidden) return;
  const pn = $('.panel', root); if (pn) pn.inert = true;
  root.classList.remove('open');
  setScreensInert(false);
  const cb = sheetOnClose; sheetOnClose = null;
  setTimeout(() => { if (!root.classList.contains('open')) { root.hidden = true; root.innerHTML = ''; } }, 280);
  if (cb) cb();
  let back = sheetReturn && sheetReturn.isConnected ? sheetReturn : null;
  if (!back && sheetReturnLabel) back = [...$$('#app [aria-label]')].find(el => el.getAttribute('aria-label') === sheetReturnLabel && !el.closest('#sheet'));
  if (back && back.focus) back.focus({ preventScroll: true });
}
function copyText(text, btn) {
  const done = () => toast('Copied');
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => selectFallback(btn));
    else selectFallback(btn);
  } catch (e) { selectFallback(btn); }
}
function selectFallback(btn) {
  const code = btn && btn.parentElement && btn.parentElement.querySelector('code');
  if (code) { const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Selected. Copy it from here.'); }
}
let CUR = 'home';
// Switch screens. Focus left inside a screen that is being hidden moves to the new screen.
function go(id) {
  if (id !== 'sub') while (STACK.length) { const t = STACK.pop(); if (t.o.onClose) t.o.onClose(); }
  CUR = id;
  const a = document.activeElement;
  ['home', 'table', 'result', 'recap', 'sub'].forEach(s => { $('#' + s).hidden = s !== id; });
  if (id === 'home') renderHome();
  if (id === 'sub') { renderSub(); $('#sub-views').scrollTop = 0; }
  if (a && a !== document.body && a.closest && a.closest('.screen[hidden]')) a.blur();
  const f = document.activeElement;
  if (!f || f === document.body || !f.isConnected || (f.closest && f.closest('[hidden]'))) {
    const t = id === 'home' ? $('.tabs button[aria-current="page"]') : id === 'recap' ? $('#rc-back') : id === 'sub' ? $('#sub-back') : null;
    if (t) t.focus({ preventScroll: true });
  }
}
