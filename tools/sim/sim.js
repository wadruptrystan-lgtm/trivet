#!/usr/bin/env node
/*
 * trivet trophy simulator (agent S). Plays whole matches with the real engine and judges every match trophy
 * the way src/table.js does (txTrScan / txStats / txTrBook), then measures variant rules.
 *
 *   node sim.js                     full run (all venues; proxies sensible = main, june + rollout = range, boiler / careful / setter =
 *                                   players aiming at boil-over, low-heat and trap trophies), writes out/results.json + out/records.ndjson.gz (~40 min, 4 cores)
 *   node sim.js --quick             small run for a smoke test
 *   node sim.js --check 200         run table.js's own hook functions side by side and assert identical trophies
 *   node sim.js --from out/records.ndjson.gz   re-aggregate saved match records without simulating
 * Options: --proxies sensible,june  --n cafe=40000,supper=12000  --scale 0.5  --seed 7  --workers 4
 * Paths: engine and table are read from this folder (copies of MAIN/src); override with ENGINE=... TABLE=...
 */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const ENGINE = process.env.ENGINE || path.join(__dirname, '../../src/engine.js');
const TABLE = process.env.TABLE || path.join(__dirname, '../../src/table.js');
const Scoop = new Function(fs.readFileSync(ENGINE, 'utf8') + '; return Scoop;')();

const VENUE_KEYS = ['cafe', 'noodle', 'tea', 'supper', 'glasshouse', 'daily'];
// matches per venue for the main proxy; second proxies get SECOND_SHARE of it
const N_MAIN = { cafe: 40000, noodle: 40000, tea: 40000, daily: 40000, supper: 12000, glasshouse: 12000 };
const SECOND_SHARE = 0.4, AIM_SHARE = 0.25;

/* ------------------------------------------------------------------ one match */
// table.js lineup(): who sits at each venue (r = seeded rng; cafe alternates Rico / Priya like S.cafeOpp)
function lineup(vk, r, i) {
  const sh = a => { const b = a.slice(); for (let k = b.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [b[k], b[j]] = [b[j], b[k]]; } return b; };
  if (vk === 'daily') return ['june'];
  if (vk === 'cafe') return [i % 2 ? 'priya' : 'rico'];
  if (vk === 'noodle') return sh(['priya', 'mabel', 'otto']).slice(0, 2);
  if (vk === 'tea') return [['mabel', 'otto', 'june'][Math.floor(r() * 3)]];
  if (vk === 'supper') return ['sol', ...sh(['mabel', 'otto', 'june']).slice(0, 2)];
  return ['sol', 'june', 'otto'];
}
// seat 0's proxy for a decent human
function proxyMove(st, proxy, venue) {
  if (proxy === 'sensible') return Scoop.aiChooseAction(st, 0, 'sensible', { venue });            // venue sharpness
  if (proxy === 'june') return Scoop.aiChooseAction(st, 0, 'june', { venue, hard: false });         // June's style, medium tier
  if (proxy === 'self') return Scoop.aiChooseAction(st, 0, Scoop.SELF_PROFILE, { venue });          // engine's "decent player"
  if (proxy === 'rollout') return Scoop.aiChooseAction(st, 0, 'rollout', { venue });                // fast WIN% policy
  // players aiming at a trophy (sensible at venue sharpness with one weight changed)
  if (AIM[proxy]) return Scoop.aiChooseAction(st, 0, AIM[proxy], { venue });
  throw new Error('unknown proxy ' + proxy);
}
const AIM = {
  boiler: { name: 'boiler', lambda: 1.0, mu: 0.3, beta: 3, kappa: 0.5, big: 0 },             // aims at Spoiler / Steam Room
  careful: { name: 'careful', lambda: 3.0, mu: 0, beta: 1, kappa: 0.5, big: 0 },             // aims at Cool / Untouchable / Whitewash
  setter: { name: 'setter', lambda: 1.0, mu: 0.8, beta: 0, kappa: 1, big: 0, slowplay: true }, // aims at Trapper (Sol's style, medium tier)
};
const chipsStr = c => c.join('');

// Plays one match. hook(prev, next, action) (optional) sees every move, like table.js perform().
function playMatch(vk, proxy, seed, rivals, hook) {
  const venue = vk === 'daily' ? 'tea' : vk; // the Daily Tray is startMatch('tea', {daily}) vs June
  const players = [{ name: 'You', human: true }, ...rivals.map(k => ({ name: k, personality: k }))];
  let st = Scoop.newMatch({ players, seed, venue, record: false });
  // T mirrors table.js M.tx: fed = who fed each tray last (txStats), plus raw facts for every rule and variant
  const T = { fed: [-1, -1, -1], hb: [0, 0, 0], ab: [0, 0, 0], th: [], ms: [], gf: [], fh: [], fhh: '', lc: 0, sets: 0, sk: [0, 0, 0, 0, 0, 0, 0, 0] };
  while (st.phase === 'play') {
    const pid = st.turn;
    // budgetMs off: the hard tier always gets its full 120 samples (measured ~4 ms a move here, never truncated at 60 ms)
    const a = pid === 0 ? proxyMove(st, proxy, venue) : Scoop.aiChooseAction(st, pid, st.players[pid].personality, { venue, budgetMs: 1e9 });
    const action = { type: 'play', chip: a.chip, tray: a.tray };
    const prev = st, next = Scoop.applyAction(prev, action);
    scan(T, prev, next);           // = txTrScan (reads T.fed before txStats moves it on)
    stats(T, prev, next, action);  // = txStats (feeds, heat after each feed, who fed each tray last)
    if (hook) hook(prev, next, action);
    st = next;
  }
  return book(T, st, vk, proxy);
}
function scan(T, prev, next) {
  const by = [], ended = next.events.some(e => e.type === 'handEnd'), hand = prev.handNo;
  let chip = 0;
  for (const ev of next.events) {
    if (ev.type === 'play') { by[ev.tray] = T.fed[ev.tray]; chip = ev.chip; }
    else if (ev.type === 'scoop') {
      const f = by[ev.tray];
      if (ev.pid !== 0) { if (f === 0) T.gf.push([ev.points, hand]); continue; }
      if (ev.trap) T.th.push([+ev.trapHeat.toFixed(4), hand]); // sprung = trap with heat >= .5 (rules.sprungHeat)
      const sol = f > 0 && next.players[f].personality === 'sol';
      // Sol was holding a chip that finishes this tray (you took the trap he set for himself)
      const solHeld = sol && Scoop.completers(prev.trays[ev.tray]).some(v => prev.hands[f].includes(v)) ? 1 : 0;
      // [chips, points, trios the chip completes (2+ = double), Sol fed it last, hand, last chip of the hand, Sol held a completer]
      T.ms.push([chipsStr(ev.chips), ev.points, Scoop.triosWith(ev.chips, chip), sol ? 1 : 0, hand, ended ? 1 : 0, solHeld]);
      if (ended) T.lc++;
      for (let v = 1; v <= 8; v++) if (ev.chips.filter(c => c === v).length >= 3) { T.sets |= 1 << v; T.sk[v - 1]++; }
    } else if (ev.type === 'boil') { T.ab[hand]++; if (ev.pid === 0) T.hb[hand]++; }
  }
}
function stats(T, prev, next, action) {
  if (prev.turn === 0) {
    const oc = Scoop.moveOutcome(prev, action.chip, action.tray);
    if (oc.kind === 'feed') { T.fh.push(+(next.phase === 'play' && next.handNo === prev.handNo ? Scoop.trayHeat(next, 0, action.tray) : 0).toFixed(4)); T.fhh += prev.handNo; }
  }
  for (const ev of next.events) {
    if (ev.type === 'play') T.fed[ev.tray] = ev.pid;
    else if (ev.type === 'scoop' || ev.type === 'boil') T.fed[ev.tray] = -1;
    else if (ev.type === 'handEnd') T.fed = [-1, -1, -1];
  }
}
function book(T, st, vk, proxy) {
  const rk = Scoop.ranking(st), me = rk.find(r => r.pid === 0), p0 = st.players[0];
  return {
    v: vk, px: proxy, N: st.N, pl: me.place, sh: me.shared,
    pers: st.players.map(p => p.personality), pls: st.players.map((p, i) => rk.find(r => r.pid === i).place),
    sc: st.players.map(p => p.score), ns: st.players.map(p => p.scoops), bo: st.players.map(p => p.boils),
    hb: T.hb, ab: T.ab, sp: p0.sprung, th: T.th, d: p0.doubles, f6: p0.fullTrays, big: p0.biggest,
    ms: T.ms, gf: T.gf, fh: T.fh, fhh: T.fhh, lc: T.lc, sets: T.sets, sk: T.sk,
    hp: st.handSummaries.map(s => s.points), t2: st.handSummaries[1].totals,
    xp: Scoop.matchXP(st, 0, vk === 'daily' ? 'tea' : vk, {}).total, // no first-win bonus, no Pro view
  };
}

/* ------------------------------------------------------------------ the rules (as table.js judges them) */
const sum = a => a.reduce((x, y) => x + y, 0), max = a => Math.max(...a), min = a => Math.min(...a);
const first = r => r.pl === 1, won = r => r.pl === 1 && r.sh === 1;
const has = (s, ...vs) => vs.every(v => s[0].includes(String(v)));
const cnt = (s, v) => s[0].split('').filter(c => c === String(v)).length;
const solPlace = r => { const i = r.pers.indexOf('sol'); return i < 0 ? null : r.pls[i]; };
const sprung = (r, h = 0.5) => r.th.filter(x => x[0] >= h).length;
const perHand = (list, f) => [0, 1, 2].map(h => list.filter(x => f(x) === h).length);
const feedsIn = (r, h) => r.fh.filter((x, i) => +r.fhh[i] === h);
const solIdx = r => r.pers.indexOf('sol');
const BASE = {
  double: r => r.d > 0,
  spoiler: r => sum(r.hb) >= 3,
  trapper: r => sprung(r) >= 3,
  steam: r => r.hb.some(b => b >= 3),
  generous: r => r.gf.some(g => g[0] >= 6),
  turnabout: r => r.ms.some(s => s[3]),
  bookends: r => r.ms.some(s => has(s, 1, 2, 3)) && r.ms.some(s => has(s, 6, 7, 8)),
  sweep: r => r.hp.length === 3 && r.hp.every(p => p[0] > max(p.slice(1))),
  comeback: r => won(r) && r.t2[0] < min(r.t2.slice(1)),
  cool: r => first(r) && r.fh.length >= 3 && !r.fh.some(h => h >= 0.3),
  untouch: r => first(r) && r.N >= 3 && r.gf.length === 0,
  whitewash: r => first(r) && r.ns[0] > 0 && r.ns.slice(1).every(n => !n),
  headtable: r => first(r) && r.v === 'supper' && solPlace(r) > 1 && solPlace(r) === max(r.pls),
  photo: r => won(r) && r.sc.slice(1).some(s => s === r.sc[0]),
  nowaste: r => r.bo.every(b => !b),
  full: r => r.f6 > 0,
  lastchip: r => r.lc > 0,
  sevens: r => !!(r.sets & (1 << 7)),
  pressure: r => first(r) && r.v === 'glasshouse', // the proxy never lets the timer run out
};
const TIER = { double: 'silver', spoiler: 'bronze', trapper: 'silver', steam: 'bronze*', generous: 'bronze*', turnabout: 'silver*', bookends: 'silver',
  sweep: 'silver', comeback: 'gold', cool: 'silver', untouch: 'silver', whitewash: 'gold', headtable: 'gold', photo: 'silver*', nowaste: 'silver*',
  full: 'bronze', lastchip: 'bronze', sevens: 'bronze*', pressure: 'silver' };
const TARGET = { bronze: 0.10, silver: 0.025, gold: 0.007 };
// Variant rules: the smallest changes that keep each trophy's idea (rates measured on the same matches)
const VARIANTS = {
  // too rare
  spoiler2: r => sum(r.hb) >= 2,                                     // Spoiler: two boil-overs in a match
  steam2: r => r.hb.some(b => b >= 2),                               // Steam Room: two boil-overs in one hand
  generous5: r => r.gf.some(g => g[0] >= 5),
  cool50: r => first(r) && r.fh.length >= 3 && !r.fh.some(h => h >= 0.5),
  cool60: r => first(r) && r.fh.length >= 3 && !r.fh.some(h => h >= 0.6),
  cool70: r => first(r) && r.fh.length >= 3 && !r.fh.some(h => h >= 0.7),
  cool1: r => first(r) && r.fh.length >= 3 && r.fh.filter(h => h >= 0.3).length <= 1, // one hot feed allowed
  cool2: r => first(r) && r.fh.length >= 3 && r.fh.filter(h => h >= 0.3).length <= 2,
  cool3: r => first(r) && r.fh.length >= 3 && r.fh.filter(h => h >= 0.3).length <= 3,
  coolHand: r => first(r) && [0, 1, 2].some(h => { const f = feedsIn(r, h); return f.length >= 2 && !f.some(x => x >= 0.3); }), // win, with one whole hand of cool feeds (2+)
  coolHand3: r => first(r) && [0, 1, 2].some(h => { const f = feedsIn(r, h); return f.length >= 3 && !f.some(x => x >= 0.3); }),
  coolAvg: r => first(r) && r.fh.length >= 3 && sum(r.fh) / r.fh.length < 0.3,   // average heat of your feeds under 30%
  coolAvg25: r => first(r) && r.fh.length >= 3 && sum(r.fh) / r.fh.length < 0.25,
  untouch1: r => first(r) && r.N >= 3 && r.gf.length <= 1,           // one gift allowed
  untouch2: r => first(r) && r.N >= 3 && r.gf.length <= 2,
  untouchLast: r => first(r) && r.N >= 3 && !r.gf.some(g => g[1] === 2), // nobody scoops your feed in the final hand
  untouchHand: r => first(r) && r.N >= 3 && perHand(r.gf, g => g[1]).some(n => !n),
  whitewash1: r => first(r) && r.ns[0] > 0 && sum(r.ns.slice(1)) <= 1, // allow one rival scoop
  whitewash2: r => first(r) && r.ns[0] > 0 && sum(r.ns.slice(1)) <= 2,
  whitewashHand: r => first(r) && r.hp.some(p => p[0] > 0 && p.slice(1).every(x => !x)), // win, with a hand no rival scoops in
  whitewashLast: r => first(r) && r.hp[2][0] > 0 && r.hp[2].slice(1).every(x => !x),    // win, and no rival scoops in the final hand
  whitewashHand2: r => first(r) && r.hp.filter(p => p[0] > 0 && p.slice(1).every(x => !x)).length >= 2,
  // too easy (tightening)
  double2: r => r.ms.filter(s => s[2] >= 2).length >= 2,             // two Double Scoops in one match
  double3: r => r.ms.some(s => s[2] >= 3),                           // one chip finishing three trios
  doubleHand2: r => perHand(r.ms.filter(s => s[2] >= 2), s => s[4]).some(n => n >= 2),
  trapper4: r => sprung(r) >= 4, trapper5: r => sprung(r) >= 5,
  trapperHand2: r => perHand(r.th.filter(x => x[0] >= 0.5), x => x[1]).some(n => n >= 2),
  trapperHand3: r => perHand(r.th.filter(x => x[0] >= 0.5), x => x[1]).some(n => n >= 3),
  turnabout2: r => r.ms.filter(s => s[3]).length >= 2,
  turnaboutHeld: r => r.ms.some(s => s[6]),                          // Sol fed it last and was holding the chip to finish it
  turnaboutBig: r => r.ms.some(s => s[3] && s[1] >= 5),
  bookendsHand: r => [0, 1, 2].some(h => r.ms.some(s => s[4] === h && has(s, 1, 2, 3)) && r.ms.some(s => s[4] === h && has(s, 6, 7, 8))),
  bookendsSets: r => r.ms.some(s => cnt(s, 1) >= 3) && r.ms.some(s => cnt(s, 8) >= 3),     // 1·1·1 and 8·8·8 in one match
  bookendsLo: r => r.ms.some(s => has(s, 1, 2, 3)), bookendsHi: r => r.ms.some(s => has(s, 6, 7, 8)),
  sweep3: r => r.N >= 3 && BASE.sweep(r),                            // Clean Sweep at a table of three or four
  comeback3: r => r.N >= 3 && BASE.comeback(r),                      // Comeback at a table of three or four
  comebackDef5: r => BASE.comeback(r) && max(r.t2.slice(1)) - r.t2[0] >= 5,
  comebackDef8: r => BASE.comeback(r) && max(r.t2.slice(1)) - r.t2[0] >= 8,
  headtableSole: r => BASE.headtable(r) && r.pls.filter(x => x === solPlace(r)).length === 1, // Sol alone in last place
  headtableEvery: r => first(r) && r.v === 'supper' && r.hp.every(p => p[solIdx(r)] <= min(p)), // Sol scored the least in every hand
  headtableBlank: r => BASE.headtable(r) && r.hp[2][solIdx(r)] === 0, // and Sol scooped nothing in the final hand
  headtableBehind: r => first(r) && r.v === 'supper' && solPlace(r) > 1,
  nowaste3: r => r.N >= 3 && BASE.nowaste(r), nowaste4: r => r.N >= 4 && BASE.nowaste(r),
  photoShared: r => first(r) && r.sc.slice(1).some(s => s === r.sc[0]),
  double3m: r => r.ms.filter(s => s[2] >= 2).length >= 3, double4m: r => r.ms.filter(s => s[2] >= 2).length >= 4,
  turnabout3: r => r.ms.filter(s => s[3]).length >= 3,
  turnaboutSix: r => r.ms.some(s => s[3] && s[1] >= 6),
  turnaboutHeld2: r => r.ms.filter(s => s[6]).length >= 2,
  turnaboutHeldSix: r => r.ms.some(s => s[6] && s[1] >= 6),
  bookendsPure: r => r.ms.some(s => s[0] === '123') && r.ms.some(s => s[0] === '678'), // trays of exactly 1·2·3 and 6·7·8
  bookendsRow: r => r.ms.some((s, i) => i > 0 && ((has(s, 1, 2, 3) && has(r.ms[i - 1], 6, 7, 8)) || (has(s, 6, 7, 8) && has(r.ms[i - 1], 1, 2, 3)))), // back to back
  sets5: r => r.sk.filter(x => x > 0).length >= 5, sets6: r => r.sk.filter(x => x > 0).length >= 6,
  turnaboutHeld3: r => r.ms.filter(s => s[6]).length >= 3,
  turnaboutHeldLast: r => r.ms.some(s => s[6] && s[5]),              // stole Sol's trap with the last chip of a hand
  headtable10: r => BASE.headtable(r) && r.sc[0] - r.sc[solIdx(r)] >= 10, // Sol last and 10+ points behind you
  headtable15: r => BASE.headtable(r) && r.sc[0] - r.sc[solIdx(r)] >= 15,
  whitewashLastAny: r => first(r) && r.hp[2].slice(1).every(x => !x),  // final hand: no rival scoops (you need not)
};

/* ------------------------------------------------------------------ check: run table.js's own hooks side by side */
function extractFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('no ' + name + ' in table.js');
  let j = src.indexOf('{', i), d = 0, k = j;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) break; }
  return src.slice(i, k + 1);
}
function tableHooks() {
  const src = fs.readFileSync(TABLE, 'utf8');
  const fns = ['txTrCall', 'txTrNow', 'txTrScan', 'txTrFire', 'txTrBook', 'txStats'].map(n => extractFn(src, n)).join('\n');
  const factory = new Function('Scoop', `
    const M = { mode: 'venue', vk: 'cafe', tx: null, timeLeft: 20, flags: {} };
    const out = { ids: [], sets: 0, beat: [] };
    const txLive = () => M.mode !== 'tutorial', txMode = () => M.mode === 'daily' ? 'daily' : M.vk;
    const save = () => {}, bumpStats = (m, f) => f({ stageFeeds: [0,0,0,0], stageHeat: [0,0,0,0] });
    const trEarn = id => { out.ids.push(id); return true; }, trNoteSet = v => { out.sets |= 1 << v; }, trNoteBeat = p => out.beat.push(p);
    ${fns}
    return {
      start(vk, daily, st) {
        M.mode = daily ? 'daily' : 'venue'; M.vk = vk; M.flags = {}; out.ids = []; out.sets = 0; out.beat = [];
        M.tx = { fed: [-1,-1,-1], bag0: { [st.handNo]: st.bag.length }, due: [], tr: {}, boils: 0, handBoils: 0, sprung: 0, lo: false, hi: false,
                 gifted: 0, feeds: 0, hotFeeds: 0, outs: 0, autoPly: -1, tea: 0 };
      },
      move(prev, next, action) {
        txTrScan(prev, next); txStats(prev, next, action);
        if (next.phase === 'over') { const rk = Scoop.ranking(next), me = rk.find(r => r.pid === 0); txTrBook(next, rk, me, me.place === 1 && me.shared === 1, false); }
        else txTrFire();
      },
      out,
    };`);
  return factory(Scoop);
}
function runCheck(n) {
  const H = tableHooks(), r = Scoop.makeRng(12345);
  // sevens and full are state trophies (trNoteSet sets / S.stats.fullTrays), compared via sets and the engine's own counter
  const RULES = Object.keys(BASE).filter(k => k !== 'sevens' && k !== 'full');
  let bad = 0, total = 0;
  const seen = {};
  for (const vk of VENUE_KEYS) for (const px of ['sensible', 'rollout']) {
    const m = vk === 'supper' || vk === 'glasshouse' ? Math.ceil(n / 4) : n;
    for (let i = 0; i < m; i++) {
      const seed = (r() * 4294967296) >>> 0, riv = lineup(vk, r, i);
      // the table hooks need the first state: rebuild it the same way playMatch does
      const venue = vk === 'daily' ? 'tea' : vk;
      const st0 = Scoop.newMatch({ players: [{ name: 'You', human: true }, ...riv.map(k => ({ name: k, personality: k }))], seed, venue, record: false });
      H.start(venue, vk === 'daily', st0);
      const rec = playMatch(vk, px, seed, riv, (prev, next, a) => H.move(prev, next, a));
      const mine = RULES.filter(k => BASE[k](rec)).sort();
      const theirs = [...new Set(H.out.ids.filter(id => RULES.includes(id)))].sort();
      total++;
      mine.forEach(k => { seen[k] = (seen[k] || 0) + 1; });
      if (mine.join() !== theirs.join() || H.out.sets !== rec.sets || rec.sp !== sprung(rec)) {
        bad++; if (bad <= 5) console.log('MISMATCH', vk, px, seed, 'sim:', mine.join(), 'table:', theirs.join(), 'sets', rec.sets, H.out.sets, 'sprung', rec.sp, sprung(rec));
      }
    }
  }
  console.log(`check: ${total} matches, ${bad} mismatches between sim.js rules and table.js hooks; trophies exercised:`, JSON.stringify(seen));
  return bad === 0;
}

/* ------------------------------------------------------------------ workers */
if (!isMainThread) {
  parentPort.on('message', job => {
    if (!job) { process.exit(0); }
    const r = Scoop.makeRng(Scoop.hash32(job.seed, VENUE_KEYS.indexOf(job.vk), job.pxi, job.chunk, 0x51));
    const recs = [];
    for (let i = 0; i < job.n; i++) {
      const seed = (r() * 4294967296) >>> 0;
      recs.push(playMatch(job.vk, job.px, seed, lineup(job.vk, r, job.chunk * job.size + i)));
    }
    parentPort.postMessage({ id: job.id, recs });
  });
  return;
}

/* ------------------------------------------------------------------ main */
const args = process.argv.slice(2), opt = k => { const i = args.indexOf('--' + k); return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

async function simulate() {
  const proxies = (opt('proxies') || 'sensible,june,rollout,boiler,careful,setter').split(',');
  const scale = +(opt('scale') || (opt('quick') ? 0.02 : 1));
  const nOver = {}; if (opt('n')) String(opt('n')).split(',').forEach(kv => { const [k, v] = kv.split('='); nOver[k] = +v; });
  const seed = +(opt('seed') || 20261016), W = +(opt('workers') || require('os').cpus().length);
  const SIZE = 250, jobs = [];
  proxies.forEach((px, pxi) => VENUE_KEYS.forEach(vk => {
    let n = Math.round((nOver[vk] || N_MAIN[vk]) * scale * (pxi === 0 ? 1 : AIM[px] ? AIM_SHARE : SECOND_SHARE));
    for (let c = 0; n > 0; c++, n -= SIZE) jobs.push({ id: jobs.length, vk, px, pxi, chunk: c, size: SIZE, n: Math.min(SIZE, n), seed });
  }));
  // slow venues first so the pool drains evenly
  const cost = j => (j.vk === 'glasshouse' ? 200 : j.vk === 'supper' ? 100 : 2) * j.n;
  const queue = jobs.slice().sort((a, b) => cost(b) - cost(a));
  const recs = [], t0 = Date.now(), totalCost = sum(jobs.map(cost));
  let doneCost = 0, lastLog = 0;
  await new Promise((resolve, reject) => {
    let live = 0;
    for (let w = 0; w < Math.min(W, queue.length); w++) {
      const wk = new Worker(__filename, { argv: [] }); live++;
      const feed = () => { const j = queue.shift(); if (j) { wk.cur = j; wk.postMessage(j); } else { wk.postMessage(null); } };
      wk.on('message', m => {
        for (const x of m.recs) recs.push(x);
        doneCost += cost(wk.cur);
        if (Date.now() - lastLog > 30000) { lastLog = Date.now(); console.log(`  ${(100 * doneCost / totalCost).toFixed(1)}% after ${((Date.now() - t0) / 1000).toFixed(0)}s, ${recs.length} matches`); }
        feed();
      });
      wk.on('error', reject);
      wk.on('exit', () => { if (--live === 0) resolve(); });
      feed();
    }
  });
  console.log(`simulated ${recs.length} matches in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  const gz = zlib.gzipSync(recs.map(x => JSON.stringify(x)).join('\n'));
  fs.writeFileSync(path.join(OUT, opt('quick') ? 'records-quick.ndjson.gz' : 'records.ndjson.gz'), gz);
  return recs;
}
function loadRecords(file) {
  return zlib.gunzipSync(fs.readFileSync(file)).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}

/* ------------------------------------------------------------------ aggregation */
function quantile(a, q) { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
// matches until a cumulative goal is met, by resampling whole matches (they are independent)
function matchesUntil(group, done, r, reps = 4000, cap = 20000) {
  const out = [];
  for (let k = 0; k < reps; k++) {
    let acc = 0, n = 0;
    while (!done(acc) && n < cap) { acc = acc | group[Math.floor(r() * group.length)]; n++; }
    out.push(n);
  }
  return { median: quantile(out, 0.5), p90: quantile(out, 0.9), mean: sum(out) / out.length };
}
function untilCounts(group, k, r, reps = 2000, cap = 20000) {
  const out = [];
  for (let q = 0; q < reps; q++) {
    const c = new Int32Array(8); let n = 0;
    while (n < cap) { const x = group[Math.floor(r() * group.length)]; for (let v = 0; v < 8; v++) c[v] += x[v]; n++; if (c.every(y => y >= k)) break; }
    out.push(n);
  }
  return { median: quantile(out, 0.5), p90: quantile(out, 0.9), mean: sum(out) / out.length };
}
// days of one Daily a day until a goal: 'wins' = total wins, 'row' = wins in a row
function dailyDays(p, goal, kind, r, reps = 20000) {
  const out = [];
  for (let q = 0; q < reps; q++) { let d = 0, w = 0; while (w < goal && d < 1e6) { d++; if (r() < p) w++; else if (kind === 'row') w = 0; } out.push(d); }
  return { median: quantile(out, 0.5), p90: quantile(out, 0.9), mean: sum(out) / out.length };
}
const rowMean = (p, k) => (1 - p ** k) / ((1 - p) * p ** k); // expected days to k wins in a row
function aggregate(recs) {
  const groups = {};
  recs.forEach(x => { (groups[x.px + '|' + x.v] || (groups[x.px + '|' + x.v] = [])).push(x); });
  const r = Scoop.makeRng(99), table = [];
  for (const key of Object.keys(groups)) {
    const g = groups[key], [px, v] = key.split('|'), n = g.length;
    const rate = f => g.filter(f).length / n;
    const rates = {}, variants = {};
    for (const k in BASE) rates[k] = rate(BASE[k]);
    for (const k in VARIANTS) variants[k] = rate(VARIANTS[k]);
    const everyNum = matchesUntil(g.map(x => x.sets & 0x1FE), a => a === 0x1FE, r);
    // tighter Every Number: k sets of every number (cumulative)
    const everyNumK = {};
    for (const k of [2, 3, 5, 10]) everyNumK[k] = untilCounts(g.map(x => x.sk), k, r);
    // Bookends across matches (any matches, both runs): bit 1 = a 1·2·3, bit 2 = a 6·7·8
    const bkAcross = matchesUntil(g.map(x => (VARIANTS.bookendsLo(x) ? 1 : 0) | (VARIANTS.bookendsHi(x) ? 2 : 0)), a => a === 3, r);
    const vn = Scoop.VENUES[v === 'daily' ? 'tea' : v];
    const prize = x => { let pool = 0; for (let q = x.pl - 1; q < x.pl - 1 + x.sh; q++) pool += vn.prizes[q] || 0; return Math.floor(pool / x.sh); };
    const netSparks = v === 'daily' ? null : sum(g.map(prize)) / n - vn.entry;
    table.push({
      venue: v, proxy: px, matches: n, netSparks,
      winRate: rate(first), soleWinRate: rate(won),
      avgScoops: sum(g.map(x => x.ns[0])) / n, avgXP: sum(g.map(x => x.xp)) / n, avgScore: sum(g.map(x => x.sc[0])) / n,
      avgBoils: sum(g.map(x => x.bo[0])) / n, avgSprung: sum(g.map(x => x.sp)) / n, avgFeeds: sum(g.map(x => x.fh.length)) / n,
      setRates: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map(s => [s, rate(x => x.sets & (1 << s))])),
      rates, variants, everyNum, everyNumK, bookendsAcross: bkAcross,
    });
  }
  return table;
}
const XP_TO_40 = (() => { let s = 0; for (let L = 1; L < 40; L++) s += Scoop.xpToNext(L); return s; })();
function judge(table, main) {
  const rows = table.filter(t => t.proxy === main);
  const best = k => rows.reduce((b, t) => (t.rates[k] > (b ? b.rates[k] : -1) ? t : b), null);
  const bestV = k => rows.reduce((b, t) => (t.variants[k] > (b ? b.variants[k] : -1) ? t : b), null);
  const verdict = {};
  for (const k in TIER) {
    const tierName = TIER[k].replace('*', ''), secret = TIER[k].endsWith('*'), b = best(k);
    const target = TARGET[tierName] * (secret ? 0.5 : 1);
    // too easy: as likely as the tier below should be (silver >= 10%, gold >= 2.5%)
    const easy = tierName === 'silver' ? 0.10 : tierName === 'gold' ? 0.025 : Infinity;
    verdict[k] = { tier: TIER[k], bestVenue: b.venue, rate: b.rates[k], target, ok: b.rates[k] >= target, tooEasy: b.rates[k] >= easy };
  }
  const vbest = {}; for (const k in VARIANTS) { const b = bestV(k); vbest[k] = { venue: b.venue, rate: b.variants[k] }; }
  // counted golds
  const byV = Object.fromEntries(rows.map(t => [t.venue, t]));
  const daily = byV.daily;
  const venues = rows.filter(t => t.venue !== 'daily');
  const hc = venues.map(t => ({ venue: t.venue, matches: 1000 / t.avgScoops })).sort((a, b) => a.matches - b.matches);
  const mp = venues.map(t => ({ venue: t.venue, matches: XP_TO_40 / t.avgXP })).sort((a, b) => a.matches - b.matches);
  // a realistic climb: always play the highest venue unlocked (levels 1/3/6/10/15), Sparks ignored; one Daily a day alongside
  const UNL = [['cafe', 1], ['noodle', 3], ['tea', 6], ['supper', 10], ['glasshouse', 15]];
  let xp = 0, scoops = 0, m = 0, mScoops = null;
  while (xp < XP_TO_40 || scoops < 1000) {
    const L = Scoop.levelFromXP(xp).level, v = UNL.filter(u => L >= u[1]).pop()[0];
    xp += byV[v].avgXP; scoops += byV[v].avgScoops; m++;
    if (scoops >= 1000 && mScoops == null) mScoops = m;
    if (m > 1e5) break;
  }
  const climbMP = (() => { let x = 0, k = 0; while (x < XP_TO_40) { const L = Scoop.levelFromXP(x).level; x += byV[UNL.filter(u => L >= u[1]).pop()[0]].avgXP; k++; } return k; })();
  // Hot Streak: expected days to 5 Daily wins in a row at the Daily win rate p: (1 - p^5) / ((1 - p) p^5)
  const p = daily.winRate, rr = Scoop.makeRng(7);
  const dailyRegular = dailyDays(p, 30, 'wins', rr), hotStreak = dailyDays(p, 5, 'row', rr), streak3 = dailyDays(p, 3, 'row', rr);
  const ironMeanDays = rowMean(p, 14);
  // Platinum: the Daily streak goals force one Daily a day for D days (D = median days to Hot Streak, at least Daily Regular);
  // those Dailies also give XP and scoops; venue matches (highest venue unlocked) cover the rest of level 40 and 1,000 scoops.
  const plat = (days) => {
    let x = days * daily.avgXP, sc = days * daily.avgScoops, k = 0;
    while ((x < XP_TO_40 || sc < 1000) && k < 1e5) { const L = Scoop.levelFromXP(x).level, vv = byV[UNL.filter(u => L >= u[1]).pop()[0]]; x += vv.avgXP; sc += vv.avgScoops; k++; }
    return { dailyMatches: days, venueMatches: k, matches: days + k, hours: (days + k) * 4 / 60 };
  };
  const platinum = { playOnly: { matches: Math.max(climbMP, mScoops), hours: Math.max(climbMP, mScoops) * 4 / 60 },
    typical: plat(Math.max(hotStreak.median, dailyRegular.median)), unlucky: plat(Math.max(hotStreak.p90, dailyRegular.p90)),
    with3Row: plat(Math.max(streak3.median, dailyRegular.median)) };
  return { verdict, vbest, hc, mp, climb: { masterMatches: climbMP, headChefMatches: mScoops }, dailyWinRate: p,
    dailyRegularDays: 30 / p, dailyRegular, hotStreak, hotStreakMeanDays: rowMean(p, 5), streak3, ironMeanDays, xpTo40: XP_TO_40, platinum };
}

function fmtTable(table, main) {
  const keys = Object.keys(BASE);
  const lines = [];
  for (const px of [...new Set(table.map(t => t.proxy))]) {
    lines.push(`\n== proxy ${px}${px === main ? ' (main)' : ''}`);
    lines.push(['venue', 'n', 'win', 'scoops', 'xp', ...keys].join('\t'));
    table.filter(t => t.proxy === px).sort((a, b) => VENUE_KEYS.indexOf(a.venue) - VENUE_KEYS.indexOf(b.venue)).forEach(t => {
      lines.push([t.venue, t.matches, t.winRate.toFixed(4), t.avgScoops.toFixed(2), t.avgXP.toFixed(1), ...keys.map(k => t.rates[k].toFixed(4))].join('\t'));
    });
    lines.push('variants:');
    lines.push(['venue', ...Object.keys(VARIANTS)].join('\t'));
    table.filter(t => t.proxy === px).sort((a, b) => VENUE_KEYS.indexOf(a.venue) - VENUE_KEYS.indexOf(b.venue)).forEach(t => {
      lines.push([t.venue, ...Object.keys(VARIANTS).map(k => t.variants[k].toFixed(4))].join('\t'));
    });
    lines.push('every number (median / p90 matches), bookends across matches (median / p90):');
    table.filter(t => t.proxy === px).forEach(t => lines.push(`  ${t.venue}: ${t.everyNum.median} / ${t.everyNum.p90}   k-of-each ${Object.entries(t.everyNumK).map(([k, x]) => k + ':' + x.median + '/' + x.p90).join(' ')}   bookends ${t.bookendsAcross.median} / ${t.bookendsAcross.p90}   sets ${Object.values(t.setRates).map(x => x.toFixed(4)).join(' ')}`));
  }
  return lines.join('\n');
}

(async () => {
  if (opt('check')) { const ok = runCheck(+opt('check') || 100); process.exit(ok ? 0 : 1); }
  const recs = opt('from') ? loadRecords(opt('from')) : await simulate();
  const main = (opt('proxies') || 'sensible').split(',')[0];
  const table = aggregate(recs), j = judge(table, main);
  const res = { generated: new Date().toISOString(), main, table, judge: j };
  fs.writeFileSync(path.join(OUT, opt('quick') ? 'results-quick.json' : 'results.json'), JSON.stringify(res, null, 1));
  console.log(fmtTable(table, main));
  console.log('\nverdicts (best venue, main proxy):');
  for (const k in j.verdict) { const x = j.verdict[k]; console.log(`  ${k.padEnd(10)} ${x.tier.padEnd(8)} ${x.bestVenue.padEnd(11)} ${x.rate.toFixed(4)} target ${x.target} ${x.ok ? (x.tooEasy ? 'EASY' : 'ok') : 'LOW'}`); }
  console.log('variants best venue:', JSON.stringify(j.vbest));
  console.log('head chef', JSON.stringify(j.hc), '\nmaster', JSON.stringify(j.mp), '\nclimb', JSON.stringify(j.climb), '\ndaily win', j.dailyWinRate.toFixed(4), 'regular', JSON.stringify(j.dailyRegular), 'hot streak', JSON.stringify(j.hotStreak), 'mean', j.hotStreakMeanDays.toFixed(1), '3-row', JSON.stringify(j.streak3), 'iron mean days', j.ironMeanDays.toFixed(0), 'xp to 40', j.xpTo40, '\nplatinum', JSON.stringify(j.platinum));
})();
