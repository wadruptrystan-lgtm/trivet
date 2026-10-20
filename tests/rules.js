// Checks the tuned trophy rules by feeding synthetic engine events into the table's judging code.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'); const OUT = process.argv[3];
setTimeout(() => { fs.writeFileSync(OUT, 'WATCHDOG'); process.exit(2); }, 60000);
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + (process.argv[2] || require('path').join(__dirname, '../dist/test.html'))); await p.waitForTimeout(1200);
  const r = await p.evaluate(() => {
    const out = {}, log = [];
    const real = trEarn; window.trEarn = id => { log.push(id); return real(id); };
    const fresh = (N, vk) => {
      const pers = ['sol', 'rico', 'mabel', 'otto'].slice(0, N - 1);
      M.st = Scoop.newMatch({ players: [{ name: 'You', human: true }, ...pers.map(k => ({ name: P[k].name, personality: k }))], venue: vk || 'supper', record: false });
      M.mode = 'venue'; M.vk = vk || 'supper'; txReset(); log.length = 0; return M.tx;
    };
    const st = () => M.st;
    const scoop = (pid, chips, o = {}) => ({ type: 'scoop', pid, tray: o.tray || 0, chips, points: chips.length, double: !!o.double, sprung: !!o.sprung });
    const run = (events, o = {}) => {
      const prev = { ...st(), trays: o.trays || [[], [], []], hands: o.hands || st().hands, rules: st().rules, ply: 1, handNo: o.hand || 0 };
      const next = { ...st(), events };
      if (o.fed) M.tx.fed = o.fed.slice();
      txTrScan(prev, next); txTrFire();
    };
    // Double Scoop: the third double in a match, not the first
    fresh(4); run([scoop(0, [5, 5, 5, 6, 7], { double: true })]); run([scoop(0, [5, 5, 5, 6, 7], { double: true })]);
    out.double2 = log.includes('double');
    run([scoop(0, [5, 5, 5, 6, 7], { double: true })]); out.double3 = log.includes('double');
    // Trapper: the fourth sprung scoop
    fresh(4); for (let i = 0; i < 3; i++) run([scoop(0, [2, 3, 4], { sprung: true })]); out.trap3 = log.includes('trapper');
    run([scoop(0, [2, 3, 4], { sprung: true })]); out.trap4 = log.includes('trapper');
    // Bookends: 1·1·1 and 8·8·8; runs no longer count
    fresh(4); run([scoop(0, [1, 2, 3])]); run([scoop(0, [6, 7, 8])]); out.bookRuns = log.includes('bookends');
    run([scoop(0, [1, 1, 1])]); run([scoop(0, [8, 8, 8])]); out.bookSets = log.includes('bookends');
    // Steam Room: two of your boil-overs in one hand
    fresh(4); run([{ type: 'boil', pid: 0, tray: 0, chips: [1, 2, 4, 6, 8, 8] }]); out.steam1 = log.includes('steam');
    run([{ type: 'boil', pid: 0, tray: 1, chips: [1, 2, 4, 6, 8, 8] }]); out.steam2 = log.includes('steam');
    // Turnabout: twice, a tray Sol fed last while he held its finishing chip (Sol is seat 1)
    fresh(4); const hands = [[4], [7, 2, 2], [1], [1]];
    run([{ type: 'play', pid: 0, tray: 0, chip: 4 }, scoop(0, [4, 4, 4], { tray: 0 })], { fed: [1, -1, -1], trays: [[4, 4], [], []], hands: [[4], [7, 7, 7], [1], [1]] });
    out.turnNoTrap = M.tx.steals;
    run([{ type: 'play', pid: 0, tray: 0, chip: 4 }, scoop(0, [4, 5, 6], { tray: 0 })], { fed: [1, -1, -1], trays: [[5, 6], [], []], hands });
    out.turn1 = log.includes('turnabout');
    run([{ type: 'play', pid: 0, tray: 0, chip: 4 }, scoop(0, [4, 5, 6], { tray: 0 })], { fed: [1, -1, -1], trays: [[5, 6], [], []], hands });
    out.turn2 = log.includes('turnabout');
    // Booking rules, with synthetic standings
    const book = (o) => {
      const s = M.st, N = o.N;
      const players = s.players.map((pl, i) => ({ ...pl, score: o.scores[i], scoops: o.scoops ? o.scoops[i] : 1, boils: o.boils ? o.boils[i] : 1 }));
      const sts = { ...s, N, players, rules: s.rules, handSummaries: o.hs };
      const rk = players.map((pl, i) => ({ pid: i, score: pl.score, place: o.places[i], shared: 1 }));
      log.length = 0; txTrBook(sts, rk, rk[0], o.places[0] === 1, false); return log.slice();
    };
    const hs = pts => pts.map((p, i) => ({ points: p, totals: p }));
    // Cool Customer: one hand with 3+ feeds and none hot
    fresh(4); M.tx.hf = { 0: [5, 2], 1: [3, 0] };
    out.cool = book({ N: 4, scores: [20, 10, 5, 3], places: [1, 2, 3, 4], hs: hs([[5, 1, 1, 1], [5, 1, 1, 1], [5, 1, 1, 1]]) }).includes('cool');
    fresh(4); M.tx.hf = { 0: [5, 2], 1: [2, 0], 2: [4, 1] };
    out.coolNo = book({ N: 4, scores: [20, 10, 5, 3], places: [1, 2, 3, 4], hs: hs([[5, 1, 1, 1], [5, 1, 1, 1], [5, 1, 1, 1]]) }).includes('cool');
    // Untouchable: no gift in the final hand at 3-4 seats
    fresh(3); M.tx.giftsBy = { 0: 2, 1: 1 };
    out.untouch = book({ N: 3, scores: [20, 10, 5], places: [1, 2, 3], hs: hs([[5, 1, 1], [5, 1, 1], [5, 1, 1]]) }).includes('untouch');
    fresh(3); M.tx.giftsBy = { 2: 1 };
    out.untouchNo = book({ N: 3, scores: [20, 10, 5], places: [1, 2, 3], hs: hs([[5, 1, 1], [5, 1, 1], [5, 1, 1]]) }).includes('untouch');
    // Whitewash: rivals score nothing in the final hand
    fresh(4); out.white = book({ N: 4, scores: [20, 10, 5, 3], places: [1, 2, 3, 4], hs: hs([[5, 3, 1, 1], [5, 2, 1, 1], [9, 0, 0, 0]]) }).includes('whitewash');
    fresh(4); out.whiteNo = book({ N: 4, scores: [20, 10, 5, 3], places: [1, 2, 3, 4], hs: hs([[5, 3, 1, 1], [5, 2, 1, 1], [9, 0, 3, 0]]) }).includes('whitewash');
    // Head of the Table: Sol (seat 1) last and scoreless in the final hand
    fresh(4); out.head = book({ N: 4, scores: [20, 2, 5, 3], places: [1, 4, 2, 3], hs: hs([[5, 1, 1, 1], [5, 1, 1, 1], [9, 0, 3, 1]]) }).includes('headtable');
    fresh(4); out.headNo = book({ N: 4, scores: [20, 2, 5, 3], places: [1, 4, 2, 3], hs: hs([[5, 1, 1, 1], [5, 0, 1, 1], [9, 1, 3, 1]]) }).includes('headtable');
    // Nothing Wasted: four seats only
    fresh(4); out.waste4 = book({ N: 4, scores: [20, 10, 5, 3], places: [1, 2, 3, 4], boils: [0, 0, 0, 0], hs: hs([[5, 1, 1, 1], [5, 1, 1, 1], [5, 1, 1, 1]]) }).includes('nowaste');
    fresh(3); out.waste3 = book({ N: 3, scores: [20, 10, 5], places: [1, 2, 3], boils: [0, 0, 0], hs: hs([[5, 1, 1], [5, 1, 1], [5, 1, 1]]) }).includes('nowaste');
    // Clean Sweep and Comeback: three or four seats
    fresh(2); out.sweep2 = book({ N: 2, scores: [20, 10], places: [1, 2], hs: hs([[5, 1], [5, 1], [5, 1]]) }).includes('sweep');
    fresh(3); out.sweep3 = book({ N: 3, scores: [20, 10, 5], places: [1, 2, 3], hs: hs([[5, 1, 1], [5, 1, 1], [5, 1, 1]]) }).includes('sweep');
    fresh(2); out.come2 = book({ N: 2, scores: [20, 10], places: [1, 2], hs: [{ points: [1, 5], totals: [1, 5] }, { points: [1, 5], totals: [2, 10] }, { points: [18, 0], totals: [20, 10] }] }).includes('comeback');
    fresh(3); out.come3 = book({ N: 3, scores: [20, 10, 5], places: [1, 2, 3], hs: [{ points: [1, 5, 5], totals: [1, 5, 5] }, { points: [1, 5, 5], totals: [2, 10, 10] }, { points: [18, 0, 0], totals: [20, 10, 10] }] }).includes('comeback');
    // Every Number: five of each; Hot Streak at 3; Iron Streak via runWins
    log.length = 0;
    for (let v = 1; v <= 8; v++) for (let k = 0; k < (v === 8 ? 4 : 5); k++) trNoteSet(v);
    save(); out.every39 = !!S.ach.everynum; out.everyProg = trOf('everynum').prog();
    trNoteSet(8); save(); out.every40 = !!S.ach.everynum; out.sevens = !!S.ach.sevens;
    S.daily.streak = 2; save(); out.hot2 = !!S.ach.hotstreak; S.daily.streak = 3; save(); out.hot3 = !!S.ach.hotstreak;
    S.daily.runWins = 14; save(); out.iron = !!S.ach.iron;
    out.descs = ['double', 'cool', 'turnabout', 'iron', 'everynum', 'dailyreg'].map(id => trOf(id).desc);
    out.src = trItemSource('emote', 'foundit');
    return out;
  });
  // Iron Streak run: a missed day resets it, a consecutive day keeps it
  const iron = await p.evaluate(async () => {
    const d = new Date(), y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1), y2 = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 2);
    S.daily.runWins = 5; S.daily.lastDay = dayKey(y); startMatch('tea', { daily: true }); const kept = S.daily.runWins; abandon();
    S.daily.runWins = 5; S.daily.lastDay = dayKey(y2); startMatch('tea', { daily: true }); const reset = S.daily.runWins; abandon();
    return { kept, reset };
  });
  fs.writeFileSync(OUT, JSON.stringify({ r, iron, errs }, null, 1)); await b.close(); process.exit(0);
})();
