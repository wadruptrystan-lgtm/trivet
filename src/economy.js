/* ================= economy: wallet, rewards, store mocks, sub-screens ================= */
// Shared contract for the feature modules (shop, arcade, season, profile, table):
//   bal(k) / gain(k, n) / spend(k, n) -> bool      k: 'sparks' | 'gems' | 'swaps' | 'peeks' | 'spins'
//   revealRewards(list, {title, skipIntro, eyebrow}) -> Promise   applies every reward at once (and saves), then plays the box reveal
//   applyReward(r) -> got; revealGot([got], o)    grant first, reveal later (survives leaving mid-animation)
//   mockPurchase({title, price, sub, iconEl, onSuccess})  simulated checkout sheet; never asks for or takes payment
//   mockAd(onReward, {label})                     five-second placeholder; onReward runs only if watched to the end
//   pushScreen(title, build, o) / popScreen() / refresh()   full-screen sub-pages stacked over the lobby
//   bumpStats(mode, b => { ... })                 mode: venue key or 'daily'; the 'all' bucket is bumped too
const CURS = ['sparks', 'gems', 'swaps', 'peeks', 'spins'];
const CUR_NAME = { sparks: ['Spark', 'Sparks'], gems: ['Gem', 'Gems'], swaps: ['Swap', 'Swaps'], peeks: ['Peek', 'Peeks'], spins: ['Spin', 'Spins'] };
const CUR_ACTION = { sparks: 'Get more Sparks', gems: 'Get more Gems', swaps: 'Get more Swaps', peeks: 'Get more Peeks', spins: 'Get more Spins' };
const curName = (k, n) => CUR_NAME[k][n === 1 ? 0 : 1];
const amountText = (k, n) => `${fmt(n)} ${curName(k, n)}`;
const bal = k => k === 'sparks' ? S.sparks : (S.wallet[k] || 0);
// Compact amounts for tiles: 10K, 37.5K, 1.2M. Below 10,000 the exact figure; never rounds up.
function short(n) {
  const cut = (v, d) => String(Math.floor(v * 10 ** d) / 10 ** d);
  if (n >= 1e9) return cut(n / 1e9, n >= 1e10 ? 0 : 1) + 'B';
  if (n >= 1e6) return cut(n / 1e6, n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e4) return cut(n / 1e3, n >= 1e5 ? 0 : 1) + 'K';
  return fmt(n);
}
function gain(k, n) { if (k === 'sparks') S.sparks += n; else S.wallet[k] = (S.wallet[k] || 0) + n; updatePills(k, true); }
function spend(k, n) { if (bal(k) < n) return false; if (k === 'sparks') S.sparks -= n; else S.wallet[k] -= n; updatePills(k); return true; }
const plusActive = () => !!(S.plus && S.plus.until > Date.now());

/* ---------- icons (gradients live in one hidden sprite so every icon can share them) ---------- */
const GRAD = {
  sparks: ['#FFE6C2', '#FFB37A', '#EE7440'], gems: ['#C9F0FF', '#5DB9F5', '#2C64D2'], swaps: ['#DDF7C9', '#93D670', '#4A9A35'],
  peeks: ['#E6E0FF', '#A99CF4', '#6656D2'], spins: ['#FFD6C8', '#FF8F70', '#D9472F'], wood: ['#E2AE77', '#B57744', '#7D4A25'],
  silver: ['#FBFCFE', '#C2CAD6', '#7E8898'], gold: ['#FFF3C2', '#F3C452', '#B07F22'],
};
(function injectGradients() {
  const defs = Object.entries(GRAD).map(([k, [a, b, c]]) => `<linearGradient id="g-${k}" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>${defs}</defs></svg>`);
})();
const DISC = g => `<circle cx="16" cy="16" r="13.5" fill="url(#g-${g})"/><circle cx="16" cy="16" r="13" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/><circle cx="16" cy="16" r="13.5" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1"/>`;
function chestSVG(g, lock) {
  return `<path d="M5 15h22v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="url(#g-${g})"/><path d="M5 15h22v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="#000" fill-opacity=".14"/>`
    + `<path d="M5 15v-3a8 8 0 0 1 8-8h6a8 8 0 0 1 8 8v3z" fill="url(#g-${g})"/><path d="M9 6.5c2-1.3 4-1.7 6-1.7" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
    + `<path d="M5 14h22v2.8H5z" fill="#000" fill-opacity=".3"/><path d="M10 4.8V28M22 4.8V28" stroke="#000" stroke-opacity=".16" stroke-width="2"/>`
    + `<rect x="13.1" y="12.2" width="5.8" height="7.4" rx="1.7" fill="${lock}" stroke="#000" stroke-opacity=".32"/><circle cx="16" cy="15.4" r="1.05" fill="#000" fill-opacity=".5"/>`;
}
function boxSVG(c) {
  return `<path d="M16 3l12 6.5-12 6.5L4 9.5z" style="fill:color-mix(in oklab,${c} 55%,white)"/><path d="M4 9.5l12 6.5v13L4 22.5z" style="fill:${c}"/>`
    + `<path d="M28 9.5L16 16v13l12-6.5z" style="fill:color-mix(in oklab,${c} 62%,black)"/><path d="M9.8 6.4l12 6.5v4.4" stroke="#fff" stroke-opacity=".65" stroke-width="2.4" fill="none"/>`
    + `<text x="10" y="24.6" font-size="9.5" font-weight="800" fill="#fff" font-family="Manrope,system-ui,sans-serif" text-anchor="middle">?</text>`;
}
const CUR_SVG = {
  sparks: '<path d="M16 2Q18 14 30 16Q18 18 16 30Q14 18 2 16Q14 14 16 2Z" fill="url(#g-sparks)"/><path d="M16 2Q18 14 30 16Q18 18 16 30Q14 18 2 16Q14 14 16 2Z" fill="none" stroke="#000" stroke-opacity=".15"/><path d="M15.2 8.5c-.4 2.6-1.3 4.5-3 5.8" stroke="#fff" stroke-opacity=".75" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
  gems: '<path d="M9 5h14l6 8-13 15L3 13z" fill="url(#g-gems)"/><path d="M9 5h14l-4 8h-6z" fill="#fff" fill-opacity=".32"/><path d="M3 13h26M9 5l4 8 3-8 3 8 4-8M13 13l3 15 3-15" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.1" stroke-linejoin="round"/><path d="M9 5h14l6 8-13 15L3 13z" fill="none" stroke="#000" stroke-opacity=".2" stroke-linejoin="round"/>',
  swaps: DISC('swaps') + '<path d="M9.5 12.8h12.2m-3.6-3.6 3.6 3.6-3.6 3.6M22.5 19.2H10.3m3.6-3.6-3.6 3.6 3.6 3.6" fill="none" stroke="#173312" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  peeks: DISC('peeks') + '<path d="M6.5 16c2.6-4.6 6-6.2 9.5-6.2s6.9 1.6 9.5 6.2c-2.6 4.6-6 6.2-9.5 6.2S9.1 20.6 6.5 16z" fill="#fff"/><circle cx="16" cy="16" r="3.5" fill="#2B2160"/><circle cx="17.3" cy="14.7" r="1.1" fill="#fff"/>',
  spins: DISC('spins') + '<rect x="7" y="10.5" width="18" height="11" rx="3" fill="#fff"/><path d="M13 10.5v11M19 10.5v11" stroke="#D9472F" stroke-opacity=".35"/><path d="M9.4 14.2h2.1l-1.3 3.7M15 14.2h2.1l-1.3 3.7M20.6 14.2h2.1l-1.3 3.7" stroke="#7A2213" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  'chest-wooden': chestSVG('wood', '#F3C452'), 'chest-silver': chestSVG('silver', '#FFE9A8'), 'chest-golden': chestSVG('gold', '#FFF6D6'),
};
function curIcon(k, s = 20) {
  let body = CUR_SVG[k];
  if (!body && k.startsWith('box-')) body = boxSVG((RARITY[k.slice(4)] || RARITY.common).col);
  return `<svg class="cur cur-${k}" width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${body || ''}</svg>`;
}

/* ---------- balance pills ---------- */
// A pill is a span (role img) or, given onClick, a button that leads to the shop. updatePills() keeps every pill on screen current.
function curPill(k, o = {}) {
  const el = h(o.onClick ? 'button' : 'span', { class: 'cpill' + (k === 'sparks' ? ' sparks' : '') + (o.cls ? ' ' + o.cls : ''), 'data-cur': k, 'data-fk': o.onClick ? 'pill:' + k : null, 'data-act': o.onClick ? (o.action || CUR_ACTION[k]) : null });
  el.innerHTML = curIcon(k, o.size || 18) + `<span class="pv">${fmt(bal(k))}</span>` + (o.onClick && o.plus !== false ? '<i class="pplus" aria-hidden="true">+</i>' : '');
  if (o.onClick) el.addEventListener('click', o.onClick); else el.setAttribute('role', 'img');
  el.setAttribute('aria-label', amountText(k, bal(k)) + (o.onClick ? `. ${el.dataset.act}` : ''));
  return el;
}
function updatePills(k, bump) {
  $$(k ? `.cpill[data-cur="${k}"]` : '.cpill[data-cur]').forEach(el => {
    const c = el.dataset.cur, v = el.querySelector('.pv'); if (v) v.textContent = fmt(bal(c));
    el.setAttribute('aria-label', amountText(c, bal(c)) + (el.dataset.act ? `. ${el.dataset.act}` : ''));
    if (bump && !reduced()) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  });
}

/* ---------- rarity, avatars, emotes ---------- */
const RARITY = {
  common: { label: 'Common', col: '#A9B4C6', dupe: 10, box: 1000 },
  rare: { label: 'Rare', col: '#62A9FF', dupe: 25, box: 2500 },
  epic: { label: 'Epic', col: '#B386FF', dupe: 60, box: 6000 },
  legendary: { label: 'Legendary', col: '#FFB23F', dupe: 150, box: 15000 },
  mythic: { label: 'Mythic', col: '#FF5E95', dupe: 400, box: 40000 },
};
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const rarTag = r => h('span', { class: 'rtag', style: `--rc:${RARITY[r].col}` }, RARITY[r].label);

const AVATAR_CATS = [['people', 'People'], ['faces', 'Emojis'], ['animals', 'Animals'], ['fantasy', 'Fantasy'], ['epic', 'Epic'], ['mystery', 'Mystery'], ['trophy', 'Trophies']];
const AVA_BG = ['#FFD9C2', '#FFE7A8', '#CDEBD6', '#CFE0FA', '#E3D3F7', '#FFD3DE', '#F3E6D3', '#CDEFEA'];
// Premium season-pass exclusives: never in chests or boxes, so the pass is the only way to get them.
const SEASON_ONLY = ['avatar:teapot', 'avatar:crystal', 'emote:royal', 'emote:boiling'];
// Trophy items: only the Trophy Cabinet gives them (trItemSource says how). Never sold, rolled or on the season pass.
const TROPHY_ONLY = ['avatar:rooster', 'avatar:peacock', 'avatar:champion', 'emote:hooray', 'emote:foundit'];
// price in Gems; null means it only comes from chests, boxes or the season pass (or, for trophy items, a trophy). Optional 6th: pastel.
const AVATARS = [
  ['chef', '🧑‍🍳', 'people', 0, 'common'], ['artist', '🧑‍🎨', 'people', 0, 'common'], ['gran', '👵', 'people', 0, 'common'], ['singer', '🧑‍🎤', 'people', 100, 'common'],
  ['student', '🧑‍🎓', 'people', 100, 'common'], ['farmer', '🧑‍🌾', 'people', 100, 'common'], ['detective', '🕵️', 'people', 250, 'rare'], ['astronaut', '🧑‍🚀', 'people', 250, 'rare'],
  ['cool', '😎', 'faces', 100, 'common'], ['cowboy', '🤠', 'faces', 100, 'common'], ['nerd', '🤓', 'faces', 100, 'common'], ['smirk', '😏', 'faces', 100, 'common'],
  ['disguise', '🥸', 'faces', 250, 'rare'], ['melt', '🫠', 'faces', 250, 'rare'], ['money', '🤑', 'faces', 250, 'rare'], ['devil', '😈', 'faces', 250, 'rare'],
  ['otter', '🦦', 'animals', 0, 'common'], ['cat', '🐱', 'animals', 0, 'common'], ['panda', '🐼', 'animals', 250, 'common'], ['frog', '🐸', 'animals', 250, 'common'],
  ['raccoon', '🦝', 'animals', 250, 'common'], ['penguin', '🐧', 'animals', 250, 'common'], ['octopus', '🐙', 'animals', 250, 'rare'], ['sloth', '🦥', 'animals', 250, 'rare'],
  ['wizard', '🧙', 'fantasy', 250, 'rare'], ['vampire', '🧛', 'fantasy', 250, 'rare'], ['merfolk', '🧜', 'fantasy', 250, 'rare'], ['fairy', '🧚', 'fantasy', 250, 'rare'],
  ['ghost', '👻', 'fantasy', 250, 'rare'], ['robot', '🤖', 'fantasy', 250, 'rare'], ['alien', '👽', 'fantasy', 250, 'rare'], ['genie', '🧞', 'fantasy', 500, 'epic'],
  ['dragon', '🐉', 'epic', 1000, 'epic'], ['unicorn', '🦄', 'epic', 1000, 'epic'], ['crown', '👑', 'epic', 1000, 'epic'], ['volcano', '🌋', 'epic', 1000, 'epic'],
  ['comet', '☄️', 'epic', 1000, 'epic'], ['diamond', '💎', 'epic', 1000, 'epic'],
  ['teapot', '🫖', 'mystery', null, 'legendary'], ['amphora', '🏺', 'mystery', null, 'legendary'], ['planet', '🪐', 'mystery', null, 'legendary'], ['nazar', '🧿', 'mystery', null, 'legendary'],
  ['galaxy', '🌌', 'mystery', null, 'mythic'], ['crystal', '🔮', 'mystery', null, 'mythic'],
  ['rooster', '🐓', 'trophy', null, 'epic', '#FFE7A8'], ['peacock', '🦚', 'trophy', null, 'legendary', '#CDEFEA'], ['champion', '🏆', 'trophy', null, 'mythic', '#CFE0FA'],
].map(([id, e, cat, price, rarity, bg], i) => ({ id, e, cat, price, rarity, name: id[0].toUpperCase() + id.slice(1), bg: bg || AVA_BG[i % AVA_BG.length], exclusive: SEASON_ONLY.includes('avatar:' + id), trophy: TROPHY_ONLY.includes('avatar:' + id) }));
const RIVAL_AVA = { rico: ['🐯', '#FFD9C2'], priya: ['🐇', '#FFE7A8'], mabel: ['🐢', '#CDEBD6'], otto: ['🦔', '#E3D3F7'], june: ['🦉', '#CFE0FA'], sol: ['🦊', '#FFD3DE'] };
function avatarEl(id, size = 44, cls = '') {
  const a = AVATARS.find(x => x.id === id) || AVATARS.find(x => x.id === 'otter');
  return h('span', { class: 'ava' + (cls ? ' ' + cls : ''), style: `--as:${size}px;--ab:${a.bg}`, 'aria-hidden': 'true' }, a.e);
}
// Your own avatar; the Platinum Trivet adds its ring (rivals never get it).
const myAvatarEl = (size, cls) => avatarEl(S.profile.avatar, size, [cls, trHasPlat() && 'tr-plat'].filter(Boolean).join(' '));
function rivalAvaEl(key, size = 44, cls = '') {
  const r = RIVAL_AVA[key] || ['🙂', '#F3E6D3'];
  return h('span', { class: 'ava' + (cls ? ' ' + cls : ''), style: `--as:${size}px;--ab:${r[1]}`, 'aria-hidden': 'true' }, r[0]);
}

// price in Gems; null means season, chest or trophy only
const EMOTES = [
  ['nice', '👍', 'Nice', 0, 'common'], ['ha', '😂', 'Ha!', 0, 'common'], ['wow', '😮', 'Wow', 0, 'common'], ['yikes', '😬', 'Yikes', 0, 'common'], ['hot', '🔥', 'Hot', 0, 'common'], ['hi', '👋', 'Hi', 0, 'common'],
  ['gg', '🤝', 'GG', 50, 'common'], ['thanks', '🙏', 'Thanks', 50, 'common'], ['cold', '🥶', 'Cold', 50, 'common'], ['sleepy', '😴', 'Zzz', 50, 'common'], ['eyes', '👀', 'Watching', 50, 'common'], ['cry', '😭', 'Noo', 50, 'common'],
  ['shh', '🤫', 'Shh', 100, 'rare'], ['mind', '🤯', 'Mind blown', 100, 'rare'], ['target', '🎯', 'Called it', 100, 'rare'], ['brain', '🧠', 'Big brain', 100, 'rare'], ['salute', '🫡', 'Respect', 100, 'rare'], ['skull', '💀', "I'm done", 100, 'rare'],
  ['party', '🎉', 'Party', 250, 'epic'], ['hundred', '💯', 'Perfect', 250, 'epic'], ['devious', '😈', 'Devious', 250, 'epic'], ['sip', '🍵', 'Sip', 250, 'epic'],
  ['royal', '👑', 'Royal', null, 'legendary'], ['boiling', '♨️', 'Boiling', null, 'legendary'],
  ['hooray', '🙌', 'Hooray', null, 'epic'], ['foundit', '🗝️', 'Found it', null, 'legendary'],
].map(([id, e, name, price, rarity]) => ({ id, e, name, price, rarity, exclusive: SEASON_ONLY.includes('emote:' + id), trophy: TROPHY_ONLY.includes('emote:' + id) }));
const emoteOf = id => EMOTES.find(x => x.id === id);

const CAT_ONE = { glaze: 'glaze', num: 'numeral style', tray: 'tray', table: 'table', sound: 'sound pack', avatar: 'avatar', emote: 'emote' };
function anyItem(cat, id) { return cat === 'avatar' ? AVATARS.find(x => x.id === id) : cat === 'emote' ? emoteOf(id) : itemOf(cat, id); }
function itemRarity(cat, it) { return it.rarity || (it.how === 'trophy' ? (cat === 'glaze' && it.id === 'platinum' ? 'mythic' : 'legendary') : it.how === 'kiln' ? 'legendary' : it.how === 'default' ? 'common' : 'rare'); }
// Chests and boxes roll only from this pool: season exclusives and trophy items never appear.
function itemPool(rarity) {
  const out = [];
  AVATARS.forEach(a => { if (a.rarity === rarity && !a.exclusive && !a.trophy) out.push({ cat: 'avatar', id: a.id }); });
  EMOTES.forEach(e => { if (e.rarity === rarity && !e.exclusive && !e.trophy) out.push({ cat: 'emote', id: e.id }); });
  for (const cat in COSMETICS) COSMETICS[cat].forEach(it => { if (it.how === 'shop' && it.rarity === rarity) out.push({ cat, id: it.id }); });
  return out;
}
function shuffled(a, r = Math.random) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function rollRarity(odds, r = Math.random) { let x = r(); for (const k of RARITY_ORDER) if (odds[k]) { x -= odds[k]; if (x < 0) return k; } return RARITY_ORDER.filter(k => odds[k]).pop(); }
// An unowned item of that rarity if one is left, else any item of it (which then converts to Gems).
function rollItem(rarity, r = Math.random) {
  const pool = itemPool(rarity), fresh = pool.filter(x => !owns(x.cat, x.id)), p = fresh.length ? fresh : pool;
  return p.length ? { type: 'item', ...pick(p, r) } : { type: 'gems', n: RARITY[rarity].dupe };
}

/* ---------- chests and boxes ---------- */
const CHESTS = {
  wooden: { name: 'Wooden Chest', gems: 50, rarity: 'common', sparks: [2500, 5000], boosts: 1, boostN: 2, items: [.6], odds: { common: .72, rare: .24, epic: .04 } },
  silver: { name: 'Silver Chest', gems: 100, rarity: 'rare', sparks: [6000, 12000], boosts: 2, boostN: 3, items: [1], odds: { common: .4, rare: .42, epic: .15, legendary: .03 } },
  golden: { name: 'Golden Chest', gems: 150, rarity: 'epic', sparks: [15000, 30000], boosts: 3, boostN: 4, items: [1, .5], odds: { rare: .45, epic: .37, legendary: .15, mythic: .03 } },
};
function rollChest(id, r = Math.random) {
  const c = CHESTS[id], out = [{ type: 'sparks', n: Math.round((c.sparks[0] + r() * (c.sparks[1] - c.sparks[0])) / 100) * 100 }];
  shuffled(['swaps', 'peeks', 'spins'], r).slice(0, c.boosts).forEach(k => out.push({ type: k, n: c.boostN }));
  c.items.forEach(p => { if (r() < p) out.push(rollItem(rollRarity(c.odds, r), r)); });
  return out;
}
// A rarity box (season pass, wheel): Sparks scaled to the rarity plus one item of that rarity.
const rollBox = (rarity, r = Math.random) => [{ type: 'sparks', n: RARITY[rarity].box }, rollItem(rarity, r)];
function openChest(id) {
  const c = CHESTS[id];
  if (!spend('gems', c.gems)) { toast(`You need ${fmt(c.gems - bal('gems'))} more Gems`); return Promise.resolve(false); }
  return revealRewards([{ type: 'chest', id }], { title: c.name });
}

/* ---------- rewards ---------- */
// r: {type: 'sparks'|'gems'|'swaps'|'peeks'|'spins', n} | {type: 'item', cat, id} | {type: 'chest', id} | {type: 'box', rarity}
// Returns what was actually received; items you already own turn into Gems by rarity.
function applyReward(r) {
  if (CURS.includes(r.type)) { gain(r.type, r.n); return { ...r, rarity: r.rarity || 'common', name: amountText(r.type, r.n) }; }
  if (r.type === 'chest') { const c = CHESTS[r.id]; trCount('chests'); return { ...r, rarity: c.rarity, name: c.name, contents: rollChest(r.id).map(applyReward) }; }
  if (r.type === 'box') return { ...r, name: `${RARITY[r.rarity].label} Box`, contents: rollBox(r.rarity).map(applyReward) };
  if (r.type === 'item') {
    const it = anyItem(r.cat, r.id); if (!it) return { type: 'gems', n: 0, rarity: 'common', name: 'Nothing' };
    const rar = itemRarity(r.cat, it);
    if (owns(r.cat, r.id)) { const g = RARITY[rar].dupe; gain('gems', g); return { ...r, rarity: rar, name: it.name, sub: `Already yours, so +${g} Gems instead`, dupe: g }; }
    grant(r.cat, r.id); return { ...r, rarity: rar, name: it.name, sub: `New ${CAT_ONE[r.cat]}` };
  }
  return { ...r, rarity: 'common', name: '' };
}
function rewardName(r) {
  if (CURS.includes(r.type)) return amountText(r.type, r.n);
  if (r.type === 'chest') return CHESTS[r.id].name;
  if (r.type === 'box') return `${RARITY[r.rarity].label} Box`;
  if (r.type === 'item') { const it = anyItem(r.cat, r.id); return it ? `${it.name} ${CAT_ONE[r.cat]}` : ''; }
  return '';
}
const rewardRarity = r => r.rarity || (r.type === 'chest' ? CHESTS[r.id].rarity : r.type === 'item' ? itemRarity(r.cat, anyItem(r.cat, r.id) || {}) : 'common');
// Visual for any reward. Cosmetics show a chip, tray or table swatch in that style.
function rewardIconEl(r, size = 40) {
  if (CURS.includes(r.type)) return h('span', { class: 'ricon', style: `--rs:${size}px`, html: curIcon(r.type, size) });
  if (r.type === 'chest') return h('span', { class: 'ricon', style: `--rs:${size}px`, html: curIcon('chest-' + r.id, size) });
  if (r.type === 'box') return h('span', { class: 'ricon', style: `--rs:${size}px`, html: curIcon('box-' + r.rarity, size) });
  if (r.type === 'item') {
    if (r.cat === 'avatar') return avatarEl(r.id, size);
    if (r.cat === 'emote') { const e = emoteOf(r.id); return h('span', { class: 'ricon emo', style: `--rs:${size}px`, 'aria-hidden': 'true' }, e ? e.e : '?'); }
    return cosmeticIconEl(r.cat, r.id, size);
  }
  return h('span', { class: 'ricon', style: `--rs:${size}px` });
}
function cosmeticIconEl(cat, id, size = 40) {
  const eq = { ...S.equip, [cat]: id };
  const box = h('span', { class: `ricon cosm k-${cat} table-${eq.table} glaze-${eq.glaze} num-${eq.num} tray-${eq.tray}`, style: `--rs:${size}px;--d:${Math.round(size * (cat === 'tray' || cat === 'table' ? .5 : .82))}px`, 'aria-hidden': 'true' });
  box.append(chipEl(cat === 'sound' ? 3 : cat === 'num' ? 7 : 5));
  if (cat === 'sound') box.append(h('i', { class: 'note' }, '♪'));
  return box;
}

/* ---------- focus helpers ---------- */
function captureFocus() { const a = document.activeElement; return { el: a, fk: a && a.dataset ? a.dataset.fk : null, label: a && a.getAttribute ? a.getAttribute('aria-label') : null }; }
function restoreFocus(fi) {
  if (!fi) return false;
  const vis = '#app > .screen:not([hidden])';
  let t = fi.el && fi.el !== document.body && fi.el.isConnected && !fi.el.closest('[hidden],[inert]') ? fi.el : null;
  if (!t && fi.fk) t = $(`${vis} [data-fk="${CSS.escape(fi.fk)}"]`);
  if (!t && fi.label) t = $$(`${vis} [aria-label]`).find(e => e.getAttribute('aria-label') === fi.label);
  if (t && t.focus) { t.focus({ preventScroll: true }); return true; }
  return false;
}
// Rebuild a scrolling view, keeping its scroll position and the focused control (matched by data-fk).
function rebuildViews(box, fill) {
  const a = document.activeElement, inside = !!(a && box.contains(a)), fk = inside && a.dataset ? a.dataset.fk : null, top = box.scrollTop;
  box.innerHTML = ''; fill(box); box.scrollTop = top;
  if (inside && !sheetOpen() && !overlayOpen()) {
    let t = fk ? box.querySelector(`[data-fk="${CSS.escape(fk)}"]`) : null;
    if (!t) { t = box.querySelector('.pagetitle, h1, h2'); if (t) t.tabIndex = -1; }
    if (t) t.focus({ preventScroll: true });
  }
}
// Full-screen overlays (reveal, ad) sit above sheets; screens and the sheet go inert underneath.
const overlayOpen = () => !!$('#app > .fullov');
function openOverlay(ov) {
  $('#app').append(ov);
  setScreensInert(true); $('#sheet').inert = true;
}
function closeOverlay(ov) {
  ov.remove();
  if (!overlayOpen()) { $('#sheet').inert = false; if (!sheetOpen()) setScreensInert(false); }
}

/* ---------- the reveal ---------- */
let revealChain = Promise.resolve();
// Rewards are applied and saved before anything animates, so closing the page mid-reveal loses nothing.
function revealRewards(list, o = {}) {
  const got = list.map(applyReward); save(); updatePills();
  return revealGot(got, o);
}
// Play the reveal for rewards already granted with applyReward() (e.g. granted before a wheel animation).
function revealGot(got, o = {}) {
  const run = () => new Promise(res => playReveal(got, o, res));
  revealChain = revealChain.then(run, run);
  return revealChain.then(() => got);
}
const STAR_POS = [[12, 18, 0], [84, 14, .6], [20, 64, 1.1], [80, 58, .3], [50, 10, .9], [8, 40, 1.4], [92, 36, .2], [30, 84, .7], [70, 82, 1.2], [60, 30, 1.6]];
function playReveal(got, o, done) {
  if (sheetOpen()) closeSheet();
  const fi = captureFocus();
  const leaves = [];
  got.forEach(g => { if (g.contents) g.contents.forEach(c => leaves.push({ ...c, from: g.name })); else leaves.push(g); });
  const single = got.length === 1 && got[0].contents ? got[0] : null;
  const best = [...leaves, ...got].reduce((m, g) => RARITY_ORDER.indexOf(g.rarity) > RARITY_ORDER.indexOf(m) ? g.rarity : m, 'common');
  const steps = [];
  if (!o.skipIntro) steps.push({ intro: true, r: single || { type: 'box', rarity: best }, title: o.title || (single ? single.name : 'Rewards') });
  leaves.forEach((g, i) => steps.push({ r: g, n: i + 1 }));
  if (leaves.length > 1) steps.push({ summary: true });
  const ov = h('div', { class: 'reveal fullov', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Rewards' });
  const bg = h('div', { class: 'rv-bg', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5, 6].map(i => h('i', { style: `--i:${i}` })));
  const stars = h('div', { class: 'rv-stars', 'aria-hidden': 'true' }, STAR_POS.map(([x, y, d]) => h('i', { style: `left:${x}%;top:${y}%;animation-delay:${d}s` })));
  const stage = h('div', { class: 'rv-stage' }), live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  const tap = h('button', { class: 'rv-tap', type: 'button' }, h('span', {}, 'Tap to continue'));
  ov.append(bg, stars, stage, live, tap);
  let i = -1, closed = false;
  const show = () => {
    const s = steps[i]; stage.innerHTML = ''; stage.classList.remove('in', 'sum'); void stage.offsetWidth;
    if (s.summary) {
      ov.style.setProperty('--rc', RARITY[best].col); stage.classList.add('sum');
      stage.append(h('div', { class: 'eyebrow' }, o.title || 'Rewards'), h('h2', {}, 'All yours'),
        h('div', { class: 'rv-grid' + (leaves.length > 9 ? ' dense' : '') }, (leaves.length > 12 ? leaves.slice(0, 11) : leaves).map(g => h('div', { class: 'rv-cell', style: `--rc:${RARITY[g.rarity].col}` }, rewardIconEl(g, leaves.length > 9 ? 34 : 46), h('span', { class: 'rv-lbl' }, g.dupe ? `+${g.dupe} Gems` : g.name))),
          leaves.length > 12 ? h('div', { class: 'rv-cell more' }, h('b', {}, `+${leaves.length - 11}`), h('span', { class: 'rv-lbl' }, 'more')) : null));
      tap.firstChild.textContent = 'Tap to close';
      live.textContent = `All rewards: ${leaves.map(g => g.dupe ? `${g.name}, converted to ${g.dupe} Gems` : g.name).join(', ')}.`;
    } else if (s.intro) {
      ov.style.setProperty('--rc', RARITY[rewardRarity(s.r)].col);
      stage.append(h('div', { class: 'eyebrow' }, o.eyebrow || 'Reward'), h('div', { class: 'rv-icon shake' }, rewardIconEl(s.r, 132)), h('h2', {}, s.title));
      tap.firstChild.textContent = 'Tap to open';
      live.textContent = `${s.title}. Tap to open.`;
    } else {
      const g = s.r; ov.style.setProperty('--rc', RARITY[g.rarity].col);
      stage.append(...[h('div', { class: 'eyebrow' }, g.from || o.title || 'Reward'), h('div', { class: 'rv-icon' }, rewardIconEl(g, 120)), h('h2', {}, g.name),
        g.type === 'item' || g.rarity !== 'common' ? rarTag(g.rarity) : null, g.sub ? h('p', {}, g.sub) : null,
        leaves.length > 1 ? h('div', { class: 'rv-count' }, `${s.n} of ${leaves.length}`) : null].filter(Boolean));
      tap.firstChild.textContent = i === steps.length - 1 ? 'Tap to close' : 'Tap to continue';
      live.textContent = `${g.name}${g.sub ? '. ' + g.sub : ''}.`;
      if (s.n === 1 || g.rarity !== 'common') SND.fanfare();
    }
    // The first step lands with focus on the tap button, before any live-region change can be heard, so it carries the reward in its name.
    if (i === 0) tap.setAttribute('aria-label', s.intro ? live.textContent : `${live.textContent} ${tap.firstChild.textContent}`); else tap.removeAttribute('aria-label');
    stage.classList.add('in');
  };
  const finish = () => {
    if (closed) return; closed = true;
    closeOverlay(ov); refresh();
    if (!restoreFocus(fi)) { const t = CUR === 'home' ? $('.tabs button[aria-current="page"]') : CUR === 'sub' ? $('#sub-back') : null; if (t) t.focus({ preventScroll: true }); }
    if (o.onDone) o.onDone(got);
    done();
  };
  const next = () => { if (closed) return; if (++i >= steps.length) finish(); else show(); };
  tap.addEventListener('click', next);
  ov.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); } else if (e.key === 'Tab') { e.preventDefault(); tap.focus(); } });
  openOverlay(ov); next();
  tap.focus({ preventScroll: true });
}

/* ---------- mock store ---------- */
// The checkout is simulated end to end: no payment details are collected and nothing is charged.
function mockPurchase(o) {
  sheet((p, close) => {
    p.append(h('div', { class: 'eyebrow', style: 'padding-inline:4px;margin-bottom:8px' }, 'trivet store'), h('h3', {}, o.title));
    if (o.iconEl) p.append(h('div', { class: 'mp-icon' }, o.iconEl));
    if (o.sub) p.append(h('p', {}, o.sub));
    p.append(h('div', { class: 'facts mp-facts' }, h('div', {}, h('span', {}, 'PRICE'), h('b', {}, o.price)), h('div', {}, h('span', {}, 'YOU PAY'), h('b', {}, 'Nothing'))),
      h('div', { class: 'mocknote', role: 'note', html: `${icon('info', 18)}<span><b>Prototype store.</b> This purchase is simulated. Nothing is charged and no payment details are asked for.</span>` }));
    const buy = h('button', { class: 'btn cta' }, `Buy · ${o.price}`), status = h('span', { class: 'sr-only', role: 'status' });
    let used = false;
    buy.addEventListener('click', () => {
      // aria-disabled rather than disabled, so focus stays on the button instead of dropping to the page
      if (used || !sheetOpen()) return; used = true; buy.setAttribute('aria-disabled', 'true'); buy.textContent = 'Confirming…'; status.textContent = 'Confirming the simulated purchase';
      setTimeout(() => { if (!p.isConnected || p.inert) return; S.mockBuys = (S.mockBuys || 0) + 1; save(); close(); if (o.onSuccess) o.onSuccess(); }, 650);
    });
    p.append(status, h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Cancel'), buy));
  }, { label: o.title });
}
const ADS_PER_DAY = 5;
function adState() { if (S.ads.day !== dayKey()) S.ads = { day: dayKey(), watched: 0, got: [], mystery: false }; return S.ads; }
const adsLeft = () => Math.max(0, ADS_PER_DAY - adState().watched);
// A stand-in for a rewarded video. Closing early gives nothing; watching to the end counts toward today's limit.
function mockAd(onReward, o = {}) {
  if (sheetOpen()) closeSheet();
  const fi = captureFocus(), SECS = 5;
  let left = SECS, closed = false;
  const ov = h('div', { class: 'adov fullov', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Sponsored placeholder' });
  const x = h('button', { class: 'iconbtn adx', type: 'button', 'aria-label': 'Close without reward', html: icon('close', 18) });
  const bar = h('i'), collect = h('button', { class: 'btn cta wide', type: 'button', disabled: true }, `Reward in ${left}s`);
  ov.append(x, h('div', { class: 'adcard' },
    h('div', { class: 'eyebrow' }, 'Sponsored · placeholder'), h('div', { class: 'adart', html: trivetArt('adring') }),
    h('h2', {}, 'Your ad here'), h('p', {}, 'No ad network is connected. This five-second pause stands in for a sponsor video.'),
    o.label ? h('p', { class: 'adreward' }, `Reward: ${o.label}`) : null,
    h('div', { class: 'adbar', role: 'progressbar', 'aria-label': 'Ad progress', 'aria-valuemin': 0, 'aria-valuemax': SECS, 'aria-valuenow': 0 }, bar), collect));
  const finish = () => { if (closed) return; closed = true; clearInterval(t); closeOverlay(ov); restoreFocus(fi); };
  const t = setInterval(() => {
    left--; bar.parentElement.setAttribute('aria-valuenow', SECS - left);
    if (left > 0) { collect.textContent = `Reward in ${left}s`; return; }
    clearInterval(t); collect.disabled = false; collect.textContent = 'Collect reward'; collect.focus({ preventScroll: true });
  }, 1000);
  collect.addEventListener('click', () => { if (closed || left > 0) return; adState().watched++; save(); finish(); if (onReward) onReward(); });
  x.addEventListener('click', () => { finish(); toast('Closed early, so no reward this time'); });
  ov.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); x.click(); }
    else if (e.key === 'Tab') { e.preventDefault(); (document.activeElement === x && !collect.disabled ? collect : x).focus(); }
  });
  openOverlay(ov);
  requestAnimationFrame(() => { bar.style.transitionDuration = SECS + 's'; bar.style.width = '100%'; });
  x.focus({ preventScroll: true });
}

/* ---------- sub-screens ---------- */
// pushScreen(title, build(box, api), {right: () => el, help: () => void, cls, refresh: () => void, onClose})
// build fills the scrolling body; o.refresh, when given, replaces a full rebuild on refresh() (keep animations alive).
const STACK = [];
function pushScreen(title, build, o = {}) {
  if (sheetOpen()) closeSheet();
  STACK.push({ title, build, o, ret: captureFocus(), from: CUR === 'home' ? UIH.tab : null, scr: CUR === 'sub' ? (STACK[0] && STACK[0].scr) : CUR });
  if (CUR === 'sub') { renderSub(); $('#sub-views').scrollTop = 0; $('#sub-back').focus({ preventScroll: true }); } else go('sub');
}
function popScreen() {
  const t = STACK.pop(); if (!t) return;
  if (t.o.onClose) t.o.onClose();
  if (STACK.length) renderSub(); else go(t.scr === 'result' ? 'result' : 'home');
  restoreFocus(t.ret);
}
const topScreen = () => STACK[STACK.length - 1];
function renderSub() {
  const t = topScreen(); if (!t) return;
  const sub = $('#sub'); sub.className = 'screen sub' + (t.o.cls ? ' ' + t.o.cls : '');
  $('#sub-title').textContent = typeof t.title === 'function' ? t.title() : t.title;
  const prev = STACK[STACK.length - 2], prevTitle = prev ? (typeof prev.title === 'function' ? prev.title() : prev.title) : t.scr === 'result' ? 'results' : t.from ? TAB_LABEL[t.from] : null;
  $('#sub-back').setAttribute('aria-label', prevTitle ? `Back to ${prevTitle}` : 'Back');
  const right = [];
  if (t.o.right) right.push(t.o.right());
  if (t.o.help) { const b = h('button', { class: 'iconbtn', 'aria-label': 'How it works', 'data-fk': 'sub-help', html: icon('info', 20) }); b.addEventListener('click', t.o.help); right.push(b); }
  $('#sub-right').replaceChildren(...right.filter(Boolean));
  rebuildViews($('#sub-views'), box => t.build(box, { rerender: renderSub, close: popScreen }));
}
// Bring whatever is on screen up to date after the wallet or inventory changes.
function refresh() {
  updatePills();
  if (CUR === 'home') renderHome();
  else if (CUR === 'sub') { const t = topScreen(); if (t && t.o.refresh) t.o.refresh(); else renderSub(); }
}

/* ---------- bankroll rank ---------- */
// Rank follows the best bankroll you have ever held, so spending Sparks never costs you a rank.
const BANK_RANKS = [
  { id: 'cool', name: 'Cool', min: 0, col: '#8FA0BD', mult: 1 },
  { id: 'warm', name: 'Warm', min: 1e4, col: '#FFB37A', mult: 2 },
  { id: 'hot', name: 'Hot', min: 1e5, col: '#FF6A4D', mult: 5 },
  { id: 'scorching', name: 'Scorching', min: 1e6, col: '#FF4F8B', mult: 20 },
  { id: 'whitehot', name: 'White-Hot', min: 1e7, col: '#FFF1E6', mult: 100 },
  { id: 'molten', name: 'Molten', min: 1e8, col: '#FFD36A', mult: 500 },
];
function bankRank(n) {
  if (n == null) n = Math.max(S.sparks, S.bankPeak || 0);
  let i = 0; BANK_RANKS.forEach((r, j) => { if (n >= r.min) i = j; });
  const r = BANK_RANKS[i], nx = BANK_RANKS[i + 1] || null;
  return { ...r, i, best: n, next: nx, prog: nx ? clamp((n - r.min) / (nx.min - r.min), 0, 1) : 1 };
}
function rankBadge(i, size = 28) {
  const r = BANK_RANKS[i] || BANK_RANKS[0], flames = Math.min(3, Math.max(1, Math.ceil((i + 1) / 2)));
  const fl = '<path d="M16 9.5c2.8 3.2 5.2 5.4 5.2 8.8a5.2 5.2 0 0 1-10.4 0c0-2.2 1.3-3.6 2.6-4.9.3 1.8 1 2.6 2 3.1-.5-2.5-.3-4.6.6-7z" fill="#000" fill-opacity=".38"/>';
  return h('span', { class: 'rbadge', style: `--rank:${r.col};--rb:${size}px`, 'aria-hidden': 'true', html: `<svg viewBox="0 0 32 32" width="${size}" height="${size}"><path d="M16 2.5l11.7 6.75v13.5L16 29.5 4.3 22.75V9.25z" fill="${r.col}"/><path d="M16 2.5l11.7 6.75v13.5L16 29.5" fill="#000" fill-opacity=".12"/>${fl}${flames > 1 ? `<circle cx="16" cy="24.6" r="1.1" fill="#000" fill-opacity=".38"/>` : ''}${flames > 2 ? `<circle cx="12.6" cy="23.8" r="1" fill="#000" fill-opacity=".38"/><circle cx="19.4" cy="23.8" r="1" fill="#000" fill-opacity=".38"/>` : ''}</svg>` });
}

/* ---------- season ---------- */
const SEASON = { tiers: 40, xpPerTier: 150 };
const seasonId = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
function ensureSeason() {
  if (!S.season || S.season.id !== seasonId()) S.season = { id: seasonId(), xp: 0, premium: false, claimedFree: [], claimedPrem: [] };
  return S.season;
}
const seasonTier = () => Math.min(SEASON.tiers, Math.floor(ensureSeason().xp / SEASON.xpPerTier));
const seasonEndsAt = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 1);
function durText(ms) {
  ms = Math.max(0, ms);
  const d = Math.floor(ms / 864e5), hr = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  return d ? `${d}d ${hr}h` : hr ? `${hr}h ${m}m` : `${Math.max(1, m)}m`;
}

/* ---------- playstyle stats ---------- */
// One bucket per mode ('all', each venue key, 'daily'); human turns only, tutorial excluded. Field meanings:
//   turns: your turns taken. scoopChances: turns where a scoop was on offer; scoopsTaken: those where you took one.
//   feeds: moves that neither scooped nor boiled. feedHeat: sum of the fed tray's heat after your chip (0..1 each);
//   hotFeeds: feeds left at heat >= .30; coolFeeds: feeds left under .10.
//   traps: feeds after which you still hold a chip that completes that tray. sprung / boils / fullTrays: as the engine counts them.
//   gifts: a rival scooped a tray you fed last; giftChips: chips in those scoops.
//   stageFeeds / stageHeat [early, mid, late, empty bag]: feeds and heat sums by how full the bag was when you moved.
//   hands / handWins: hands played and hands where your points were the highest (ties count).
//   matches, wins (first place), chips (points), scoops, biggest: match totals.
//   peeksUsed, swapsUsed, emotes: in-match actions. firstPlayed: dayKey. playMs: time at the table.
function STAT0() {
  return { turns: 0, scoopChances: 0, scoopsTaken: 0, feeds: 0, feedHeat: 0, hotFeeds: 0, coolFeeds: 0, traps: 0, sprung: 0, boils: 0,
    gifts: 0, giftChips: 0, stageFeeds: [0, 0, 0, 0], stageHeat: [0, 0, 0, 0], hands: 0, handWins: 0, matches: 0, wins: 0, chips: 0,
    scoops: 0, biggest: 0, fullTrays: 0, peeksUsed: 0, swapsUsed: 0, emotes: 0, firstPlayed: null, playMs: 0 };
}
const STAT_MODES = ['all', 'cafe', 'noodle', 'tea', 'supper', 'glasshouse', 'daily'];
function statBucket(mode) {
  const all = S.stats2 || (S.stats2 = {});
  const b = all[mode] || (all[mode] = STAT0()), z = STAT0();
  for (const k in z) if (b[k] == null) b[k] = z[k];
  return b;
}
function bumpStats(mode, fn) {
  const keys = mode && mode !== 'all' ? ['all', mode] : ['all'];
  keys.forEach(k => { const b = statBucket(k); if (!b.firstPlayed) b.firstPlayed = dayKey(); fn(b); });
}
