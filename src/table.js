/* ================= match controller ================= */
const M = {
  st: null, vk: 'cafe', mode: 'venue', gen: 0, D: null, aids: 'full', lifted: -1, previews: null, prevGen: 0, hover: -1,
  win: null, winGen: 0, awaiting: null, acting: -1, peek: -1, peekUsed: false, unseenOpen: false, glance: null,
  timerId: 0, timeLeft: 0, entry: 0, free: false, flags: {}, fedBy: [-1, -1, -1], lastChat: {}, bubbles: {},
  lesson: -1, coach: null, result: null, committed: false, firstRun: false, lastPlayed: null, suppressClick: false,
  dailyDate: null, dailyDay: null, dailyNo: 0, cancelDrag: () => { }, tx: null, trMark: 0,
};
const LESSONS = [
  { title: 'Make a trio', text: 'Drop the 6 into the 4·5 tray. Three in a row is a trio, and a trio takes the whole tray.',
    trays: [[4, 5], [1, 7], [2, 8]], hand: [6, 1, 8], allow: (c, t) => c === 6 && t === 0,
    after: () => 'Scooped. Runs like 4·5·6 and sets like 7·7·7 both count, and you keep every chip in the tray.' },
  { title: 'Boil it over', text: 'A sixth chip with no trio boils the tray over and nobody scores it. Rico could finish this one with a 2, 4 or 6, so boil it first.',
    trays: [[1, 3, 5, 7, 8], [2, 6], [4, 8]], hand: [8, 8, 3], allow: (c, t) => t === 0,
    after: () => 'Boiled. Sometimes the best move is making sure nobody scores.' },
  { title: 'Watch the heat', text: 'Each chip you drop can set up the next player. Lift a chip to see how hot every tray would get, then pick a cool move.',
    trays: [[3, 7], [1, 4], [5, 8]], hand: [5, 2, 8], allow: () => true,
    after: h => h < .2 ? `Cool move. That tray is at ${pct(h)} heat, so Rico probably can't finish it.` : `That tray is at ${pct(h)} heat now. Rico has a fair chance at it. Cooler moves keep trays out of reach.` },
];
const lessonAllows = (v, t) => M.mode !== 'tutorial' || LESSONS[M.lesson].allow(v, t);

function lineup(vk, daily) {
  if (daily) return ['june'];
  const sh = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  if (vk === 'cafe') { S.cafeOpp = (S.cafeOpp || 0) + 1; return [S.cafeOpp % 2 ? 'rico' : 'priya']; }
  if (vk === 'noodle') return sh(['priya', 'mabel', 'otto']).slice(0, 2);
  if (vk === 'tea') return [pick(['mabel', 'otto', 'june'])];
  if (vk === 'supper') return ['sol', ...sh(['mabel', 'otto', 'june']).slice(0, 2)];
  return ['sol', 'june', 'otto'];
}
const fastMode = () => S.settings.fastAI || (M.st && M.st.N >= 4);
const thinkTime = () => fastMode() ? 360 : 600 + Math.random() * 500;
const venueTitle = () => M.mode === 'daily' ? `Daily Tray #${M.dailyNo}` : M.mode === 'tutorial' ? 'How to play' : V[M.vk].name;
function announce(msg) {
  const log = $('#t-log'); if (!log) return;
  log.append(h('p', {}, msg));
  while (log.children.length > 6) log.firstChild.remove();
}

function startMatch(vk, o = {}) {
  const daily = !!o.daily, vn = V[vk];
  if (!daily && !o.free) {
    if (S.sparks < vn.entry) { toast(`You need ${fmt(vn.entry)} Sparks to sit down here`); return; }
    S.sparks -= vn.entry;
  }
  const rivals = o.rivals || lineup(vk, daily);
  const players = [{ name: 'You', human: true }, ...rivals.map(k => ({ name: P[k].name, personality: k }))];
  if (daily) { M.dailyDate = new Date(); M.dailyDay = dayKey(M.dailyDate); M.dailyNo = dailyNo(M.dailyDate); }
  M.st = Scoop.newMatch({ players, seed: daily ? Scoop.hash32(M.dailyNo, 0xDA11) : undefined, venue: vk, record: true });
  Object.assign(M, { vk, mode: daily ? 'daily' : 'venue', entry: daily || o.free ? 0 : vn.entry, free: !!o.free, committed: false, result: null,
    aids: (S.settings.pro || daily) ? 'colour' : vn.aids, flags: {}, fedBy: [-1, -1, -1], lastChat: {}, bubbles: {}, lesson: -1, coach: null, unseenOpen: false });
  if (daily) {
    // Iron Streak counts wins on consecutive days played; a loss keeps the run, a day without a Daily ends it.
    const d = M.dailyDate; if (S.daily.lastDay !== dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))) S.daily.runWins = 0;
    S.daily.lastDay = M.dailyDay;
  } else S.lastVenue = vk;
  save();
  enterTable();
  M.trMark = txTrCall(trMark); // after enterTable, which settles anything still pending from the last table
  M.rank0 = bankRank().i; // trophy Sparks paid mid-match can cross a rank, so compare with the rank at the start
}
function enterTable() {
  M.gen++; txReset(); M.cancelDrag(); M.lifted = -1; M.previews = null; M.acting = -1; M.awaiting = null; M.win = null; M.hover = -1; M.peek = -1; M.peekUsed = false;
  stopTimer(); removeCoach(); clearFx();
  $$('#table .overlay').forEach(e => e.remove());
  $('#t-trays').innerHTML = ''; $('#t-hand-chips').innerHTML = ''; $('#t-log').innerHTML = '';
  syncD(); refreshGlance();
  go('table');
  renderTable();
  dealIn();
  if (M.mode !== 'tutorial') refreshWin();
  loop(M.gen);
}
function syncD() {
  const st = M.st;
  M.D = { trays: st.trays.map(t => t.slice()), hand: st.hands[0].slice(), sizes: Scoop.handSizes(st), scores: st.players.map(p => p.score),
    bag: st.bag.length, order: st.order.slice(), handNo: st.handNo };
}
function refreshGlance() { M.glance = M.st && M.st.phase === 'play' ? Scoop.glance(M.st, 0) : null; }
function refreshWin() {
  if (M.mode === 'tutorial' || !M.st) { M.win = null; return; }
  const tok = ++M.winGen, st = M.st, est = Scoop.createWinEstimator(st, 0);
  let n = 0;
  M.win = { display: M.win ? M.win.display : null, computing: true };
  const step = () => {
    if (tok !== M.winGen || st !== M.st) return;
    const r = est.step(50); n += 50;
    M.win = { p: r.p, display: r.display, decided: r.decided, computing: !r.decided && n < 300 };
    renderGlance();
    if (M.win.computing) setTimeout(step, 16);
  };
  setTimeout(step, 30);
}

/* ---------- turn loop ---------- */
async function loop(g) {
  while (g === M.gen && M.st && M.st.phase === 'play') {
    const st = M.st, pid = st.turn;
    if (st.players[pid].human) {
      const a = await new Promise(res => { M.awaiting = res; M.acting = -1; startTimer(g); renderTable(); focusHand(); announce('Your turn.'); });
      if (g !== M.gen) return;
      await perform(a, g);
      if (g !== M.gen) return;
      if (M.mode === 'tutorial') { await lessonDone(g); return; }
    } else {
      M.acting = pid; renderOpps(); renderActions(); renderMe();
      const a = Scoop.aiChooseAction(st, pid, st.players[pid].personality, { venue: st.venue });
      const oc = Scoop.moveOutcome(st, a.chip, a.tray);
      await sleep(thinkTime() + (oc.kind !== 'feed' ? 300 : 0));
      if (g !== M.gen) return;
      await perform({ type: 'play', chip: a.chip, tray: a.tray }, g);
    }
  }
  if (g === M.gen && M.st && M.st.phase === 'over' && M.mode !== 'tutorial') showResult();
}
// At the start of your turn, put focus on your hand unless the player has deliberately focused something else.
function focusHand() {
  if (sheetOpen() || $('#table .overlay')) return;
  const f = document.activeElement;
  const lost = !f || f === document.body || !f.isConnected || !!(f.closest && f.closest('[hidden]'));
  if (!lost && !(f.closest && f.closest('#t-actions, #t-trays'))) return;
  const b = $('#t-hand-chips .chip:not(:disabled)'); if (b) b.focus({ preventScroll: true });
}
function playHuman(chip, tray, force) {
  if (!M.awaiting) return;
  if (!force && sheetOpen()) return;
  if (!lessonAllows(chip, tray)) { nudgeCoach(); return; }
  const r = M.awaiting; M.awaiting = null; stopTimer(); M.cancelDrag(); if (M.tx) M.tx.swapMode = false;
  M.lifted = -1; M.previews = null; M.hover = -1; M.peek = -1; M.prevGen++;
  renderTrays(); renderActions(); renderGlance(); renderMe(); renderHand();
  r({ type: 'play', chip, tray });
}

/* ---------- performing a move, event by event ---------- */
async function perform(action, g) {
  const prev = M.st, next = Scoop.applyAction(prev, action);
  M.st = next; M.winGen++; M.acting = -1;
  txTrScan(prev, next); // before txStats, which moves on who fed each tray last
  txStats(prev, next, action);
  renderOpps(); renderActions(); renderMe();
  const evs = next.events;
  if (next.phase === 'over' && M.mode !== 'tutorial') commitResult();
  for (const ev of evs) {
    if (g !== M.gen) return;
    await animateEvent(ev, g, next);
  }
  if (g !== M.gen) return;
  txTrFire();
  syncD(); refreshGlance(); renderTable();
  if (next.phase === 'play') refreshWin();
}
const nameOf = pid => pid === 0 ? 'You' : (M.st && M.st.players[pid] ? M.st.players[pid].name : 'A rival');
async function animateEvent(ev, g, next) {
  const D = M.D, fast = reduced();
  if (ev.type === 'play') {
    M.lastPlayed = ev;
    let from = null, fromSize = 56;
    if (ev.pid === 0) {
      const i = D.hand.indexOf(ev.chip), el = $$('#t-hand-chips .chip')[i];
      if (el) { from = el.getBoundingClientRect(); fromSize = from.width; }
      if (i >= 0) D.hand.splice(i, 1);
    } else {
      const el = $(`#t-opps .opp[data-pid="${ev.pid}"] .ava`); if (el) { from = el.getBoundingClientRect(); fromSize = from.width; }
      D.sizes[ev.pid] = Math.max(0, D.sizes[ev.pid] - 1);
      if (M.tx && M.tx.peeked && M.tx.peeked.pid === ev.pid && M.tx.peeked.v === ev.chip) M.tx.peeked = null;
      announce(`${nameOf(ev.pid)} dropped ${ev.chip === 8 ? 'an' : 'a'} ${ev.chip} into tray ${ev.tray + 1}.`);
    }
    renderHand(); renderOpps();
    const trayEl = $(`#t-trays .tray[data-t="${ev.tray}"] .row`);
    if (from && trayEl && !fast) {
      const tr = trayEl.getBoundingClientRect(), size = trayChipSize();
      const n = D.trays[ev.tray].length;
      const to = { left: tr.left + Math.min(tr.width - size, n * (size * .92)), top: tr.top + tr.height / 2 - size / 2, width: size, height: size };
      await flyChip(ev.chip, from, to, fromSize, size, 240);
      if (g !== M.gen) return;
    }
    SND.clink(ev.chip);
    D.trays[ev.tray] = [...D.trays[ev.tray], ev.chip].sort((a, b) => a - b);
    if (M.tx) M.tx.preFed = M.fedBy[ev.tray];
    M.fedBy[ev.tray] = ev.pid;
    renderTrays({ landed: { t: ev.tray, v: ev.chip } });
    if (!fast) await sleep(120);
  } else if (ev.type === 'scoop') {
    const trayBtn = $(`#t-trays .tray[data-t="${ev.tray}"]`);
    const chips = trayBtn ? $$('.chip', trayBtn) : [];
    const lit = trioIndices(ev.chips, M.lastPlayed ? M.lastPlayed.chip : ev.chips[0]);
    SND.trio(lit.slice(0, 3).map(i => ev.chips[i]));
    for (const i of lit) { if (chips[i]) chips[i].classList.add('lit'); if (!fast) { await sleep(90); if (g !== M.gen) return; } }
    const fed = M.tx ? M.tx.preFed : -1;
    const tag = ev.full ? 'FULL TRAY' : ev.double ? 'DOUBLE' : ev.sprung ? 'SPRUNG' : '';
    showTrayLabel(ev.tray, `+${ev.points}`, ev.pid === 0 ? (tag || 'SCOOP') : `${M.st.players[ev.pid].name.toUpperCase()}${tag ? ' · ' + tag : ''}`);
    txTrFire(ev);
    if (!fast) { await sleep(560); if (g !== M.gen) return; }
    const target = ev.pid === 0 ? $('#t-me .ava') : $(`#t-opps .opp[data-pid="${ev.pid}"] .ava`);
    if (target && !fast) {
      const tr = target.getBoundingClientRect();
      await Promise.all(chips.map((c, i) => sleep(i * 40).then(() => { if (g !== M.gen) return; const r = c.getBoundingClientRect(); if (r.width) return flyChip(+c.dataset.v, r, tr, r.width, 26, 300); })));
      if (g !== M.gen) return;
    }
    D.trays[ev.tray] = []; D.scores[ev.pid] += ev.points; M.fedBy[ev.tray] = -1;
    clearTrayLabel(ev.tray);
    renderTrays(); renderOpps(); renderMe();
    announce(`${nameOf(ev.pid)} scooped ${ev.points} from tray ${ev.tray + 1}${tag ? ', ' + tag.toLowerCase() : ''}. ${M.st.players.map((p, i) => `${nameOf(i)} ${D.scores[i]}`).join(', ')}.`);
    if (ev.pid !== 0) { chat(ev.pid, 'scoop', .6); if (!M.bubbles[ev.pid]) txRivalEmote(ev.pid, .15); }
    else if (fed > 0 && fed !== ev.pid) chat(fed, 'scooped', .5);
  } else if (ev.type === 'boil') {
    const trayBtn = $(`#t-trays .tray[data-t="${ev.tray}"]`);
    SND.boil();
    announce(`${nameOf(ev.pid)} boiled tray ${ev.tray + 1} over. ${ev.chips.length} chips lost.`);
    txTrFire(ev);
    if (trayBtn && !fast) {
      const row = $('.row', trayBtn); row.classList.add('shiver');
      showTrayLabel(ev.tray, `−${ev.chips.length}`, 'BOILED OVER', true);
      await sleep(560); if (g !== M.gen) return;
      const r = trayBtn.getBoundingClientRect(), a = $('#app').getBoundingClientRect();
      for (let i = 0; i < 3; i++) $('#app').append(h('span', { class: 'steam', style: `left:${r.left - a.left + r.width * (.3 + i * .2)}px;top:${r.top - a.top + r.height * .3}px;animation-delay:${i * 90}ms` }));
      setTimeout(() => $$('.steam').forEach(s => s.remove()), 1000);
      row.style.transition = 'opacity .3s,transform .3s'; row.style.opacity = '0'; row.style.transform = 'translateY(-8px)';
      await sleep(300); if (g !== M.gen) return;
    }
    D.trays[ev.tray] = []; M.fedBy[ev.tray] = -1;
    clearTrayLabel(ev.tray);
    renderTrays();
    if (ev.pid !== 0) { chat(ev.pid, 'boil', .8); if (!M.bubbles[ev.pid]) txRivalEmote(ev.pid, .15); }
  } else if (ev.type === 'refill') {
    D.trays[ev.tray] = ev.chips.slice();
    renderTrays({ refill: ev.tray });
    if (!fast) await sleep(260);
  } else if (ev.type === 'draw') {
    if (ev.pid === 0) { D.hand.push(ev.chip); renderHand({ drawn: true }); } else { D.sizes[ev.pid]++; renderOpps(); }
    D.bag = Math.max(0, D.bag - 1); renderInfo();
  } else if (ev.type === 'handEnd') {
    if (!fast) { $$('#t-trays .row').forEach(r => { r.style.transition = 'opacity .35s,transform .35s'; r.style.opacity = '0'; r.style.transform = 'translateY(10px)'; }); await sleep(380); }
    if (g !== M.gen) return;
    D.trays = [[], [], []]; if (M.tx) M.tx.peeked = null; renderTrays(); renderOpps();
    const s = ev.summary;
    announce(`Hand ${s.hand + 1} over. ${M.st.players.map((p, i) => `${nameOf(i)} ${s.totals[i]}`).join(', ')}.`);
    if (M.mode !== 'tutorial') await handSummary(s, next, g);
  } else if (ev.type === 'handStart') {
    syncD(); refreshGlance(); renderTable(); dealIn();
    if (!fast) await sleep(450);
  }
}
function trioIndices(chips, x) {
  const idx = v => chips.indexOf(v), out = new Set(), has = v => chips.includes(v);
  if (chips.filter(c => c === x).length >= 3) chips.forEach((c, i) => { if (c === x && out.size < 3) out.add(i); });
  for (const [a, b] of [[x - 2, x - 1], [x - 1, x + 1], [x + 1, x + 2]]) if (has(a) && has(b)) { out.add(idx(a)); out.add(idx(b)); out.add(idx(x)); }
  if (!out.size) chips.forEach((c, i) => out.add(i));
  return [...out].sort((a, b) => a - b);
}
function trayChipSize() { const c = $('#t-trays .tray .row .chip'), r = $('#t-trays .tray .row'); if (c) return c.getBoundingClientRect().width; return r ? Math.min(56, r.getBoundingClientRect().height * .54) : 50; }
async function flyChip(v, from, to, fromSize, toSize, dur) {
  if (reduced()) return;
  const app = $('#app'), a = app.getBoundingClientRect(), el = chipEl(v, 'flychip');
  el.style.setProperty('--d', fromSize + 'px');
  const x0 = from.left + from.width / 2 - a.left - fromSize / 2, y0 = from.top + from.height / 2 - a.top - fromSize / 2;
  const x1 = to.left + to.width / 2 - a.left - fromSize / 2, y1 = to.top + to.height / 2 - a.top - fromSize / 2;
  el.style.transform = `translate(${x0}px,${y0}px)`;
  app.append(el);
  const s = toSize / fromSize, mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 40;
  try {
    await el.animate([
      { transform: `translate(${x0}px,${y0}px) scale(1)` },
      { transform: `translate(${mx}px,${my}px) scale(${(1 + s) / 2 + .04})`, offset: .5 },
      { transform: `translate(${x1}px,${y1}px) scale(${s})` }], { duration: dur, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' }).finished;
  } catch (e) { }
  el.remove();
}
function showTrayLabel(t, big, small, boil) {
  const w = $(`#t-trays .traywrap[data-t="${t}"]`); if (!w) return;
  clearTrayLabel(t);
  w.append(h('div', { class: 'scooplabel', 'data-label': t, 'aria-hidden': 'true' }, h('div', {}, h('b', { class: boil ? 'boil' : '' }, big), h('small', {}, small))));
}
function clearTrayLabel(t) { $$(`#t-trays .scooplabel[data-label="${t}"]`).forEach(e => e.remove()); }
function chat(pid, kind, prob) {
  if (!M.st) return;
  const p = M.st.players[pid]; if (!p || p.human) return;
  const lines = (CHATTER[p.personality] || {})[kind]; if (!lines || Math.random() > prob) return;
  const ply = M.st.ply; if (M.lastChat[pid] != null && ply - M.lastChat[pid] < 3) return;
  M.lastChat[pid] = ply;
  M.bubbles = { [pid]: { text: pick(lines), hot: kind === 'scoop' } };
  renderOpps();
  setTimeout(() => { if (M.bubbles[pid]) { delete M.bubbles[pid]; renderOpps(); } }, 1700);
}
function dealIn() {
  if (reduced()) return;
  $$('#t-trays .row .chip').forEach((c, i) => { c.classList.add('droptin'); c.style.animationDelay = `${i * 60}ms`; });
  $$('#t-hand-chips .chip').forEach((c, i) => { c.classList.add('droptin'); c.style.animationDelay = `${200 + i * 90}ms`; });
}

/* ---------- glasshouse timer ---------- */
function startTimer(g) {
  stopTimer();
  if (M.mode !== 'venue' || !V[M.vk].timer) return;
  M.timeLeft = V[M.vk].timer;
  M.timerId = setInterval(() => {
    if (g !== M.gen || !M.awaiting) { stopTimer(); return; }
    M.timeLeft -= 1;
    if (M.timeLeft <= 5 && M.timeLeft > 0) SND.tick();
    if (M.timeLeft === 5) announce('Five seconds left.');
    if (M.timeLeft <= 0) {
      stopTimer(); closeSheet();
      if (M.tx) { M.tx.outs++; M.tx.autoPly = M.st.ply; }
      const a = Scoop.timeoutAction(M.st, 0);
      toast('Time. The table played a safe chip for you.');
      playHuman(a.chip, a.tray, true);
      return;
    }
    renderMe();
  }, 1000);
}
function stopTimer() { clearInterval(M.timerId); M.timerId = 0; }

/* ---------- rendering ---------- */
function renderTable() { renderTop(); renderOpps(); renderInfo(); renderTrays(); renderGlance(); renderHand(); renderActions(); renderMe(); }
function renderTop() {
  if (!M.st || !M.D) return;
  $('#t-venue').textContent = venueTitle();
  $('#t-hand').textContent = M.mode === 'tutorial' ? `Lesson ${M.lesson + 1} of ${LESSONS.length}` : `Hand ${Math.min(3, M.D.handNo + 1)} of 3${M.mode === 'venue' && M.aids === 'colour' && S.settings.pro ? ' · Pro view' : ''}`;
}
function dotsEl(n) { return h('span', { class: 'dots3', 'aria-hidden': 'true' }, [0, 1, 2].map(i => h('i', { class: i < n ? 'on' : '' }))); }
function renderOpps() {
  if (!M.st || !M.D) return;
  const st = M.st, D = M.D, box = $('#t-opps'); box.innerHTML = '';
  const idx = D.order.indexOf(0), seq = [];
  for (let k = 1; k < st.N; k++) seq.push(D.order[(idx + k) % st.N]);
  seq.forEach((pid, i) => {
    if (i) box.append(h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'));
    const p = st.players[pid], pk = txPeekOf(pid);
    const el = h('div', { class: 'opp' + (M.acting === pid ? ' acting' : ''), 'data-pid': pid, role: 'group', 'aria-label': `${p.name}, ${D.scores[pid]} points, ${D.sizes[pid]} chip${D.sizes[pid] === 1 ? '' : 's'} in hand${pk ? `, holds ${pk.v === 8 ? 'an' : 'a'} ${pk.v} (you peeked)` : ''}${M.acting === pid ? ', playing' : ''}` },
      txOppAva(pid, pk), h('span', { class: 'oname' }, p.name), h('span', { class: 'oscore' }, D.scores[pid]), dotsEl(D.sizes[pid]));
    if (M.bubbles[pid]) el.append(h('span', { class: 'bubble' + (M.bubbles[pid].hot ? ' hot' : '') + (M.bubbles[pid].peek ? ' tx-pkbub' : '') }, M.bubbles[pid].text));
    box.append(el);
  });
}
function renderInfo() {
  if (!M.st || !M.D) return;
  const D = M.D, bag = $('#t-bag'), last = D.bag <= 8 && D.bag > 0, C = 2 * Math.PI * 9;
  bag.className = 'bag' + (last ? ' last' : '');
  bag.setAttribute('role', 'img');
  bag.setAttribute('aria-label', `${D.bag} chip${D.bag === 1 ? '' : 's'} left in the bag`);
  bag.innerHTML = `<svg class="bring" viewBox="0 0 24 24" aria-hidden="true"><circle class="trk" cx="12" cy="12" r="9"/>${last ? `<circle class="bar" cx="12" cy="12" r="9" stroke-dasharray="${(C * D.bag / 8).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 12 12)"/>` : ''}</svg><b>${D.bag ? (last ? `LAST CHIPS · ${D.bag}` : `BAG ${D.bag}`) : 'BAG EMPTY'}</b>`;
  const un = $('#t-unseen'), g = M.glance, open = M.aids === 'full' || M.unseenOpen || M.mode === 'tutorial';
  un.className = 'unseen' + (open ? '' : ' closed');
  un.innerHTML = '';
  if (g) for (let v = 1; v <= 8; v++) un.append(h('span', { class: 'col' }, h('b', {}, v), Array.from({ length: g.unseen[v] }, () => h('i'))));
  un.setAttribute('aria-label', g ? 'Unseen chips: ' + [1, 2, 3, 4, 5, 6, 7, 8].map(v => `${g.unseen[v]} ${v}s`).join(', ') : 'Unseen chips');
  un.setAttribute('aria-expanded', String(open));
}
function trayGroups(chips) {
  const cols = [];
  for (const v of chips) { const c = cols[cols.length - 1]; if (c && c.v === v) c.n++; else cols.push({ v, n: 1 }); }
  const groups = [];
  for (const c of cols) { const g = groups[groups.length - 1]; if (g && g[g.length - 1].v === c.v - 1) g.push(c); else groups.push([c]); }
  return groups.map(g => h('div', { class: 'grp' + (g.length > 1 ? ' run' : '') }, g.map(c => h('div', { class: 'stack' }, Array.from({ length: c.n }, () => chipEl(c.v))))));
}
function outcomeText(pv, short) {
  if (!pv) return '';
  if (pv.kind === 'scoop') return `SCOOP +${pv.points}${pv.double ? ' · DOUBLE' : ''}`;
  if (pv.kind === 'boil') return `BOIL −${pv.lost}`;
  return M.aids === 'colour' && M.mode !== 'tutorial' ? 'FEED' : `${short ? '' : 'HEAT '}${pct(pv.heatBefore)} → ${pct(pv.heatAfter)}`;
}
// Tray buttons are created once and refilled in place, so a press that spans a re-render still clicks and focus survives.
function renderTrays(o = {}) {
  if (!M.st || !M.D) return;
  const box = $('#t-trays');
  if (box.children.length !== 3) {
    box.innerHTML = '';
    for (let t = 0; t < 3; t++) box.append(h('div', { class: 'traywrap', 'data-t': t }, h('button', { class: 'tray', 'data-t': t, type: 'button' }), h('div', { class: 'trivet', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))));
  }
  for (let t = 0; t < 3; t++) fillTray(t, o);
}
function fillTray(t, o = {}) {
  const btn = $(`#t-trays .tray[data-t="${t}"]`); if (!btn || !M.D) return;
  const g = M.glance, chips = M.D.trays[t], heat = g ? g.heat[t] : 0, comp = g ? g.completers[t] : [], band = g && chips.length ? g.bands[t] : 'none';
  const pv = M.lifted >= 0 && M.previews ? M.previews[t] : null;
  const tutBlock = M.mode === 'tutorial' && M.lifted >= 0 && !LESSONS[M.lesson].allow(M.D.hand[M.lifted], t);
  const showNeeds = M.aids === 'full' || M.peek === t || M.mode === 'tutorial';
  const inactive = !M.awaiting || M.lifted < 0 || tutBlock;
  const label = `Tray ${t + 1}: ${chips.length ? chips.join(', ') : 'empty'}.` + (chips.length ? (M.aids !== 'colour' || M.mode === 'tutorial' ? ` Heat ${pct(heat)}.` : ` ${band === 'hot' ? 'Hot' : band === 'warm' ? 'Warm' : 'Cool'}.`) + (showNeeds ? (comp.length ? ` Needs ${comp.join(' or ')}.` : ' Nothing completes it yet.') : '') : '') + (pv ? ` Your chip would: ${outcomeText(pv)}.` : '');
  btn.className = 'tray' + (M.hover === t ? ' target' : '') + (pv && M.hover === t ? ' k-' + pv.kind : '') + (tutBlock ? ' disabled' : '');
  btn.dataset.band = band;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-disabled', String(inactive));
  btn.tabIndex = inactive ? -1 : 0;
  const row = h('div', { class: 'row' }, trayGroups(chips));
  if (!chips.length && M.D.bag === 0 && M.st.phase === 'play') row.append(h('span', { class: 'empty-note' }, 'empty'));
  const meta = h('div', { class: 'meta' });
  if (pv) meta.append(h('span', { class: 'outcome k-' + pv.kind }, outcomeText(pv)));
  else if (chips.length && (M.aids !== 'colour' || M.mode === 'tutorial')) meta.append(h('span', { class: 'heatpill' }, `HEAT ${pct(heat)}`));
  const kids = [row, meta];
  if (chips.length && comp.length && showNeeds) kids.push(h('span', { class: 'needs' }, `needs ${comp.join(' · ')}`));
  kids.push(h('span', { class: 'ticks', 'aria-hidden': 'true' }, Array.from({ length: 6 }, (_, i) => h('i', { class: i < chips.length ? 'on' : '' }))));
  btn.replaceChildren(...kids);
  if (o.landed && o.landed.t === t && !reduced()) { const cs = $$('.chip', row), c = cs[chips.lastIndexOf(o.landed.v)]; if (c) c.classList.add('droptin'); }
  if (o.refill === t && !reduced()) $$('.chip', row).forEach((c, i) => { c.classList.add('droptin'); c.style.animationDelay = `${i * 120}ms`; });
}
function renderGlance() {
  const box = $('#t-glance');
  if (!M.st || !M.D || M.mode === 'tutorial') { box.innerHTML = ''; return; }
  const w = M.win, pill = h('div', { class: 'winpill', role: 'img' });
  const now = w && w.display != null ? w.display : null;
  pill.append('WIN ', h('b', {}, now != null ? now + '%' : '··'));
  let label = `Chance to win the match: ${now != null ? now + ' percent' : 'calculating'}`;
  const pv = M.lifted >= 0 && M.previews && M.hover >= 0 ? M.previews[M.hover] : null;
  if (pv && pv.winAfter != null && M.aids !== 'colour') {
    const after = Math.round(clamp(pv.winAfter, .01, .99) * 100);
    pill.append(h('span', { class: 'arrow' }, '→'), h('b', { class: now == null ? '' : after > now ? 'up' : after < now ? 'down' : '' }, after + '%'), h('span', { class: 'next' }, `· NEXT ${pct(pv.next)}`));
    label += `, ${after} percent after this move, ${pct(pv.next)} chance to scoop next turn`;
  }
  pill.setAttribute('aria-label', label);
  box.replaceChildren(pill);
}
function renderHand(o = {}) {
  if (!M.st || !M.D) return;
  const box = $('#t-hand-chips'), D = M.D;
  const swap = !!(M.tx && M.tx.swapMode && M.awaiting);
  box.classList.toggle('waiting', !M.awaiting);
  box.classList.toggle('tx-swap', swap);
  if ($$('.chip', box).length !== D.hand.length) { box.innerHTML = ''; D.hand.forEach((v, i) => { const b = chipEl(v, '', 'button'); b.dataset.i = i; box.append(b); }); }
  $$('.chip', box).forEach((b, i) => {
    const v = D.hand[i], allowed = M.mode !== 'tutorial' || [0, 1, 2].some(t => LESSONS[M.lesson].allow(v, t));
    if (+b.dataset.v !== v) setChipFace(b, v);
    b.classList.toggle('lifted', M.lifted === i);
    b.disabled = !M.awaiting || !allowed;
    b.setAttribute('aria-pressed', String(M.lifted === i));
    b.setAttribute('aria-label', swap ? `Swap chip ${v}` : `Chip ${v}${M.lifted === i ? ', lifted' : ''}`);
  });
  if (o.drawn && !reduced()) { const last = box.lastElementChild; if (last) { last.classList.remove('droptin'); void last.offsetWidth; last.classList.add('droptin'); } }
}
function renderActions() {
  if (!M.st || !M.D) return;
  const box = $('#t-actions');
  if (M.awaiting && M.lifted >= 0) {
    if ($$('.tb', box).length !== 3) {
      box.innerHTML = '';
      for (let t = 0; t < 3; t++) {
        const b = h('button', { class: 'tb', 'data-t': t, type: 'button' });
        b.addEventListener('click', () => { if (!b.disabled && M.lifted >= 0) playHuman(M.D.hand[M.lifted], t); });
        b.addEventListener('pointerenter', () => setHover(t));
        b.addEventListener('pointerleave', () => setHover(-1));
        b.addEventListener('focus', () => { setHover(t); if (M.aids === 'full-longpress') { M.peek = t; fillTray(t); } });
        b.addEventListener('blur', () => { setHover(-1); if (M.peek === t) { M.peek = -1; fillTray(t); } });
        box.append(b);
      }
    }
    for (let t = 0; t < 3; t++) updateTb(t);
    return;
  }
  const st = M.st;
  if (M.awaiting && M.tx && M.tx.swapMode) { box.replaceChildren(txSwapHint()); return; }
  let text = '';
  if (M.awaiting) text = matchMedia('(hover: hover)').matches ? 'Lift a chip, then pick a tray. Keys 1-3 work too.' : 'Lift a chip, then pick a tray';
  else if (M.acting >= 0 && st.players[M.acting] && st.phase === 'play') text = `${st.players[M.acting].name} is thinking`;
  box.replaceChildren(h('div', { class: 'hint' }, text));
}
function updateTb(t) {
  const b = $(`#t-actions .tb[data-t="${t}"]`); if (!b || M.lifted < 0) return;
  const pv = M.previews ? M.previews[t] : null, v = M.D.hand[M.lifted];
  const winTxt = pv && pv.winAfter != null && M.aids === 'full' && M.mode !== 'tutorial' ? `WIN ${Math.round(clamp(pv.winAfter, .01, .99) * 100)}%` : null;
  b.className = 'tb' + (pv ? ' k-' + pv.kind : '');
  b.disabled = !lessonAllows(v, t);
  b.replaceChildren(...[h('span', {}, `TRAY ${t + 1}`), h('b', {}, pv ? outcomeText(pv, true) : '…'), winTxt ? h('span', {}, winTxt) : null].filter(Boolean));
  b.setAttribute('aria-label', `Drop ${v} into tray ${t + 1}${pv ? ': ' + outcomeText(pv) : ''}${winTxt ? `, win chance ${winTxt.slice(4)}` : ''}`);
}
function setHover(t) { if (M.hover === t) return; M.hover = t; markHover(); renderGlance(); }
function markHover() {
  if (!M.st) return;
  $$('#t-trays .tray').forEach(b => { const t = +b.dataset.t; b.classList.toggle('target', t === M.hover); const pv = M.previews && M.previews[t]; ['k-scoop', 'k-boil', 'k-feed'].forEach(c => b.classList.remove(c)); if (t === M.hover && pv) b.classList.add('k-' + pv.kind); });
}
function renderMe() {
  if (!M.st || !M.D) return;
  const box = $('#t-me'), F = txFoot(box);
  box.className = 'mefoot tx-foot' + (M.awaiting ? ' acting' : '');
  F.score.textContent = M.D.scores[0];
  F.right.replaceChildren(M.timerId ? h('span', { class: 'timer' + (M.timeLeft <= 5 ? ' low' : ''), role: 'timer', 'aria-label': `${M.timeLeft} second${M.timeLeft === 1 ? '' : 's'} left`, html: `${icon('clock', 15)} ${M.timeLeft}s` }) : lvlRing());
  txBoostSync();
}

/* ---------- lifting, previews and input ---------- */
function liftChip(i, viaKey) {
  if (!M.awaiting || sheetOpen()) return;
  if (M.tx && M.tx.swapMode) { txDoSwap(i); return; }
  if (M.lifted === i) { M.lifted = -1; M.previews = null; M.prevGen++; M.hover = -1; renderTrays(); renderHand(); renderActions(); renderGlance(); if (viaKey) { const b = $$('#t-hand-chips .chip')[i]; if (b) b.focus({ preventScroll: true }); } return; }
  M.lifted = i; M.hover = -1;
  const chip = M.D.hand[i], st = M.st, tok = ++M.prevGen;
  M.previews = [null, null, null];
  SND.clink(chip);
  renderTrays(); renderHand(); renderActions(); renderGlance();
  if (viaKey) { const b = $('#t-actions .tb:not(:disabled)'); if (b) b.focus({ preventScroll: true }); }
  const wantWin = M.aids !== 'colour' && M.mode !== 'tutorial';
  let t = 0;
  const step = () => {
    if (tok !== M.prevGen || st !== M.st) return;
    M.previews[t] = Scoop.previewMove(st, 0, { chip, tray: t }, { win: wantWin, winBefore: M.win && M.win.p != null ? M.win.p : undefined, rollouts: 100 });
    fillTray(t); updateTb(t); if (t === M.hover) { markHover(); renderGlance(); }
    t++;
    if (t < 3) setTimeout(step, 0);
  };
  setTimeout(step, 0);
}
function initTableInput() {
  const hand = $('#t-hand-chips'), app = $('#app');
  let drag = null;
  M.cancelDrag = () => { if (!drag) return; if (drag.el) drag.el.remove(); const s = $$('#t-hand-chips .chip')[drag.i]; if (s) s.classList.remove('dragging'); drag = null; };
  hand.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b || b.disabled) return;
    if (M.suppressClick) { M.suppressClick = false; return; }
    liftChip(+b.dataset.i, e.detail === 0);
  });
  hand.addEventListener('pointerdown', e => {
    const b = e.target.closest('.chip'); if (!b || b.disabled || e.button > 0 || !M.awaiting || !e.isPrimary || (M.tx && M.tx.swapMode)) return;
    M.cancelDrag();
    drag = { i: +b.dataset.i, v: M.D.hand[+b.dataset.i], x: e.clientX, y: e.clientY, el: null, id: e.pointerId };
  });
  window.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.el) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
      if (!M.awaiting || M.D.hand[drag.i] !== drag.v) { drag = null; return; }
      if (M.lifted !== drag.i) liftChip(drag.i);
      const src = $$('#t-hand-chips .chip')[drag.i];
      drag.el = chipEl(drag.v, 'dragchip');
      drag.el.style.setProperty('--d', (src ? src.getBoundingClientRect().width : 80) + 'px');
      app.append(drag.el);
      if (src) src.classList.add('dragging');
    }
    const a = app.getBoundingClientRect();
    drag.el.style.left = (e.clientX - a.left) + 'px'; drag.el.style.top = (e.clientY - a.top) + 'px';
    setHover(trayAt(e.clientX, e.clientY));
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.el) return;
    d.el.remove(); M.suppressClick = true; setTimeout(() => { M.suppressClick = false; }, 50);
    const src = $$('#t-hand-chips .chip')[d.i]; if (src) src.classList.remove('dragging');
    const t = trayAt(e.clientX, e.clientY);
    const valid = M.awaiting && M.lifted === d.i && M.D.hand[d.i] === d.v;
    if (t >= 0 && e.type === 'pointerup' && valid && lessonAllows(d.v, t)) playHuman(d.v, t);
    else { setHover(-1); if (t >= 0 && M.mode === 'tutorial') nudgeCoach(); }
  };
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
  const trays = $('#t-trays');
  trays.addEventListener('click', e => {
    const b = e.target.closest('.tray'); if (!b) return;
    if (M.peekUsed) { M.peekUsed = false; return; }
    const t = +b.dataset.t;
    if (M.awaiting && M.lifted >= 0 && b.getAttribute('aria-disabled') !== 'true') playHuman(M.D.hand[M.lifted], t);
  });
  trays.addEventListener('pointerover', e => { const b = e.target.closest('.tray'); if (!b || M.lifted < 0 || drag) return; setHover(+b.dataset.t); });
  trays.addEventListener('pointerleave', () => { if (!drag && M.hover >= 0) setHover(-1); });
  // Noodle Bar: hold a tray to see what it needs
  let holdT = 0;
  trays.addEventListener('pointerdown', e => {
    M.peekUsed = false;
    const b = e.target.closest('.traywrap'); if (!b || M.aids !== 'full-longpress') return;
    clearTimeout(holdT); const t = +b.dataset.t;
    holdT = setTimeout(() => { M.peek = t; M.peekUsed = true; fillTray(t); }, 380);
  });
  const release = () => { clearTimeout(holdT); if (M.peek >= 0 && !(document.activeElement && document.activeElement.matches('.tb'))) { const t = M.peek; M.peek = -1; setTimeout(() => fillTray(t), 900); } };
  trays.addEventListener('pointerup', release); trays.addEventListener('pointercancel', release); trays.addEventListener('pointerleave', release);
  $('#t-unseen').addEventListener('click', () => { M.unseenOpen = !M.unseenOpen; renderInfo(); });
  $('#t-back').addEventListener('click', leaveMatch);
  $('#t-menu').addEventListener('click', tableMenu);
}
function trayAt(x, y) {
  for (const b of $$('#t-trays .tray')) { const r = b.getBoundingClientRect(); if (x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 8 && y <= r.bottom + 8) return +b.dataset.t; }
  return -1;
}
function leaveMatch() {
  if (M.mode === 'tutorial') { sheet((p, close) => p.append(h('h3', {}, 'Skip the lesson?'), h('p', {}, 'You can replay it any time from Settings.'), h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Keep going'), h('button', { class: 'btn cta', onclick: () => { close(); S.tutorialDone = true; save(); abandon(); } }, 'Skip'))), { label: 'Skip the lesson' }); return; }
  if (!M.st) { abandon(); return; }
  if (M.st.phase === 'over') { M.gen++; stopTimer(); M.cancelDrag(); $$('#table .overlay').forEach(e => e.remove()); commitResult(); showResult(); return; }
  sheet((p, close) => {
    p.append(h('h3', {}, M.mode === 'daily' ? 'Leave the Daily Tray?' : 'Leave this match?'),
      h('p', {}, M.mode === 'daily' ? "Today's attempt is used up if you leave." : `Leaving counts as last place${M.entry ? ` and the ${fmt(M.entry)} Spark entry is lost` : ''}.`),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Stay'), h('button', { class: 'btn cta', onclick: () => {
        close();
        if (!M.st || M.st.phase === 'over') { leaveMatch(); return; }
        S.stats.matches++; bumpVenue(M.mode === 'daily' ? 'daily' : M.vk, false); txMatchStats(M.st.players[0], false);
        if (M.mode === 'daily') S.daily.streak = 0;
        save(); abandon();
      } }, 'Leave')));
  }, { label: 'Leave match' });
}
function clearFx() { $$('.flychip, .steam, .dragchip, #t-trays .scooplabel').forEach(e => e.remove()); }
function abandon() { txTrFire(); M.gen++; M.awaiting = null; txEmoteClose(); if (M.tx) M.tx.swapMode = false; stopTimer(); M.cancelDrag(); removeCoach(); clearFx(); $$('#table .overlay').forEach(e => e.remove()); M.st = null; go('home'); }
function tableMenu() {
  sheet((p, close) => {
    p.append(h('h3', {}, 'How Scoop works'), howList(),
      setRow('Fast AI', 'Shorter thinking pauses. Always on at four seats.', S.settings.fastAI, v => { S.settings.fastAI = v; save(); }),
      setRow('Sound', 'Each number rings its own note.', S.settings.sound, v => { S.settings.sound = v; save(); if (v) SND.unlock(); }),
      setRow('Colour-blind heat', 'Show heat as brightness instead of hue.', S.settings.monoHeat, v => { S.settings.monoHeat = v; save(); applyTheme(); }),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Back to the table'), h('button', { class: 'btn ghost', onclick: () => { close(); setTimeout(leaveMatch, 300); } }, 'Leave')));
  }, { label: 'Table menu' });
}
function howList() {
  const items = ['Drop one chip from your hand into any tray, then draw back up to three.', 'Any three chips in a tray that make a trio (7·7·7 or 4·5·6) scoop the whole tray.', 'A sixth chip with no trio boils the tray over. Those chips are lost.', 'Each chip can set up the next player, so watch every tray\'s heat.', 'Three hands. Most chips scooped wins.'];
  return h('div', { class: 'how' }, items.map((t, i) => h('div', {}, h('i', {}, i + 1), h('span', {}, t))));
}
function setRow(title, sub, on, cb) {
  const sw = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(!!on), 'aria-label': title, type: 'button' });
  sw.addEventListener('click', () => { const v = sw.getAttribute('aria-checked') !== 'true'; sw.setAttribute('aria-checked', String(v)); cb(v); });
  return h('div', { class: 'setrow' }, h('div', {}, h('b', {}, title), h('span', {}, sub)), sw);
}

/* ---------- hand summary ---------- */
function handSummary(sum, next, g) {
  if (g !== M.gen || !M.st) return Promise.resolve();
  return new Promise(res => {
    txEmoteClose();
    const st = M.st, rows = st.players.map((p, i) => ({ i, name: p.name, plus: sum.points[i], tot: sum.totals[i] })).sort((a, b) => b.tot - a.tot);
    const best = [...rows].sort((a, b) => b.plus - a.plus)[0];
    const sid = `sum-rows-${g}-${sum.hand}`, fid = `sum-foot-${g}-${sum.hand}`;
    const ov = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Hand ${sum.hand + 1} summary`, 'aria-describedby': `${sid} ${fid}` });
    const ns = sum.nextStarter;
    const btn = h('button', { class: 'btn cta wide', style: 'margin-top:16px', type: 'button' }, sum.hand >= 2 ? 'See results' : 'Next hand');
    const card = h('div', { class: 'ocard' },
      h('div', { class: 'eyebrow' }, `Hand ${sum.hand + 1} of 3`),
      h('h3', {}, best.plus === 0 ? 'Nobody scooped' : best.i === 0 ? `You took ${best.plus}` : `${best.name} took ${best.plus}`),
      h('div', { class: 'srows', id: sid }, rows.map(r => h('div', { class: 'srow' + (r.i === 0 ? ' me' : ''), role: 'group', 'aria-label': `${r.name}: ${r.plus} this hand, ${r.tot} total` }, txAva(r.i, 34), h('span', { class: 'nm' }, r.name), h('span', { class: 'plus' }, '+' + r.plus), h('span', { class: 'tot' }, r.tot)))),
      h('div', { class: 'ofoot', id: fid }, h('span', {}, `Left on the table: ${sum.leftOnTable.length} chip${sum.leftOnTable.length === 1 ? '' : 's'}`), ns != null ? h('span', {}, `${ns === 0 ? 'You start' : st.players[ns].name + ' starts'}. Lowest score.`) : null),
      btn);
    ov.append(card);
    const others = $$('#table > *');
    others.forEach(el => { el.inert = true; });
    $('#table').append(ov);
    let done = false, watch = 0, auto = 0;
    const finish = () => {
      if (done) return; done = true;
      clearInterval(watch); clearTimeout(auto);
      others.forEach(el => { el.inert = false; });
      ov.remove(); res();
    };
    btn.addEventListener('click', finish);
    ov.addEventListener('click', e => { if (e.target === ov) finish(); });
    ov.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); btn.focus(); } });
    btn.focus({ preventScroll: true });
    if (sum.hand < 2 && !btn.matches(':focus-visible')) {
      auto = setTimeout(finish, 5200);
      const hold = () => clearTimeout(auto);
      card.addEventListener('keydown', hold, { once: true }); card.addEventListener('pointerdown', hold, { once: true }); card.addEventListener('pointerenter', hold, { once: true });
    }
    watch = setInterval(() => { if (g !== M.gen) finish(); }, 300);
    void next;
  });
}

/* ---------- results ---------- */
function bumpVenue(vk, won) { const s = S.stats.venue[vk] || (S.stats.venue[vk] = { played: 0, won: 0 }); s.played++; if (won) s.won++; }
// Books the match the moment the final chip lands, so leaving or reloading during the closing animations cannot lose it.
function commitResult() {
  if (M.committed || !M.st || M.st.phase !== 'over' || M.mode === 'tutorial') return;
  M.committed = true;
  const st = M.st, rk = Scoop.ranking(st), me = rk.find(r => r.pid === 0), today = dayKey();
  const rank0 = bankRank().i, sea0 = { ...ensureSeason() }, tier0 = seasonTier();
  const won = me.place === 1 && me.shared === 1, firstPlace = me.place === 1;
  const daily = M.mode === 'daily';
  let prize = 0;
  if (M.mode === 'venue') prize = Scoop.prizes(st, M.vk)[0];
  if (daily) {
    const d = M.dailyDate || new Date(), yest = dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
    if (won) { S.daily.streak = S.daily.lastWonDay === yest ? S.daily.streak + 1 : 1; S.daily.lastWonDay = M.dailyDay; S.daily.runWins = (S.daily.runWins || 0) + 1; prize = 300 + Math.min(350, 50 * (S.daily.streak - 1)); }
    else S.daily.streak = 0;
  }
  const firstWinToday = firstPlace && S.firstWinDay !== today;
  if (firstPlace) S.firstWinDay = today;
  const pro = S.settings.pro && M.mode === 'venue';
  const xp = Scoop.matchXP(st, 0, M.vk, { firstWinToday, pro });
  const lvBefore = level();
  const p0 = st.players[0], ss = S.stats;
  ss.matches++; if (firstPlace) ss.wins++; ss.scoops += p0.scoops; ss.chips += p0.score; ss.biggest = Math.max(ss.biggest, p0.biggest);
  ss.sprung += p0.sprung; ss.boils += p0.boils; ss.fullTrays += p0.fullTrays;
  bumpVenue(daily ? 'daily' : M.vk, firstPlace);
  let venueReward = null;
  if (firstPlace && M.mode === 'venue' && !S.firstWin[M.vk]) { S.firstWin[M.vk] = today; const tid = VENUE_UI[M.vk].tray; if (grant('tray', tid)) venueReward = itemOf('tray', tid); }
  if (prize) S.sparks += prize;
  const ups = addXP(xp.total);
  txMatchStats(p0, firstPlace);
  const sea = ensureSeason(), season = { gain: sea.id === sea0.id ? sea.xp - sea0.xp : sea.xp, xp0: sea.id === sea0.id ? sea0.xp : 0, tier0: sea.id === sea0.id ? tier0 : 0, xp: sea.xp, tier: seasonTier() };
  if (daily) S.daily.line = `Scoop Daily #${M.dailyNo} · ${st.players[0].score}–${st.players[1].score} · ${p0.scoops} scoop${p0.scoops === 1 ? '' : 's'}`;
  txTrCall(txTrBook, st, rk, me, won, pro);
  save();
  const rank1 = bankRank();
  M.result = { rk, me, prize, xp, ups, venueReward, lvBefore, won, firstWinToday, daily, pro, season, rankUp: rank1.i > Math.min(rank0, M.rank0 == null ? rank0 : M.rank0) ? rank1 : null };
  M.result.trophies = txTrCall(trSince, M.trMark) || []; // includes state trophies that save() awarded during the match
}
function finishMatch() { commitResult(); showResult(); }
function showResult() {
  if (!M.result) commitResult();
  const R = M.result, st = M.st; if (!R || !st) { go('home'); return; }
  txEmoteClose();
  const box = $('#r-views'); box.innerHTML = '';
  go('result');
  const vname = R.daily ? `Daily Tray #${M.dailyNo}` : V[M.vk].name;
  const placeTxt = ord(R.me.place), sup = placeTxt.slice(-2);
  box.append(h('div', { class: 'eyebrow', style: 'margin-top:14px' }, vname),
    h('h1', { class: 'place', 'aria-label': `${placeTxt} place${R.me.shared > 1 ? ', shared' : ''}` }, String(R.me.place), h('sup', { 'aria-hidden': 'true' }, sup)),
    h('p', { class: 'res-sub' }, `${R.me.shared > 1 ? 'Shared place. ' : ''}You scooped ${st.players[0].score} chip${st.players[0].score === 1 ? '' : 's'} in ${st.players[0].scoops} scoop${st.players[0].scoops === 1 ? '' : 's'}.`));
  const rows = h('div', { class: 'srows card', style: 'margin-top:18px' });
  R.rk.forEach(r => { const p = st.players[r.pid]; rows.append(h('div', { class: 'srow' + (r.pid === 0 ? ' me' : ''), role: 'group', 'aria-label': `${ord(r.place)}, ${p.name}, ${r.score} points` }, txAva(r.pid, 34), h('span', { class: 'nm' }, `${ord(r.place)} · ${p.name}`), h('span', { class: 'plus' }, ''), h('span', { class: 'tot' }, r.score))); });
  box.append(rows);
  const prizeEl = h('div', { class: 'prize' });
  if (R.prize) { const b = h('b', {}, '+0'); prizeEl.append(b, h('span', {}, 'Sparks')); countUp(b, R.prize, '+'); prizeEl.setAttribute('aria-label', `Prize: ${fmt(R.prize)} Sparks`); }
  else prizeEl.append(h('span', {}, R.daily ? 'No prize today. The Daily Tray resets at midnight.' : `No prize this time. ${VENUE_UI[M.vk].paid}.`));
  box.append(prizeEl);
  const L0 = R.lvBefore, L1 = level();
  const xpc = h('div', { class: 'card xpcard' }, h('div', { class: 'eyebrow' }, `+${R.xp.total} XP`),
    h('div', { class: 'xplines' }, R.xp.lines.map(([l, v]) => h('div', {}, h('span', {}, l), h('b', {}, '+' + v))),
      (V[M.vk].xpMult !== 1) ? h('div', {}, h('span', {}, `${R.daily ? 'Daily Tray' : V[M.vk].name} multiplier`), h('b', {}, '×' + V[M.vk].xpMult)) : null,
      R.firstWinToday ? h('div', {}, h('span', {}, 'First win today'), h('b', {}, '×2')) : null,
      R.pro ? h('div', {}, h('span', {}, 'Pro view'), h('b', {}, '+10%')) : null));
  const bar = h('i', { style: `width:${L0.need ? (L0.into / L0.need * 100).toFixed(1) : 100}%` });
  xpc.append(h('div', { class: 'xpbar', role: 'progressbar', 'aria-label': 'Level progress', 'aria-valuemin': 0, 'aria-valuenow': L1.into, 'aria-valuemax': L1.need || L1.into }, bar),
    h('div', { class: 'ofoot' }, h('span', {}, `Level ${L1.level}`), h('span', {}, L1.need ? `${L1.into} / ${L1.need} XP` : 'Max level')));
  setTimeout(() => { bar.style.width = (R.ups.length ? 100 : (L1.need ? L1.into / L1.need * 100 : 100)) + '%'; if (R.ups.length) setTimeout(() => { bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth; bar.style.transition = ''; bar.style.width = (L1.need ? L1.into / L1.need * 100 : 100) + '%'; }, 1100); }, 250);
  box.append(xpc, txSeasonCard(R));
  const notes = [];
  R.ups.forEach(u => notes.push(`Level ${u.level} · +${fmt(u.sparks)} Sparks${u.item ? ` · ${u.item.it.name} ${CAT_LABEL[u.item.cat].toLowerCase().replace(/s$/, '')} unlocked` : ''}`));
  if (R.venueReward) notes.push(`First win here · ${R.venueReward.name} tray unlocked`);
  if (R.rankUp) notes.push(`Rank up · ${R.rankUp.name} · Kiln payouts ×${R.rankUp.mult}`);
  notes.push(...R.ups.flatMap(u => VENUE_ORDER.filter(k => V[k].unlock === u.level).map(k => `${V[k].name} is open`)));
  if (notes.length) {
    box.append(h('div', { class: 'card', style: 'margin-top:12px' }, h('div', { class: 'eyebrow' }, 'Unlocked'), h('div', { class: 'achrow' }, notes.map(n => h('span', { class: 'achchip' }, h('i'), n)))));
    if (R.ups.length) setTimeout(() => SND.fanfare(), 300);
  }
  R.trophies = txTrCall(trSince, M.trMark) || R.trophies; // plus anything earned during the closing animations
  const trc = txTrCall(trResultCard, R.trophies); if (trc) box.append(trc);
  if (R.daily && S.daily.line) {
    const code = h('code', {}, S.daily.line);
    const cb = h('button', { class: 'iconbtn', 'aria-label': 'Copy result', html: icon('copy', 18) }); cb.addEventListener('click', () => { copyText(S.daily.line, cb); txTrCall(trEarn, 'brag'); });
    box.append(h('div', { class: 'copyline' }, code, cb));
  }
  const entry = V[M.vk].entry;
  const again = R.daily ? null : h('button', { class: 'btn cta', disabled: S.sparks < entry, onclick: () => startMatch(M.vk) }, S.sparks < entry ? 'Not enough Sparks' : `Again · ${fmt(entry)}`);
  box.append(h('div', { class: 'btnrow' }, again, h('button', { class: 'btn', onclick: showRecap }, 'What they held')),
    h('button', { class: 'btn ghost wide', style: 'margin-top:6px', onclick: () => { M.st = null; go('home'); } }, 'Lobby'));
  const rival = st.players.slice(1).find(p => p.personality);
  if (rival) { const lines = CHATTER[rival.personality][R.me.place === 1 ? 'lose' : 'win']; box.append(h('p', { class: 'res-sub', style: 'text-align:center;margin-top:14px;font-style:italic' }, `${rival.name}: “${pick(lines)}”`)); }
  box.scrollTop = 0;
  const f = box.querySelector('.place'); if (f) { f.tabIndex = -1; f.focus({ preventScroll: true }); }
  txTrCall(trAfterResult);
}
function countUp(el, to, prefix = '') {
  if (reduced()) { el.textContent = prefix + fmt(to); return; }
  const t0 = performance.now(), dur = 900;
  const f = now => { const k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = prefix + fmt(to * e); if (k < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}

/* ---------- what they held ---------- */
function showRecap() {
  const st = M.st, hist = st.history; go('recap');
  $('#rc-sub').textContent = `${hist.length} turns · every hand revealed`;
  const box = $('#rc-views'); box.innerHTML = '';
  const tl = h('div', { class: 'timeline', role: 'group', 'aria-label': 'Turns' }), detail = h('div', { 'aria-live': 'polite' });
  let lastHand = -1;
  hist.forEach((e, i) => {
    if (e.hand !== lastHand) { tl.append(h('span', { class: 'hsep', 'aria-hidden': 'true' }, `H${e.hand + 1}`)); lastHand = e.hand; }
    const kind = outcomeOf(e), p = st.players[e.pid];
    const b = h('button', { class: 'tl k-' + kind, 'aria-pressed': 'false', type: 'button', 'aria-label': `Hand ${e.hand + 1}, turn ${i + 1}: ${nameOf(e.pid)} played ${e.chip} into tray ${e.tray + 1}${kind === 'scoop' ? ', scooped' : kind === 'boil' ? ', boiled over' : ''}` }, p.name[0]);
    b.addEventListener('click', () => { $$('.tl', tl).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); showTurn(i, detail); });
    tl.append(b);
  });
  box.append(h('p', { class: 'res-sub' }, 'Tap a turn to see every hand at that moment. A dot marks a scoop, a ring a boil-over.'), tl, detail);
  const first = hist.findIndex((e, i) => recapNote(i).interesting);
  const btn = $$('.tl', tl)[first >= 0 ? first : 0];
  if (btn) { btn.click(); btn.scrollIntoView({ inline: 'center', block: 'nearest' }); btn.focus({ preventScroll: true }); }
}
function outcomeOf(e) { const after = [...e.trays[e.tray], e.chip]; return Scoop.isTrio(after) ? 'scoop' : after.length >= 6 ? 'boil' : 'feed'; }
function recapNote(i) {
  const st = M.st, hist = st.history, e = hist[i], nm = nameOf(e.pid), kind = outcomeOf(e);
  const hand = e.hands[e.pid], held = hand.slice().sort((a, b) => a - b);
  const couldScoop = e.trays.some(t => hand.some(v => Scoop.isTrio([...t, v])));
  if (kind === 'scoop') return { text: `${nm} dropped the ${e.chip} and scooped ${e.trays[e.tray].length + 1}.`, interesting: false };
  if (kind === 'boil') return { text: `${nm} boiled tray ${e.tray + 1} over with the ${e.chip}, so nobody got those ${e.trays[e.tray].length + 1} chips.`, interesting: true };
  const nx = hist[i + 1];
  if (nx && nx.hand === e.hand && nx.tray === e.tray && nx.pid !== e.pid && outcomeOf(nx) === 'scoop') return { text: `${nm} fed tray ${e.tray + 1}. ${nameOf(nx.pid)} held ${nx.chip === e.chip ? 'another ' : 'a '}${nx.chip} and scooped it next.`, interesting: true };
  if (couldScoop && e.pid !== 0) return { text: `${nm} could have scooped here and fed tray ${e.tray + 1} instead.`, interesting: true };
  const pair = held.find((v, k) => held[k + 1] === v);
  if (pair && e.pid !== 0) return { text: `${nm} held two ${pair}s here and dropped the ${e.chip}.`, interesting: true };
  return { text: `${nm} held ${held.join(' · ')} and fed the ${e.chip} into tray ${e.tray + 1}.`, interesting: false };
}
function showTurn(i, box) {
  const st = M.st, e = st.history[i], nm = nameOf(e.pid); box.innerHTML = '';
  box.append(h('p', { class: 'recap-note' }, recapNote(i).text));
  (st.swaps || []).filter(w => w.ply === e.ply && w.pid === e.pid).forEach(w => box.append(h('p', { class: 'recap-note tx-rcswap' }, `${e.pid === 0 ? 'You' : nm} swapped ${w.out === 8 ? 'an' : 'a'} ${w.out} for ${w.got === 8 ? 'an' : 'a'} ${w.got} from the bag before this move.`)));
  const mt = h('div', { class: 'minitrays' });
  e.trays.forEach((t, ti) => {
    const row = h('div', { class: 'minitray' + (ti === e.tray ? ' hit' : ''), role: 'group', 'aria-label': `Tray ${ti + 1}: ${t.join(', ') || 'empty'}${ti === e.tray ? `. ${nm} drops the ${e.chip} here` : ''}` }, h('span', { class: 'lbl', 'aria-hidden': 'true' }, `TRAY ${ti + 1}`));
    t.forEach(v => row.append(chipEl(v)));
    if (ti === e.tray) row.append(chipEl(e.chip, 'ghost'));
    mt.append(row);
  });
  box.append(mt);
  const hr = h('div', { class: 'hands-reveal' });
  st.players.forEach((p, pid) => {
    const chips = h('div', { class: 'hchips', 'aria-hidden': 'true' });
    const pi = pid === e.pid ? e.hands[pid].indexOf(e.chip) : -1;
    e.hands[pid].forEach((v, k) => chips.append(chipEl(v, k === pi ? 'played' : '')));
    if (pid === e.pid) chips.append(h('span', { class: 'lbl' }, `played the ${e.chip}`));
    if (!e.hands[pid].length) chips.append(h('span', { class: 'lbl' }, 'no chips'));
    hr.append(h('div', { class: 'hr', role: 'group', 'aria-label': `${nameOf(pid)} held ${e.hands[pid].join(', ') || 'nothing'}${pid === e.pid ? `, played the ${e.chip}` : ''}` }, txAva(pid, 34), chips));
  });
  box.append(h('div', { class: 'sec' }, 'Hands at this moment', h('small', {}, `bag ${e.bag}`)), hr);
}

/* ---------- tutorial ---------- */
function lessonState(L) {
  const st = Scoop.newMatch({ players: [{ name: 'You', human: true }, { name: 'Rico', personality: 'rico' }], seed: 4242, venue: 'cafe', record: false });
  const cnt = [0, ...Array(8).fill(st.copies)];
  L.trays.flat().forEach(v => cnt[v]--); L.hand.forEach(v => cnt[v]--);
  const pool = []; for (let v = 1; v <= 8; v++) for (let k = 0; k < cnt[v]; k++) pool.push(v);
  const r = Scoop.makeRng(99 + M.lesson); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  Object.assign(st, { trays: L.trays.map(t => t.slice().sort((a, b) => a - b)), trayEpoch: [0, 0, 0], hands: [L.hand.slice(), pool.splice(0, 3)], bag: pool,
    order: [0, 1], turn: 0, starter: 0, handNo: 0, phase: 'play', piles: [[], []], discard: [], gone: [], lastFed: [null, null], notHeld: [0, 0], events: [], history: [] });
  return st;
}
function startTutorial() {
  M.firstRun = !S.tutorialDone;
  M.mode = 'tutorial'; M.vk = 'cafe'; M.aids = 'full'; M.lesson = 0; M.flags = {}; M.bubbles = {}; M.lastChat = {}; M.committed = false; M.result = null;
  runLesson();
}
function runLesson() {
  const L = LESSONS[M.lesson];
  M.st = lessonState(L);
  enterTable();
  showCoach(L.title, L.text, null);
}
async function lessonDone(g) {
  const L = LESSONS[M.lesson];
  let heat = 0;
  if (M.lesson === 2) { const lp = M.lastPlayed; const gl = Scoop.glance(M.st, 0); heat = lp ? gl.heat[lp.tray] : 0; }
  await sleep(250); if (g !== M.gen) return;
  if (M.lesson < LESSONS.length - 1) { showCoach(L.title, L.after(heat), 'Next lesson', () => { M.lesson++; runLesson(); }); return; }
  txTrCall(trEarn, 'lesson');
  if (M.firstRun) showCoach("You're ready", `${L.after(heat)} Your first match at the Corner Café is on the house.`, 'Sit down with Rico', () => { S.tutorialDone = true; save(); removeCoach(); startMatch('cafe', { free: true, rivals: ['rico'] }); });
  else showCoach("That's the lesson", `${L.after(heat)} The Corner Café is open whenever you are.`, 'Back to the lobby', () => { removeCoach(); abandon(); save(); });  // save() lets anything the lesson completed (even the Platinum) land in the lobby
}
function showCoach(title, text, btnText, cb) {
  removeCoach();
  const c = h('div', { class: 'coach' }, M.mode === 'tutorial' ? h('div', { class: 'step' }, `Lesson ${M.lesson + 1} of ${LESSONS.length}`) : null, h('b', {}, title), h('span', {}, text));
  if (btnText) { const b = h('button', { class: 'btn', type: 'button' }, btnText); b.addEventListener('click', cb); c.append(h('div', {}, b)); }
  const opps = $('#t-opps'), a = $('#app').getBoundingClientRect(), r = opps.getBoundingClientRect();
  c.style.top = Math.max(8, r.top - a.top - 4) + 'px';
  $('#table').append(c); M.coach = c;
  announce(`${title}. ${text}`);
  if (btnText) setTimeout(() => { const b = c.querySelector('.btn'); if (b) b.focus({ preventScroll: true }); }, 50);
}
function nudgeCoach() { if (M.coach && !reduced()) M.coach.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260 }); }
function removeCoach() { if (M.coach) { M.coach.remove(); M.coach = null; } }

/* ---------- keyboard ---------- */
function tableKeys(e) {
  if (CUR === 'table' && e.key === 'Escape' && M.tx && M.tx.pop && !sheetOpen()) { e.preventDefault(); txEmoteClose(true); return; }
  if (CUR !== 'table' || !M.awaiting || sheetOpen() || $('#table .overlay')) return;
  if (e.target.closest('input') || (M.tx && M.tx.pop)) return;
  const n = +e.key;
  if (n >= 1 && n <= 3 && !e.repeat) {
    e.preventDefault();
    if (M.lifted < 0) { if (n <= M.D.hand.length) { const b = $$('#t-hand-chips .chip')[n - 1]; if (b && !b.disabled) liftChip(n - 1, true); } }
    else { const v = M.D.hand[M.lifted]; if (lessonAllows(v, n - 1)) playHuman(v, n - 1); else nudgeCoach(); }
  } else if (e.key === 'Escape' && M.tx && M.tx.swapMode) { e.preventDefault(); txSwapCancel(true); }
  else if (e.key === 'Escape' && M.lifted >= 0) { liftChip(M.lifted, true); }
}

/* ---------- avatars, emotes, Peek and Swap, playstyle stats ---------- */
const TX_EMO = { rico: ['🔥', '😂', '😤'], priya: ['👋', '😮', '⚡'], mabel: ['🍵', '👍', '😊'], otto: ['😬', '💀', '🙄'], june: ['🧠', '🎯', '🤫'], sol: ['😈', '🤫', '🎯'] };
const TX_EMO_MS = 2400, TX_EMO_GAP = 3000;
const txLive = () => M.mode !== 'tutorial';    // stats and emotes
const txBoosts = () => M.mode === 'venue';     // Peek and Swap stay out of the Daily Tray and the tutorial
const txMode = () => M.mode === 'daily' ? 'daily' : M.vk;
const txA = v => (v === 8 ? 'an ' : 'a ') + v;
function txAva(pid, size, cls) {
  if (pid === 0) return myAvatarEl(size, cls);
  const p = M.st && M.st.players[pid];
  return rivalAvaEl(p ? p.personality : null, size, cls);
}
function txReset() {
  txEmoteClose(); txTrFire();
  const st = M.st;
  M.tx = { id: (M.tx ? M.tx.id : 0) + 1, t0: Date.now(), timed: false, bag0: st ? { [st.handNo]: st.bag.length } : {}, fed: [-1, -1, -1], preFed: -1,
    peeked: null, peekHand: -1, swapHand: -1, swapMode: false, emo: {}, meAt: 0, rivAt: {}, pop: null, popOut: null, foot: null,
    // trophies: queued moments, ids already earned this match, per-match counters
    due: [], tr: {}, boils: 0, handBoils: 0, sprung: 0, doubles: 0, steals: 0, lo: false, hi: false, giftsBy: {}, hf: {}, outs: 0, autoPly: -1, tea: 0 };
}

/* stats: every human turn, scoops gifted to rivals, hand wins; match totals in commitResult */
function txStats(prev, next, action) {
  const T = M.tx; if (!T || !txLive()) return;
  if (next.handNo !== prev.handNo && next.phase === 'play') T.bag0[next.handNo] = next.bag.length;
  const d = { turn: 0, chance: 0, took: 0, feed: 0, heat: 0, trap: 0, stage: -1, gifts: 0, giftChips: 0, hands: 0, handWins: 0 };
  if (prev.turn === 0) {
    const oc = Scoop.moveOutcome(prev, action.chip, action.tray);
    d.turn = 1;
    d.chance = Scoop.legalActions(prev, 0).some(a => Scoop.moveOutcome(prev, a.chip, a.tray).kind === 'scoop') ? 1 : 0;
    if (oc.kind === 'scoop') d.took = 1;
    else if (oc.kind === 'feed') {
      // the hand can end on this chip; then nobody is left to finish the tray
      d.feed = 1; d.heat = next.phase === 'play' && next.handNo === prev.handNo ? Scoop.trayHeat(next, 0, action.tray) : 0;
      const kept = prev.hands[0].slice(); kept.splice(kept.indexOf(action.chip), 1);
      d.trap = kept.some(v => oc.completers.includes(v)) ? 1 : 0;
      const f = prev.bag.length / (T.bag0[prev.handNo] || prev.bag.length || 1);
      d.stage = f > 2 / 3 ? 0 : f > 1 / 3 ? 1 : f > 0 ? 2 : 3;
    }
  }
  if (d.feed) { const hf = T.hf[prev.handNo] || (T.hf[prev.handNo] = [0, 0]); hf[0]++; if (d.heat >= .3) hf[1]++; } // feeds and hot feeds per hand, for Cool Customer
  const pre = [];
  for (const ev of next.events) {
    if (ev.type === 'play') { pre[ev.tray] = T.fed[ev.tray]; T.fed[ev.tray] = ev.pid; }
    else if (ev.type === 'scoop') { if (ev.pid !== 0 && pre[ev.tray] === 0) { d.gifts++; d.giftChips += ev.points; } T.fed[ev.tray] = -1; }
    else if (ev.type === 'boil') T.fed[ev.tray] = -1;
    else if (ev.type === 'handEnd') { const pts = ev.summary.points; d.hands++; if (pts[0] === Math.max(...pts)) d.handWins++; T.fed = [-1, -1, -1]; }
  }
  if (!d.turn && !d.gifts && !d.hands) return;
  bumpStats(txMode(), b => {
    b.turns += d.turn; b.scoopChances += d.chance; b.scoopsTaken += d.took;
    if (d.feed) {
      b.feeds++; b.feedHeat += d.heat; if (d.heat >= .3) b.hotFeeds++; if (d.heat < .1) b.coolFeeds++;
      b.traps += d.trap; b.stageFeeds[d.stage]++; b.stageHeat[d.stage] += d.heat;
    }
    b.gifts += d.gifts; b.giftChips += d.giftChips; b.hands += d.hands; b.handWins += d.handWins;
  });
  save();
}
function txMatchStats(p0, first) {
  const T = M.tx; if (!txLive()) return;
  const ms = T && !T.timed ? Date.now() - T.t0 : 0; if (T) T.timed = true;
  bumpStats(txMode(), b => {
    b.matches++; if (first) b.wins++;
    b.chips += p0.score; b.scoops += p0.scoops; b.biggest = Math.max(b.biggest, p0.biggest);
    b.fullTrays += p0.fullTrays; b.sprung += p0.sprung; b.boils += p0.boils; b.playMs += ms;
  });
}

/* your footer: the avatar opens the emote popover; Peek and Swap sit beside it. Built once per table so focus survives re-renders. */
function txFoot(box) {
  const T = M.tx;
  if (T.foot && T.foot.box === box && box.contains(T.foot.who)) return T.foot;
  const live = txLive(), ava = myAvatarEl(34, 'tx-meava');
  const me = live ? h('button', { class: 'tx-me', type: 'button', 'aria-label': 'Send an emote', 'aria-expanded': 'false', 'aria-controls': 'tx-pop', 'data-fk': 'tx-emote' }, ava,
    h('span', { class: 'tx-mehint', 'aria-hidden': 'true', html: '<svg viewBox="0 0 16 16"><path d="M2.5 4.6A2.6 2.6 0 0 1 5.1 2h5.8a2.6 2.6 0 0 1 2.6 2.6v3.6a2.6 2.6 0 0 1-2.6 2.6H7.2L4 13.4v-2.7a2.6 2.6 0 0 1-1.5-2.4z" fill="currentColor"/></svg>' })) : ava;
  if (live) me.addEventListener('click', txEmoteToggle);
  const mw = h('span', { class: 'tx-mew' }, me), score = h('b', {}, '0');
  const F = { box, who: h('div', { class: 'who' }, mw, h('div', {}, score, h('span', {}, ' You'))), me: live ? me : null, mw, score, right: h('div', { class: 'tx-right' }), peek: null, swap: null };
  const kids = [F.who];
  if (txBoosts()) {
    F.peek = txBoostBtn('peeks', txPeek); F.swap = txBoostBtn('swaps', txSwapToggle);
    kids.push(h('div', { class: 'tx-boosts', role: 'group', 'aria-label': 'Boosters' }, F.peek, F.swap));
  }
  kids.push(F.right);
  box.replaceChildren(...kids);
  return T.foot = F;
}
function txBoostBtn(k, fn) {
  const b = h('button', { class: 'tx-bst', type: 'button', 'data-k': k, 'data-fk': 'tx-' + k, html: curIcon(k, 18) + '<b aria-hidden="true"></b>' });
  b.addEventListener('click', fn);
  return b;
}
function txBoostSync() {
  const T = M.tx, F = T && T.foot; if (!F || !F.peek || !M.st || !M.D) return;
  const turn = !!M.awaiting, hand = M.st.handNo;
  const one = (b, k, word, desc, used, ready) => {
    const n = bal(k), ok = n > 0 && !used && turn && ready;
    b.querySelector('b').textContent = fmt(n);
    b.classList.toggle('none', n === 0);
    b.setAttribute('aria-disabled', String(!ok));
    b.setAttribute('aria-label', `${word}, ${fmt(n)} left. ${desc}` + (n === 0 ? '' : used ? ' Used this hand.' : !turn ? ' Ready on your turn.' : !ready ? ' Not available right now.' : ''));
  };
  one(F.peek, 'peeks', 'Peek', 'See one chip the next rival holds.', T.peekHand === hand, txNextRival() >= 0);
  one(F.swap, 'swaps', 'Swap', 'Trade one of your chips for one from the bag.', T.swapHand === hand, M.st.bag.length > 0);
  F.swap.setAttribute('aria-pressed', String(!!(T.swapMode && turn)));
}
// the next rival in turn order who still holds chips
function txNextRival() {
  const st = M.st; if (!st || st.phase !== 'play') return -1;
  const i = st.order.indexOf(0);
  for (let k = 1; k < st.N; k++) { const p = st.order[(i + k) % st.N]; if (st.hands[p].length) return p; }
  return -1;
}

/* Peek: one chip of the next rival's hand, shown on their card until it leaves their hand or the hand ends */
const txPeekOf = pid => { const T = M.tx, k = T && T.peeked; return k && k.pid === pid && M.st && k.hand === M.st.handNo ? k : null; };
function txOppAva(pid, pk) {
  const T = M.tx, em = T && T.emo[pid];
  return h('span', { class: 'tx-avw' }, txAva(pid, 44, 'tx-oava'),
    pk ? h('span', { class: 'tx-pk', 'aria-hidden': 'true', style: `animation-delay:${-(Date.now() - pk.at)}ms`, html: curIcon('peeks', 14) }, chipEl(pk.v)) : null,
    em ? h('span', { class: 'tx-emb', 'aria-hidden': 'true', style: txEmoDelay(em) }, em.e) : null);
}
function txPeek() {
  const T = M.tx, st = M.st; if (!T || !st || !txBoosts()) return;
  if (bal('peeks') < 1) { toast('Out of Peeks. Get more in the Shop.'); return; }
  if (T.peekHand === st.handNo) { toast('One Peek per hand. You can peek again next hand.'); return; }
  if (!M.awaiting || st.turn !== 0) { toast('You can peek on your turn.'); return; }
  const pid = txNextRival(); if (pid < 0) { toast('Nobody else is holding chips right now.'); return; }
  if (!spend('peeks', 1)) return;
  const hand = st.hands[pid], v = hand[Math.floor(Math.random() * hand.length)], text = `${st.players[pid].name} holds ${txA(v)}`;
  T.peekHand = st.handNo; T.peeked = { pid, v, hand: st.handNo, at: Date.now() };
  bumpStats(txMode(), b => { b.peeksUsed++; }); save();
  const tok = { text, peek: true };
  M.bubbles = { [pid]: tok };
  setTimeout(() => { if (M.bubbles[pid] === tok) { delete M.bubbles[pid]; renderOpps(); } }, 2600);
  renderOpps(); txBoostSync();
  announce(`Peek: ${text}.`);
}

/* Swap: send one chip back to the bag and draw a random one from it */
function txSwapToggle() {
  const T = M.tx, st = M.st; if (!T || !st || !txBoosts()) return;
  if (T.swapMode) { txSwapCancel(); return; }
  if (bal('swaps') < 1) { toast('Out of Swaps. Get more in the Shop.'); return; }
  if (T.swapHand === st.handNo) { toast('One Swap per hand. You can swap again next hand.'); return; }
  if (!M.awaiting || st.turn !== 0) { toast('You can swap on your turn.'); return; }
  if (!st.bag.length) { toast('The bag is empty, so there is nothing to swap with.'); return; }
  M.cancelDrag(); M.lifted = -1; M.previews = null; M.prevGen++; M.hover = -1;
  T.swapMode = true;
  renderTrays(); renderHand(); renderActions(); renderGlance(); txBoostSync();
  announce('Swap: pick a chip to send back to the bag. Escape cancels.');
  const b = $('#t-hand-chips .chip:not(:disabled)'); if (b) b.focus({ preventScroll: true });
}
function txSwapCancel(refocus) {
  const T = M.tx; if (!T || !T.swapMode) return;
  T.swapMode = false;
  renderHand(); renderActions(); txBoostSync();
  announce('Swap cancelled.');
  if (refocus && T.foot && T.foot.swap) T.foot.swap.focus({ preventScroll: true });
}
function txSwapHint() {
  const c = h('button', { class: 'btn smallbtn tx-cancel', type: 'button', 'data-fk': 'tx-swap-cancel' }, 'Cancel');
  c.addEventListener('click', () => txSwapCancel(true));
  return h('div', { class: 'hint tx-swaphint' }, h('span', {}, matchMedia('(hover: hover)').matches ? 'Pick a chip to swap. Keys 1-3 work too.' : 'Tap a chip to swap it'), c);
}
// A new state value: the chip goes back into the bag at a random place and a chip already in the bag comes out.
// Everything derived (unseen counts, heat, WIN%, AI views) is computed from hands, bag, trays and gone, so they stay consistent.
function txSwapState(st, pid, i) {
  const swaps = st.swaps || [], r = Scoop.makeRng(Scoop.hash32(st.seed, st.ply, pid, 0x5A4B, swaps.length));
  const bag = st.bag.slice(), hands = st.hands.map(x => x.slice()), notHeld = st.notHeld.slice(), out = hands[pid][i];
  const got = bag.splice(Math.floor(r() * bag.length), 1)[0];
  bag.splice(Math.floor(r() * (bag.length + 1)), 0, out);
  hands[pid][i] = got;
  notHeld[pid] = 0; // what rivals inferred about this hand no longer holds
  return { ...st, bag, hands, notHeld, events: [], swaps: [...swaps, { hand: st.handNo, ply: st.ply, pid, out, got }] };
}
function txDoSwap(i) {
  const T = M.tx, st = M.st;
  if (!T || !st || !M.awaiting || st.turn !== 0 || !st.bag.length || st.hands[0][i] == null) { if (T) { T.swapMode = false; renderHand(); renderActions(); txBoostSync(); } return; }
  if (!spend('swaps', 1)) { T.swapMode = false; renderHand(); renderActions(); txBoostSync(); toast('Out of Swaps. Get more in the Shop.'); return; }
  const out = st.hands[0][i];
  M.st = txSwapState(st, 0, i);
  const got = M.st.hands[0][i];
  T.swapMode = false; T.swapHand = st.handNo;
  bumpStats(txMode(), b => { b.swapsUsed++; }); save();
  syncD(); refreshGlance(); refreshWin(); renderTable();
  const c = $$('#t-hand-chips .chip')[i];
  if (c) {
    if (!reduced()) { c.classList.remove('droptin'); void c.offsetWidth; c.classList.add('droptin'); }
    c.focus({ preventScroll: true });
  }
  SND.clink(got);
  toast(`Swapped your ${out} for ${txA(got)}`);
}

/* emotes */
function txEmoteToggle() { if (M.tx && M.tx.pop) txEmoteClose(true); else txEmoteOpen(); }
function txEmoteOpen() {
  const T = M.tx, F = T && T.foot; if (!F || !F.me || !M.st || CUR !== 'table') return;
  const set = (S.emoteSet || []).map(emoteOf).filter(Boolean).slice(0, 6);
  const pop = h('div', { class: 'tx-pop', id: 'tx-pop', role: 'group', 'aria-label': 'Emotes', tabindex: '-1' }, set.map(e => h('button', { class: 'tx-emo', type: 'button', 'aria-label': e.name, title: e.name, 'data-fk': 'tx-emo-' + e.id, onclick: () => txSendEmote(e.id) }, h('span', { 'aria-hidden': 'true' }, e.e))));
  pop.addEventListener('keydown', e => {
    const bs = $$('.tx-emo', pop), i = bs.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); txEmoteClose(true); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = bs.length; bs[(i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n].focus(); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); bs[e.key === 'Home' ? 0 : bs.length - 1].focus(); }
  });
  // Tabbing away closes it; a blur of the whole window leaves activeElement in place, so the picker stays.
  pop.addEventListener('focusout', () => setTimeout(() => { const a = document.activeElement; if (T.pop === pop && !pop.contains(a) && a !== F.me) txEmoteClose(); }, 0));
  T.popOut = e => { if (!pop.contains(e.target) && !F.me.contains(e.target)) txEmoteClose(); };
  document.addEventListener('pointerdown', T.popOut, true);
  T.pop = pop; F.who.after(pop); F.me.setAttribute('aria-expanded', 'true'); // next to the avatar in tab order
  const b = $('.tx-emo', pop); if (b) b.focus({ preventScroll: true });
}
function txEmoteClose(refocus) {
  const T = M.tx; if (!T || !T.pop) return;
  const pop = T.pop, inside = pop.contains(document.activeElement), me = T.foot && T.foot.me;
  T.pop = null; pop.remove();
  document.removeEventListener('pointerdown', T.popOut, true);
  if (me) { me.setAttribute('aria-expanded', 'false'); if ((refocus || inside) && me.isConnected && CUR === 'table') me.focus({ preventScroll: true }); }
}
function txSendEmote(id) {
  const T = M.tx, e = emoteOf(id);
  txEmoteClose(true);
  if (!T || !e || !M.st || !txLive() || CUR !== 'table') return;
  const now = Date.now(); if (now - T.meAt < TX_EMO_GAP) return; // one every 3 seconds
  T.meAt = now;
  txShowEmote(0, e.e);
  announce(`You: ${e.e}`);
  bumpStats(txMode(), b => { b.emotes++; }); save();
  if (id === 'nice' && T.tea && now - T.tea <= 8000) txTrNow('cheers'); // a 👍 for Mabel's 🍵
  const rivals = M.st.players.filter(p => !p.human && TX_EMO[p.personality]);
  if (rivals.length && Math.random() < .35) {
    const p = pick(rivals), g = M.gen;
    setTimeout(() => { if (g === M.gen) txRivalEmote(p.id, 1); }, 800 + Math.random() * 800);
  }
}
function txRivalEmote(pid, prob) {
  const T = M.tx, st = M.st; if (!T || !st || CUR !== 'table' || !txLive()) return false;
  const p = st.players[pid], list = p && !p.human && TX_EMO[p.personality];
  if (!list || Math.random() >= prob) return false;
  const now = Date.now(); if (now - (T.rivAt[pid] || 0) < TX_EMO_GAP) return false;
  T.rivAt[pid] = now;
  const e = pick(list);
  if (p.personality === 'mabel' && e === '🍵') T.tea = now;
  txShowEmote(pid, e); announce(`${p.name}: ${e}`);
  return true;
}
// Bubbles carry their start time; re-renders resume the animation where it was (negative delay).
function txShowEmote(pid, e) {
  const T = M.tx, tok = { e, at: Date.now() };
  T.emo[pid] = tok;
  if (pid === 0) txMeBubble(); else renderOpps();
  setTimeout(() => { if (M.tx === T && T.emo[pid] === tok) { delete T.emo[pid]; if (pid === 0) txMeBubble(); else renderOpps(); } }, TX_EMO_MS);
}
const txEmoDelay = tok => { const e = Date.now() - tok.at; return `animation-delay:${-e}ms,${TX_EMO_MS - 350 - e}ms`; };
function txMeBubble() {
  const T = M.tx, F = T && T.foot; if (!F) return;
  $$('.tx-mebub', F.mw).forEach(x => x.remove());
  const tok = T.emo[0]; if (tok) F.mw.append(h('span', { class: 'tx-mebub', 'aria-hidden': 'true', style: txEmoDelay(tok) }, tok.e));
}

/* result: season progress under the XP card */
function txSeasonCard(R) {
  const sx = R.season; if (!sx) return null;
  const per = SEASON.xpPerTier, top = sx.tier >= SEASON.tiers, into = top ? per : sx.xp - sx.tier * per;
  const from = sx.tier0 === sx.tier && !top ? Math.max(0, sx.xp0 - sx.tier0 * per) : 0;
  const n = seasonClaimable(), up = sx.tier > sx.tier0;
  const bar = h('i', { style: `width:${(from / per * 100).toFixed(1)}%` });
  const claim = n > 0 ? h('button', { class: 'btn cta tx-claim', type: 'button', 'data-fk': 'tx-claim', 'aria-label': `Claim ${n} season reward${n === 1 ? '' : 's'}`, onclick: openSeason }, 'Claim', n > 1 ? h('span', { class: 'tx-cnt', 'aria-hidden': 'true' }, n) : null) : null;
  const card = h('div', { class: 'card tx-season' },
    h('div', { class: 'tx-shead' }, h('div', { class: 'tx-stier', 'aria-hidden': 'true' }, String(sx.tier)),
      h('div', { class: 'tx-stxt' }, h('div', { class: 'eyebrow' }, `${up ? 'Tier up' : 'Season pass'} · ${durText(seasonEndsAt() - Date.now())} left`),
        h('b', {}, `+${fmt(sx.gain)} season XP · `, h('span', {}, `Tier ${sx.tier}`)))),
    h('div', { class: 'tx-sbar', role: 'progressbar', 'aria-label': top ? 'Season pass complete' : `Progress to tier ${sx.tier + 1}`, 'aria-valuemin': 0, 'aria-valuemax': per, 'aria-valuenow': into }, bar),
    h('div', { class: 'ofoot tx-sfoot' }, h('span', {}, top ? 'Max tier reached' : `${fmt(into)} / ${per} XP to tier ${sx.tier + 1}`), claim));
  setTimeout(() => { bar.style.width = (into / per * 100).toFixed(1) + '%'; }, 350);
  return card;
}

/* trophies. Moments are judged when the engine resolves a move and earned as the scoop or boil shows (txTrFire);
   whatever is still queued is earned before the match is booked or left, so nothing is lost and nothing fires later. */
// The trophy API lives in another module; a fault there must never stall a match or lose its booking.
function txTrCall(f, ...a) { try { return f(...a); } catch (e) { console.error(e); } }
function txTrNow(id) { const T = M.tx; if (T && !T.tr[id]) { T.tr[id] = 1; txTrCall(trEarn, id); } }
function txTrScan(prev, next) {
  const T = M.tx; if (!T || !txLive()) return;
  const due = (ev, id) => { if (!T.tr[id]) { T.tr[id] = 1; T.due.push({ ev, id }); } };
  const by = [], ended = next.events.some(e => e.type === 'handEnd'), glass = M.mode === 'venue' && M.vk === 'glasshouse';
  for (const ev of next.events) {
    if (ev.type === 'play') by[ev.tray] = T.fed[ev.tray]; // who fed it last before this chip
    else if (ev.type === 'scoop') {
      const f = by[ev.tray], count = v => ev.chips.filter(c => c === v).length;
      if (ev.pid !== 0) { if (f === 0) { T.giftsBy[prev.handNo] = (T.giftsBy[prev.handNo] || 0) + 1; if (ev.points >= 6) due(ev, 'generous'); } continue; }
      if (ev.double && ++T.doubles === 3) due(ev, 'double');
      if (ev.sprung && ++T.sprung === 4) due(ev, 'trapper');
      // Sol's own trap: he fed it last while holding a chip that finishes it
      if (f > 0 && next.players[f].personality === 'sol' && Scoop.completers(prev.trays[ev.tray], prev.rules.values).some(v => prev.hands[f].includes(v)) && ++T.steals === 2) due(ev, 'turnabout');
      if (glass && prev.ply !== T.autoPly && M.timeLeft <= 2) due(ev, 'nerve');
      if (count(1) >= 3) T.lo = true;
      if (count(8) >= 3) T.hi = true;
      if (T.lo && T.hi) due(ev, 'bookends');
      if (ended) { M.flags.lastchip = true; due(ev, 'lastchip'); }
      for (let v = 1; v <= 8; v++) if (count(v) >= 3) T.due.push({ ev, set: v });
    } else if (ev.type === 'boil' && ev.pid === 0) {
      if (++T.boils === 3) due(ev, 'spoiler');
      if (++T.handBoils === 2) due(ev, 'steam');
    } else if (ev.type === 'handEnd') T.handBoils = 0;
  }
}
// Earn what was queued for this event (or everything, with no event).
function txTrFire(ev) {
  const T = M.tx; if (!T || !T.due || !T.due.length) return;
  const now = T.due.filter(d => !ev || d.ev === ev); T.due = ev ? T.due.filter(d => d.ev !== ev) : [];
  let sets = false;
  now.forEach(d => { if (d.set) { txTrCall(trNoteSet, d.set); sets = true; } else txTrCall(trEarn, d.id); });
  if (sets) save(); // lets the set trophies (Lucky Sevens, Every Number) land now
}
// Judged once, when commitResult books the match.
function txTrBook(st, rk, me, won, pro) {
  txTrFire(); // moments from the final chip belong to this match's list
  const T = M.tx; if (!T) return;
  const first = me.place === 1, p0 = st.players[0], riv = rk.filter(r => r.pid !== 0), pers = r => st.players[r.pid].personality;
  const venue = k => M.mode === 'venue' && M.vk === k, sol = riv.find(r => pers(r) === 'sol'), ids = [];
  const last = st.handSummaries[st.handSummaries.length - 1] || { points: [] }, lastHand = st.rules.hands - 1;
  // the three below keep the rules of the achievements they replace
  if (first && st.N >= 3 && st.handSummaries[1]) { const t2 = st.handSummaries[1].totals; if (t2[0] < Math.min(...t2.slice(1))) ids.push('comeback'); }
  if (st.N >= 3 && st.handSummaries.length === 3 && st.handSummaries.every(s => s.points[0] > Math.max(...s.points.slice(1)))) ids.push('sweep');
  if (first && M.vk === 'glasshouse' && pro) ids.push('glassact');
  if (first && Object.values(T.hf).some(([n, hot]) => n >= 3 && !hot)) ids.push('cool');
  if (first && st.N >= 3 && !T.giftsBy[lastHand]) ids.push('untouch');
  if (first && p0.scoops > 0 && riv.every(r => !last.points[r.pid])) ids.push('whitewash');
  if (first && venue('glasshouse') && !T.outs) ids.push('pressure');
  if (first && venue('supper') && sol && sol.place > 1 && sol.place === Math.max(...rk.map(r => r.place)) && !last.points[sol.pid]) ids.push('headtable');
  if (won && riv.some(r => r.score === me.score)) ids.push('photo');
  if (st.N === 4 && st.players.every(p => !p.boils)) ids.push('nowaste');
  if (new Date().getHours() < 4) ids.push('nightowl');
  ids.forEach(id => txTrNow(id));
  riv.forEach(r => { if (r.place > me.place) txTrCall(trNoteBeat, pers(r)); });
}
