/* ================= arcade: Prize Wheel and Lucky Reels ================= */
// Grant first, animate second: a spin picks its outcome, charges, applies and saves before anything moves,
// so leaving or reloading mid-spin never loses or repeats a prize. The wheel angle and the reel faces live in
// module state, so a re-render keeps what is on screen; o.refresh updates counters without rebuilding either.
function wheelFreeReady() { return S.arcade.wheelFreeDay !== dayKey(); }
function reelsClaimReady() { return Date.now() >= (S.arcade.reelsClaimAt || 0); }

const arcPick = (list, r = Math.random) => { let x = r() * list.reduce((a, o) => a + o.w, 0); for (const o of list) if ((x -= o.w) < 0) return o; return list[list.length - 1]; };
const arcMidnight = () => { const d = new Date(); d.setHours(24, 0, 0, 0); return +d; };
// cubic-bezier(x1, y1, x2, y2) as a function of linear progress, solved by bisection.
function arcBezier(x1, y1, x2, y2) {
  const c = (a, b, t) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  return x => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, t = x; for (let i = 0; i < 26; i++) { if (c(x1, x2, t) < x) lo = t; else hi = t; t = (lo + hi) / 2; } return c(y1, y2, t); };
}
// Re-run sync when a countdown to `at` next changes its minute.
function arcTickAt(st, at, sync) { clearTimeout(st.timer); const ms = at - Date.now(); st.timer = setTimeout(sync, ms > 0 ? ms % 6e4 + 40 : 6e4); }
function arcHowRow(n, text) { return h('div', {}, h('i', {}, String(n)), h('span', {}, text)); }

// Header pills keep the pre-prize balance until the prize is shown, so the number never gives the spin away.
const ARC_HOLD = {};
function arcShowHeld() {
  for (const k in ARC_HOLD) $$(`#sub-right .cpill[data-cur="${k}"]`).forEach(el => { el.classList.remove('bump'); el.querySelector('.pv').textContent = fmt(ARC_HOLD[k]); el.setAttribute('aria-label', amountText(k, ARC_HOLD[k])); });
}
function arcHold(k, v) { ARC_HOLD[k] = v; arcShowHeld(); }
function arcRelease(k, bump) { if (!(k in ARC_HOLD)) return; delete ARC_HOLD[k]; updatePills(k, bump); }
const arcReleaseAll = () => Object.keys(ARC_HOLD).forEach(k => arcRelease(k));

/* ---------- Prize Wheel ---------- */
const WHEEL = { cost: 10, pity: 25, ms: 4200 };
// Clockwise from the top; weights add up to 100.
const WHEEL_SEGS = [
  { r: { type: 'sparks', n: 1000 }, w: 22, label: '1K' },
  { r: { type: 'gems', n: 5 }, w: 16, label: '5' },
  { r: { type: 'swaps', n: 2 }, w: 14, label: '2' },
  { r: { type: 'sparks', n: 5000 }, w: 12, label: '5K' },
  { r: { type: 'peeks', n: 2 }, w: 14, label: '2' },
  { r: { type: 'spins', n: 3 }, w: 12, label: '3' },
  { r: { type: 'gems', n: 25 }, w: 6, label: '25' },
  { r: { type: 'box', rarity: 'rare' }, w: 4, label: 'Box' },
];
const arcSegName = s => s.r.type === 'box' ? 'Mystery Box' : amountText(s.r.type, s.r.n);
const arcSegIcon = (s, n) => curIcon(s.r.type === 'box' ? 'box-' + s.r.rarity : s.r.type, n);
const ARC_W = { angle: 0, hit: null, busy: false, pend: null, tok: 0, raf: 0, timer: 0, el: {} };
const ARC_EASE = arcBezier(.12, .72, .16, 1);

function openWheel() {
  pushScreen('Prize Wheel', arcWheelBuild, { cls: 'arc-wheel', right: () => curPill('gems'), help: arcWheelHelp, refresh: arcWheelSync, onClose: arcWheelClose });
}
function arcWheelSVG() {
  const R = 92, x = (R * Math.sin(Math.PI / 8)).toFixed(2), y = (-R * Math.cos(Math.PI / 8)).toFixed(2), wedge = `M0 0L${-x} ${y}A${R} ${R} 0 0 1 ${x} ${y}Z`;
  const at = (a, r) => `cx="${(r * Math.sin(a)).toFixed(2)}" cy="${(-r * Math.cos(a)).toFixed(2)}"`;
  return `<svg viewBox="-110 -110 220 220" aria-hidden="true" focusable="false"><defs>`
    + `<linearGradient id="arc-rimg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#43374F"/><stop offset=".5" stop-color="#2C2335"/><stop offset="1" stop-color="#1A141F"/></linearGradient>`
    + `<filter id="arc-sh" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.6" flood-color="#000" flood-opacity=".5"/></filter></defs>`
    + `<circle r="106" fill="url(#arc-rimg)"/><circle r="105" fill="none" stroke="#fff" stroke-opacity=".08"/>`
    + `<g class="arc-lights">${Array.from({ length: 16 }, (_, i) => `<circle class="arc-light" ${at(i * Math.PI / 8, 99)} r="2.6"/>`).join('')}</g>`
    + `<circle r="93" fill="#0E0B10"/>`
    + `<g class="arc-disc">${WHEEL_SEGS.map((s, i) => `<path class="arc-wedge${i % 2 ? ' alt' : ''}" d="${wedge}" transform="rotate(${i * 45})"/>`).join('')}`
    + `<path class="arc-hit" d="${wedge}"/>`
    + WHEEL_SEGS.map((_, i) => `<line class="arc-sep" x1="0" y1="-25" x2="0" y2="-92" transform="rotate(${i * 45 + 22.5})"/>`).join('')
    + WHEEL_SEGS.map((s, i) => `<g transform="rotate(${i * 45})">${arcSegIcon(s, 30).replace('<svg ', '<svg x="-15" y="-82" ')}<text class="arc-wlabel" y="-36" text-anchor="middle">${s.label}</text></g>`).join('')
    + `</g><circle r="93" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`
    + `<g filter="url(#arc-sh)"><circle class="arc-hub" r="25"/></g><circle r="24.5" fill="none" stroke="#fff" stroke-opacity=".07"/>`
    + `<circle class="arc-hubring" cy="-3.5" r="9"/><circle class="arc-hubdot" cx="-5.6" cy="9.6" r="1.8"/><circle class="arc-hubdot" cy="10.6" r="1.8"/><circle class="arc-hubdot" cx="5.6" cy="9.6" r="1.8"/>`
    + `<path class="arc-ptr" d="M0 -79L-11.5 -104H11.5Z" filter="url(#arc-sh)"/></svg>`;
}
const arcWheelRot = a => { const d = ARC_W.el.disc; if (d) d.setAttribute('transform', `rotate(${a.toFixed(2)})`); };
function arcWheelBuild(box) {
  const W = ARC_W.el = {};
  W.box = h('div', { class: 'arc-wheelbox' + (ARC_W.busy ? ' is-spin' : '') + (ARC_W.hit != null ? ' is-hit' : ''), role: 'img', html: arcWheelSVG() });
  W.disc = W.box.querySelector('.arc-disc'); W.hitEl = W.box.querySelector('.arc-hit');
  arcWheelRot(ARC_W.angle);
  if (ARC_W.hit != null) W.hitEl.setAttribute('transform', `rotate(${ARC_W.hit * 45})`);
  W.bar = h('i');
  W.meter = h('div', { class: 'arc-meter', role: 'progressbar', 'aria-label': 'Spins toward a guaranteed chest', 'aria-valuemin': 0, 'aria-valuemax': WHEEL.pity }, W.bar);
  W.note = h('p', { class: 'arc-note' });
  W.free = h('button', { class: 'btn arc-big', type: 'button', 'data-fk': 'arc-free' }); W.free.addEventListener('click', () => arcSpin(true));
  W.paid = h('button', { class: 'btn arc-big', type: 'button', 'data-fk': 'arc-paid' }); W.paid.addEventListener('click', () => arcSpin(false));
  W.row = h('div', { class: 'arc-btns' }, W.free, W.paid);
  box.append(h('div', { class: 'arc-page' },
    h('div', { class: 'arc-wstage arc-glow' }, W.box),
    h('div', { class: 'card arc-pity' }, h('span', { class: 'arc-pchest', html: curIcon('chest-silver', 36) }), h('div', {}, W.meter, W.note)),
    W.row));
  arcWheelSync();
}
function arcWheelSync() {
  const W = ARC_W.el; if (!W.free || !W.free.isConnected) return;
  const busy = ARC_W.busy, free = wheelFreeReady(), gems = 'gems' in ARC_HOLD ? ARC_HOLD.gems : bal('gems'), can = gems >= WHEEL.cost;
  const pity = busy && ARC_W.pend ? ARC_W.pend.pity : (S.arcade.wheelPity || 0), left = WHEEL.pity - pity, wait = durText(arcMidnight() - Date.now());
  W.bar.style.width = `${pity / WHEEL.pity * 100}%`;
  W.meter.setAttribute('aria-valuenow', pity); W.meter.setAttribute('aria-valuetext', `${pity} of ${WHEEL.pity} spins`);
  W.note.innerHTML = `Spin <b>${left}</b> more time${left === 1 ? '' : 's'} for a guaranteed <b>chest</b>!`;
  W.box.setAttribute('aria-label', `Prize wheel with eight prizes: ${WHEEL_SEGS.map(arcSegName).join(', ')}.${ARC_W.hit != null && !busy ? ` Last spin landed on ${arcSegName(WHEEL_SEGS[ARC_W.hit])}.` : ''}`);
  W.row.classList.toggle('is-busy', busy);
  W.free.className = 'btn arc-big arc-free' + (free ? ' cta' : ' arc-wait');
  W.free.innerHTML = free ? `${icon('gift', 20)}<span>Free</span><i class="arc-dot" aria-hidden="true"></i>` : `${icon('clock', 20)}<span class="arc-bl"><span>Free</span><small>in ${wait}</small></span>`;
  W.free.setAttribute('aria-label', free ? 'Spin for free. Your daily free spin is ready' : `Free spin used today. The next one is in ${wait}`);
  W.free.setAttribute('aria-disabled', String(busy || !free));
  W.paid.className = 'btn arc-big arc-paid' + (free ? '' : ' cta');
  W.paid.innerHTML = can ? `${curIcon('gems', 24)}<span class="arc-n">${WHEEL.cost}</span>` : `${curIcon('gems', 22)}<span>Get Gems</span>`;
  W.paid.setAttribute('aria-label', can ? `Spin for ${WHEEL.cost} Gems` : `Get Gems. A spin costs ${WHEEL.cost} Gems`);
  W.paid.setAttribute('aria-disabled', String(busy));
  arcShowHeld();
  if (free) clearTimeout(ARC_W.timer); else arcTickAt(ARC_W, arcMidnight(), arcWheelSync);
}
function arcSpin(free) {
  if (ARC_W.busy) return;
  if (free && !wheelFreeReady()) { toast(`Your free spin comes back in ${durText(arcMidnight() - Date.now())}`); return; }
  if (!free && bal('gems') < WHEEL.cost) { goShop('gems'); return; }
  if (free) S.arcade.wheelFreeDay = dayKey(); else spend('gems', WHEEL.cost);
  const shown = bal('gems'), pity = S.arcade.wheelPity || 0, seg = arcPick(WHEEL_SEGS), i = WHEEL_SEGS.indexOf(seg);
  const got = [applyReward(seg.r)];
  if (pity + 1 >= WHEEL.pity) { S.arcade.wheelPity = 0; got.push(applyReward({ type: 'chest', id: 'silver' })); } else S.arcade.wheelPity = pity + 1;
  trCount('wheel');
  save();
  arcHold('gems', shown);
  // Land a random point inside the segment, after 5 to 7 full turns.
  const rm = reduced(), from = ARC_W.angle, off = (Math.random() * 2 - 1) * 15;
  const to = from + ((-(i * 45 + off) - from) % 360 + 720) % 360 + (rm ? 0 : 360 * (5 + Math.floor(Math.random() * 2)));
  Object.assign(ARC_W, { busy: true, hit: null, pend: { i, got, to, pity } });
  const tok = ++ARC_W.tok, W = ARC_W.el;
  if (W.box) { W.box.classList.remove('is-hit', 'is-pulse'); W.box.classList.add('is-spin'); }
  arcWheelSync();
  if (rm) { ARC_W.angle = to; arcWheelRot(to); setTimeout(() => arcWheelLand(tok), 120); return; }
  const t0 = performance.now(); let last = Math.floor((from + 22.5) / 45), lastT = 0;
  const step = now => {
    if (tok !== ARC_W.tok) return;
    const p = Math.min(1, (now - t0) / WHEEL.ms), a = from + (to - from) * ARC_EASE(p), b = Math.floor((a + 22.5) / 45);
    ARC_W.angle = a; arcWheelRot(a);
    if (b !== last && now - lastT > 38) { last = b; lastT = now; SND.tick(); }
    if (p < 1) ARC_W.raf = requestAnimationFrame(step); else arcWheelLand(tok);
  };
  ARC_W.raf = requestAnimationFrame(step);
}
function arcWheelLand(tok) {
  const p = ARC_W.pend; if (tok !== ARC_W.tok || !p) return;
  ARC_W.angle = p.to % 360; ARC_W.hit = p.i; arcWheelRot(ARC_W.angle);
  const W = ARC_W.el;
  if (W.box) { W.hitEl.setAttribute('transform', `rotate(${p.i * 45})`); W.box.classList.remove('is-spin'); W.box.classList.add('is-hit', 'is-pulse'); }
  SND.clink(5);
  setTimeout(() => { if (tok === ARC_W.tok) arcWheelDone(); }, reduced() ? 300 : 1000);
}
function arcWheelDone() {
  const p = ARC_W.pend; if (!p) return;
  Object.assign(ARC_W, { pend: null, busy: false }); ARC_W.tok++;
  arcRelease('gems'); arcWheelSync();
  arcWheelReveal(p.got).then(() => updatePills('gems', true));
}
// The mystery box opens with the intro; currency prizes skip it. The 25th-spin chest follows as its own reveal.
function arcWheelReveal(got) {
  const [prize, chest] = got;
  const done = revealGot([prize], prize.contents ? { title: 'Mystery Box', eyebrow: 'Prize Wheel' } : { title: 'Prize Wheel', skipIntro: true });
  return chest ? revealGot([chest], { title: 'Silver Chest', eyebrow: `Bonus for spin ${WHEEL.pity}` }) : done;
}
function arcWheelClose() {
  cancelAnimationFrame(ARC_W.raf); clearTimeout(ARC_W.timer);
  const p = ARC_W.pend;
  if (p) { Object.assign(ARC_W, { pend: null, busy: false, angle: p.to % 360, hit: p.i }); ARC_W.tok++; }
  arcReleaseAll(); ARC_W.el = {};
  if (p) arcWheelReveal(p.got);
}
function arcWheelHelp() {
  const left = WHEEL.pity - (S.arcade.wheelPity || 0);
  sheet((p, close) => {
    p.append(h('h3', {}, 'Prize Wheel'), h('p', {}, 'Every spin lands on one of eight prizes. These are the chances.'),
      h('div', { class: 'arc-odds', role: 'list', 'aria-label': 'Prizes and chances' }, WHEEL_SEGS.map(s => h('div', { role: 'listitem' }, h('span', { class: 'arc-oi', html: arcSegIcon(s, 26) }), h('b', {}, arcSegName(s)), h('em', {}, s.w + '%')))),
      h('div', { class: 'how' },
        arcHowRow(1, 'One free spin every day. It comes back at midnight.'),
        arcHowRow(2, `After that, each spin costs ${WHEEL.cost} Gems. Gems are the only cost.`),
        arcHowRow(3, `Every ${WHEEL.pity}th spin also gives a Silver Chest on top of its prize. ${left === 1 ? 'Your next spin is the one.' : `${left} spins to go.`}`),
        arcHowRow(4, `A Mystery Box holds ${fmt(RARITY.rare.box)} Sparks and a rare item. Items you already own turn into Gems.`)),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Close')));
  }, { label: 'Prize Wheel' });
}

/* ---------- Lucky Reels ---------- */
const REEL_SYMS = ['sparks', 'gems', 'swaps', 'peeks', 'chest'];
const REEL_BG = { sparks: '#FFE7A8', gems: '#CFE0FA', swaps: '#CDEBD6', peeks: '#E3D3F7', chest: '#FFD3DE' };
const REEL_PAY = {
  triple: { sparks: { type: 'sparks', n: 5000 }, gems: { type: 'gems', n: 20 }, swaps: { type: 'swaps', n: 4 }, peeks: { type: 'peeks', n: 4 }, chest: { type: 'chest', id: 'wooden' } },
  pair: { sparks: { type: 'sparks', n: 500 }, gems: { type: 'gems', n: 2 }, swaps: { type: 'swaps', n: 1 }, peeks: { type: 'peeks', n: 1 }, chest: { type: 'sparks', n: 1000 } },
};
// Which symbol a triple or pair lands on; chests are the rare one.
const REEL_W = { triple: { sparks: 30, gems: 18, swaps: 24, peeks: 22, chest: 6 }, pair: { sparks: 28, gems: 16, swaps: 22, peeks: 22, chest: 12 } };
const REEL = { triple: .12, pair: .45, pity: 5, claim: 5, claimMs: 8 * 36e5, stops: [900, 1300, 1700] };
const ARC_R = { faces: null, last: null, busy: false, pend: null, tok: 0, burst: 0, timer: 0, tempT: 0, el: {} };
// Forget the last wheel landing and reel faces (used by Reset progress, so a fresh save shows no old wins).
function arcReset() { ARC_W.angle = 0; ARC_W.hit = null; ARC_R.faces = null; ARC_R.last = null; }
const arcSymName = (s, n = 2) => s === 'chest' ? (n === 1 ? 'Chest' : 'Chests') : curName(s, n);
const arcSymIcon = (s, n = 40) => curIcon(s === 'chest' ? 'chest-wooden' : s, n);
const arcCell = s => h('span', { class: 'arc-cell' }, h('span', { class: 'arc-sym', style: `--sb:${REEL_BG[s]}`, html: arcSymIcon(s) }));
const arcFiller = () => Math.random() < .08 ? 'chest' : pick(REEL_SYMS.slice(0, 4));
const arcCommon = () => REEL_SYMS.filter(s => s !== 'chest' || Math.random() < .25);
const arcPayText = r => r.type === 'chest' ? CHESTS[r.id].name : amountText(r.type, r.n);

function openReels() {
  pushScreen('Lucky Reels', arcReelsBuild, { cls: 'arc-reels', right: () => curPill('spins'), help: arcReelsHelp, refresh: arcReelsSync, onClose: arcReelsClose });
}
function arcReelRoll() {
  const forced = (S.arcade.reelsPity || 0) >= REEL.pity - 1, x = Math.random();
  const kind = forced || x < REEL.triple ? 'triple' : x < REEL.triple + REEL.pair ? 'pair' : 'none';
  let sym = null, line;
  if (kind === 'none') line = shuffled(arcCommon()).slice(0, 3);
  else {
    sym = arcPick(REEL_SYMS.map(k => ({ k, w: REEL_W[kind][k] }))).k; line = [sym, sym, sym];
    if (kind === 'pair') line[Math.floor(Math.random() * 3)] = pick(arcCommon().filter(s => s !== sym));
  }
  return { kind, sym, line, faces: arcFaces(line), reward: sym ? REEL_PAY[kind][sym] : null };
}
// Each reel shows three different symbols, and the rows off the payline never line up.
function arcFaces(line) {
  let f;
  for (let n = 0; n < 12; n++) {
    f = line.map(m => { const o = shuffled(arcCommon().filter(s => s !== m)); return [o[0], m, o[1]]; });
    if (![0, 2].some(r => f[0][r] === f[1][r] && f[1][r] === f[2][r])) break;
  }
  return f;
}
function arcResultParts(p) {
  if (p.kind === 'none') return ['No match', ''];
  const r = p.reward;
  if (p.kind === 'triple') return [`Triple ${arcSymName(p.sym)}!`, r.type === 'chest' ? CHESTS[r.id].name : `+${amountText(r.type, r.n)}`];
  return [p.sym === 'chest' ? 'Chest pair' : 'Pair', `· +${amountText(r.type, r.n)}`];
}
function arcReelsBuild(box) {
  if (!ARC_R.faces) ARC_R.faces = arcFaces(['gems', 'sparks', 'peeks']);
  const R = ARC_R.el = {};
  R.reels = ARC_R.faces.map(f => h('div', { class: 'arc-reel' }, h('div', { class: 'arc-strip' }, f.map(arcCell))));
  R.line = h('div', { class: 'arc-line' });
  R.cab = h('div', { class: 'arc-cab' + (ARC_R.busy ? ' is-spin' : ''), role: 'img' },
    h('div', { class: 'arc-bulbs', 'aria-hidden': 'true' }, Array.from({ length: 9 }, () => h('i'))),
    h('div', { class: 'arc-window' }, h('div', { class: 'arc-reelrow' }, R.reels, R.line), h('i', { class: 'arc-arrow l' }), h('i', { class: 'arc-arrow r' })));
  R.pips = Array.from({ length: REEL.pity }, () => h('i'));
  R.pityTxt = h('span');
  R.result = h('div', { class: 'arc-result', role: 'status' });
  R.claim = h('div', { class: 'card arc-claim' });
  R.spin = h('button', { class: 'btn cta wide arc-big arc-spin', type: 'button', 'data-fk': 'arc-spin' }); R.spin.addEventListener('click', arcPull);
  box.append(h('div', { class: 'arc-page' },
    h('div', { class: 'arc-fill top' }),
    h('div', { class: 'arc-rwrap arc-glow' }, h('div', { class: 'arc-rstage' }, R.cab, h('div', { class: 'arc-pity2' }, h('span', { class: 'arc-pips', 'aria-hidden': 'true' }, R.pips), R.pityTxt)), R.result),
    h('div', { class: 'arc-fill' }), R.claim, R.spin));
  if (ARC_R.last && !ARC_R.busy) { arcMarkWin(ARC_R.last); arcResult(ARC_R.last); } else arcResult(null);
  arcReelsSync();
  if (!ARC_R.busy) arcReels3();
}
function arcResult(p) {
  const R = ARC_R.el; if (!R.result) return;
  R.result.className = 'arc-result' + (p ? ' is-' + p.kind : ARC_R.busy ? '' : ' is-idle');
  if (!p) { R.result.textContent = ARC_R.busy ? '' : 'Line up three on the middle row'; return; }
  const [big, small] = arcResultParts(p);
  R.result.replaceChildren(...[h('b', {}, big), small && h('span', {}, ' ' + small)].filter(Boolean));
}
function arcMarkWin(p) {
  const R = ARC_R.el; if (!R.reels || p.kind === 'none') return;
  p.line.forEach((s, i) => { if (s === p.sym) { const c = R.reels[i].firstChild.children[1]; if (c) c.classList.add('arc-won'); } });
}
function arcReelsSync() {
  const R = ARC_R.el; if (!R.spin || !R.spin.isConnected) return;
  const busy = ARC_R.busy, n = bal('spins'), pity = busy && ARC_R.pend ? ARC_R.pend.pity : (S.arcade.reelsPity || 0), left = REEL.pity - pity;
  R.pips.forEach((p, i) => p.classList.toggle('on', i < pity));
  R.pityTxt.innerHTML = left <= 1 ? 'Next spin is a <b>guaranteed triple</b>' : `Triple guaranteed in <b>${left}</b>`;
  const mid = ARC_R.faces.map(f => arcSymName(f[1], 1));
  R.cab.setAttribute('aria-label', busy ? 'Lucky Reels, spinning' : `Lucky Reels. Payline shows ${mid.join(', ')}`);
  R.spin.innerHTML = n > 0 ? `<span>Spin</span><span class="arc-cost">${curIcon('spins', 20)}1</span>` : `${curIcon('spins', 22)}<span>Get Spins</span>`;
  R.spin.setAttribute('aria-label', n > 0 ? `Spin the reels for 1 Spin. You have ${amountText('spins', n)}` : 'Get Spins. You have none left');
  R.spin.setAttribute('aria-disabled', String(busy));
  R.spin.classList.toggle('is-busy', busy);
  // The claim card swaps between a button and a countdown; focus moves to Spin when the button goes away.
  const ready = reelsClaimReady(), wait = durText((S.arcade.reelsClaimAt || 0) - Date.now());
  if (R.claimReady !== ready) {
    const had = R.claim.contains(document.activeElement);
    R.claimReady = ready; R.claim.classList.toggle('is-ready', ready);
    if (ready) {
      const b = h('button', { class: 'btn cta smallbtn arc-claimbtn', type: 'button', 'data-fk': 'arc-claim', 'aria-label': `Claim ${REEL.claim} free Spins` }, 'Claim', h('i', { class: 'arc-dot', 'aria-hidden': 'true' }));
      b.addEventListener('click', arcClaim);
      R.claim.replaceChildren(h('span', { class: 'arc-ci', html: curIcon('spins', 36) }), h('div', {}, h('b', { class: 'arc-ct' }, `${REEL.claim} free Spins`), h('span', { class: 'arc-cs' }, 'Ready to claim')), b);
    } else {
      R.wait = h('b', { class: 'arc-ct' });
      R.claim.replaceChildren(h('span', { class: 'arc-ci arc-clock', html: icon('clock', 22) }), h('div', {}, R.wait, h('span', { class: 'arc-cs' }, `${REEL.claim} free Spins every 8 hours`)));
      if (had) R.spin.focus({ preventScroll: true });
    }
  }
  if (!ready) { R.wait.textContent = `Next ${REEL.claim} free in ${wait}`; arcTickAt(ARC_R, S.arcade.reelsClaimAt, arcReelsSync); } else clearTimeout(ARC_R.timer);
  arcShowHeld();
}
function arcClaim() {
  if (!reelsClaimReady()) return;
  gain('spins', REEL.claim); S.arcade.reelsClaimAt = Date.now() + REEL.claimMs; save();
  toast(`${REEL.claim} free Spins added`);
  arcReelsSync();
}
function arcPull() {
  if (ARC_R.busy) return;
  if (bal('spins') < 1) { goShop('spins'); return; }
  arcBurstOff(); arcReleaseAll();
  spend('spins', 1);
  const o = arcReelRoll(), r = o.reward, k = r && CURS.includes(r.type) ? r.type : null, pity = S.arcade.reelsPity || 0, prev = ARC_R.faces;
  if (k) arcHold(k, bal(k));
  const got = r ? applyReward(r) : null;
  S.arcade.reelsPity = o.kind === 'triple' ? 0 : pity + 1;
  // The trophy for a triple waits (saved) until the reels stop, so its banner never gives the result away.
  if (o.kind === 'triple') S.arcade.reels3 = 1;
  save();
  Object.assign(ARC_R, { faces: o.faces, busy: true, pend: { ...o, got, k, pity }, last: null });
  const tok = ++ARC_R.tok, R = ARC_R.el;
  arcResult(null); arcReelsSync();
  if (reduced() || !R.cab) { arcSetFaces(); arcReelsDone(tok); return; }
  // Each strip runs from the faces on show, through filler, to the result, plus one spare for the settle.
  R.cab.classList.add('is-spin');
  const cell = R.reels[0].querySelector('.arc-cell').offsetHeight || 64;
  R.reels.forEach((reel, i) => {
    const n = 9 + i * 5, strip = reel.firstChild;
    strip.replaceChildren(...[...prev[i], ...Array.from({ length: n }, arcFiller), ...o.faces[i], arcFiller()].map(arcCell));
    strip.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-(n + 3) * cell}px)` }], { duration: REEL.stops[i], easing: 'cubic-bezier(.3,.6,.35,1.08)', fill: 'forwards' });
  });
  REEL.stops.forEach((t, i) => setTimeout(() => {
    if (tok !== ARC_R.tok) return;
    arcSetFaces(i); SND.clink(3 + i);
    if (i === REEL.stops.length - 1) arcReelsDone(tok);
  }, t + 20));
}
function arcSetFaces(only) {
  (ARC_R.el.reels || []).forEach((reel, i) => {
    if (only != null && i !== only) return;
    const s = reel.firstChild; s.getAnimations().forEach(a => a.cancel()); s.replaceChildren(...ARC_R.faces[i].map(arcCell));
  });
}
function arcReelsDone(tok) {
  const p = ARC_R.pend; if (tok !== ARC_R.tok || !p) return;
  Object.assign(ARC_R, { pend: null, busy: false, last: p }); ARC_R.tok++;
  const R = ARC_R.el;
  if (R.cab) R.cab.classList.remove('is-spin');
  arcMarkWin(p); arcResult(p); arcReelsSync();
  arcReels3(); arcShowHeld(); // its reward joins the count-up; the held pill keeps the pre-prize figure until then
  if (p.kind === 'triple') setTimeout(() => SND.trio([5, 6, 7]), 140); else if (p.kind === 'pair') setTimeout(() => SND.clink(8), 140);
  if (p.got && p.got.type === 'chest') revealGot([p.got], { title: CHESTS[p.got.id].name, eyebrow: 'Triple Chests!' });
  else if (p.k) { if (reduced() || !R.line) arcRelease(p.k, true); else arcBurst(p.k, p.kind === 'triple' ? 14 : 6); }
}
// A triple has been shown (or the screen was left, or the page reloaded mid-pull): award Three in a Row.
function arcReels3() { if (!S.arcade.reels3) return; delete S.arcade.reels3; if (!trEarn('reels3')) save(); }
// Coins of the won currency spray from the payline into a header pill for that currency, counting it up as they land.
function arcBurst(k, n) {
  const app = $('#app'), src = ARC_R.el.line, pill = arcTempPill(k);
  const A = app.getBoundingClientRect(), F = src.getBoundingClientRect(), T = pill.getBoundingClientRect();
  const sx = F.left + F.width / 2 - A.left, sy = F.top + F.height / 2 - A.top, tx = T.left + 17 - A.left, ty = T.top + T.height / 2 - A.top;
  const from = k in ARC_HOLD ? ARC_HOLD[k] : bal(k), to = bal(k), layer = h('div', { class: 'arc-burst', 'aria-hidden': 'true' }), id = ++ARC_R.burst;
  app.append(layer);
  let landed = 0;
  const end = () => { if (id !== ARC_R.burst || !layer.isConnected) return; layer.remove(); arcRelease(k, true); clearTimeout(ARC_R.tempT); ARC_R.tempT = setTimeout(arcTempOff, 1500); };
  for (let j = 0; j < n; j++) {
    const c = h('span', { class: 'arc-coin', html: curIcon(k, 26) }); layer.append(c);
    const ang = Math.random() * Math.PI * 2, d = 34 + Math.random() * 62, spin = Math.random() * 120 - 60;
    const mx = sx + Math.cos(ang) * d * 1.35, my = sy + Math.sin(ang) * d - 18;
    const a = c.animate([
      { transform: `translate(${sx}px,${sy}px) scale(.3)`, opacity: 0, easing: 'cubic-bezier(.2,.8,.3,1)' },
      { transform: `translate(${mx}px,${my}px) scale(1) rotate(${spin}deg)`, opacity: 1, offset: .4, easing: 'cubic-bezier(.55,.05,.7,.2)' },
      { transform: `translate(${tx}px,${ty}px) scale(.5) rotate(${spin * 2}deg)`, opacity: .9 },
    ], { duration: 820 + Math.random() * 200, delay: j * 36, fill: 'both' });
    a.onfinish = () => {
      c.remove(); landed++;
      if (id !== ARC_R.burst) return;
      if (landed >= n) return end();
      if (k in ARC_HOLD) { ARC_HOLD[k] = Math.round(from + (to - from) * landed / n); arcShowHeld(); }
      if (landed === 1) { pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); }
    };
  }
  setTimeout(end, n * 36 + 1400);
}
function arcTempPill(k) {
  const right = $('#sub-right'), have = right.querySelector(`.cpill[data-cur="${k}"]`);
  if (have) return have;
  arcTempOff();
  right.querySelectorAll('.cpill').forEach(x => x.classList.add('arc-away'));
  const p = curPill(k, { cls: 'arc-temp' }); right.prepend(p); arcShowHeld();
  return p;
}
// A new pull or leaving the screen cancels any burst still in the air.
function arcBurstOff() { ARC_R.burst++; clearTimeout(ARC_R.tempT); $$('#app > .arc-burst').forEach(x => x.remove()); arcTempOff(); }
function arcTempOff() { $$('#sub-right .arc-temp').forEach(x => x.remove()); $$('#sub-right .arc-away').forEach(x => x.classList.remove('arc-away')); }
function arcReelsClose() {
  clearTimeout(ARC_R.timer); arcBurstOff();
  const p = ARC_R.pend;
  if (p) { Object.assign(ARC_R, { pend: null, busy: false, last: p }); ARC_R.tok++; }
  arcReleaseAll(); ARC_R.el = {};
  arcReels3();
  if (!p) return;
  if (p.got && p.got.type === 'chest') revealGot([p.got], { title: CHESTS[p.got.id].name, eyebrow: 'Triple Chests!' });
  else toast(`Lucky Reels: ${arcResultParts(p).join(' ').trim()}`);
}
function arcReelsHelp() {
  const left = REEL.pity - (S.arcade.reelsPity || 0), ready = reelsClaimReady();
  const amt = r => h('span', { class: 'arc-amt', html: `${r.type === 'chest' ? curIcon('chest-wooden', 18) : curIcon(r.type, 18)}<span aria-hidden="true">${r.type === 'chest' ? 'Chest' : fmt(r.n)}</span><span class="sr-only">${arcPayText(r)}</span>` });
  sheet((p, close) => {
    p.append(h('h3', {}, 'Lucky Reels'), h('p', {}, 'Each spin costs 1 Spin. Only the middle row pays.'),
      h('div', { class: 'arc-pay', role: 'table', 'aria-label': 'Paytable' },
        h('div', { class: 'hd', role: 'row' }, h('span', { role: 'columnheader' }, 'Symbol'), h('span', { role: 'columnheader' }, 'Pair'), h('span', { role: 'columnheader' }, 'Triple')),
        REEL_SYMS.map(s => h('div', { role: 'row' }, h('span', { class: 'arc-psym', role: 'rowheader' }, h('span', { class: 'arc-sym', style: `--sb:${REEL_BG[s]}`, html: arcSymIcon(s, 22) }), h('b', {}, arcSymName(s))),
          h('span', { role: 'cell' }, amt(REEL_PAY.pair[s])), h('span', { role: 'cell' }, amt(REEL_PAY.triple[s]))))),
      h('div', { class: 'how' },
        arcHowRow(1, `Every spin: a triple ${pct(REEL.triple)}, a pair ${pct(REEL.pair)}, no match ${pct(1 - REEL.triple - REEL.pair)}.`),
        arcHowRow(2, `No triple in four spins? The fifth is always a triple. ${left <= 1 ? 'Your next spin is one.' : `${left} to go.`}`),
        arcHowRow(3, `Claim ${REEL.claim} free Spins every 8 hours. ${ready ? 'They are ready now.' : `Next in ${durText(S.arcade.reelsClaimAt - Date.now())}.`}`)),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Close')));
  }, { label: 'Lucky Reels' });
}
