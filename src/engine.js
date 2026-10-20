/*
 * Scoop — rules engine + AI for "trivet".
 * Plain ES2015 JavaScript. No dependencies, no Node APIs: drop it into a <script> tag
 * (it defines a global `Scoop`) or require() it from Node.
 *
 * ---------------------------------------------------------------------------------
 * STATE      A plain JSON-serialisable object made by newMatch(). Hidden information
 *            (every player's hand) lives in state.hands[pid]; the UI must only ever
 *            render state.hands[humanPid] and use handSizes for everyone else.
 * MUTATION   applyAction(state, action) returns a NEW state and never touches its input.
 *            applyAction(state, action, {inPlace:true}) mutates and returns the same
 *            object (simulations use this for speed). Every other function is pure.
 * RANDOMNESS state.rng (uint32, mulberry32) is advanced only by the engine's own shuffles
 *            (seat order, starting player, bag). AI noise, AI memory and WIN% rollouts are
 *            seeded from hash(state.seed, state.ply, pid, …) unless an rng function is
 *            passed in, so the same state + same personality always gives the same move.
 * ---------------------------------------------------------------------------------
 * Trays between turns never hold a trio, so no tray ever has 3 copies of a number.
 * Internally (AI, rollouts) a tray is therefore just two bitmasks:
 *   P = numbers present at least once, D = numbers present twice.   (bit v = number v)
 */
var Scoop = (function () {
  'use strict';

  // ------------------------------------------------------------------ rules / tables
  var DEFAULT_RULES = {
    values: 8,          // chips are numbered 1..values
    copiesSmall: 5,     // copies of each number at 2-3 players (40 chips)
    copiesLarge: 6,     // copies of each number at 4 players (48 chips)
    largeFrom: 4,       // player count from which copiesLarge is used
    copies: 0,          // >0 forces a copy count (variants)
    trays: 3,
    cap: 6,             // a tray reaching this many chips without a trio boils over
    handSize: 3,
    hands: 3,           // hands per match
    seedCount: 2,       // chips seeded into each tray at hand start (0, 1 or 2)
    refillCount: 2,     // chips seeded into an emptied tray (0, 1 or 2)
    seedGap: 3,         // the 2nd seed chip must differ from the 1st by at least this
    seatShuffle: true,  // re-randomise turn order before every hand
    starter: 'trailing', // hands 2+: 'trailing' (lowest total) | 'random' | 'leader' | 'rotate'
    sprungHeat: 0.5,    // [CHANGED vs spec: 0] Sprung needs the fed tray's heat (feeder's view) >= this right after the feed
    finalHandTiebreak: true // [ADDED vs spec] 3rd tiebreak before sharing a place: more points in the final hand
  };

  // Venue sharpness (tau = Gumbel noise, eps = random-move chance, memory = recall of gone chips)
  var VENUES = {
    cafe:       { key: 'cafe', name: 'Corner Café', seats: 2, unlock: 1, tau: 1.4, eps: 0.15, memory: 0.4,
                  entry: 100, prizes: [200], xpMult: 1.0, rivals: ['rico', 'priya'], aids: 'full', reward: 'Café Enamel' },
    noodle:     { key: 'noodle', name: 'Noodle Bar', seats: 3, unlock: 3, tau: 0.9, eps: 0.07, memory: 0.6,
                  entry: 300, prizes: [600, 300], xpMult: 1.25, rivals: ['priya', 'mabel', 'otto'], aids: 'full-longpress', reward: 'Lacquer' },
    tea:        { key: 'tea', name: 'The Tea House', seats: 2, unlock: 6, tau: 0.5, eps: 0.03, memory: 0.8,
                  entry: 1000, prizes: [2000], xpMult: 1.5, rivals: ['mabel', 'otto', 'june'], aids: 'colour', reward: 'Celadon' },
    // [CHANGED vs spec 0.25 / 0.01 / 0.95] so a good player breaks even here (sim: 1st 23%, EV ~0)
    supper:     { key: 'supper', name: 'Supper Club', seats: 4, unlock: 10, tau: 0.4, eps: 0.02, memory: 0.9,
                  entry: 4000, prizes: [10000, 5000, 1000], xpMult: 2.0, rivals: ['mabel', 'otto', 'june', 'sol'], aids: 'colour', reward: 'Copper' },
    glasshouse: { key: 'glasshouse', name: 'The Glasshouse', seats: 4, unlock: 15, tau: 0.08, eps: 0, memory: 1.0,
                  entry: 15000, prizes: [37500, 18750, 3750], xpMult: 2.5, rivals: ['sol', 'june', 'otto'], aids: 'colour', timer: 20, reward: 'Glass' }
  };

  // Personality styles. lambda = risk aversion, mu = setup (trap) weight, beta = boil-over bonus,
  // kappa = keep-4s-and-5s weight, big = feed-the-fattest-tray weight.
  var PERSONALITIES = {
    rico:  { name: 'Rico',  title: 'The Hothead',   lambda: 0.3, mu: 0,   beta: -3, kappa: 0,   big: 0.35, line: 'Hot tray, hot hands.' },
    priya: { name: 'Priya', title: 'Quick Hands',   lambda: 0.8, mu: 0.1, beta: 0,  kappa: 0,   big: 0, memCap: 0.6, line: 'Mine. Next!' },
    mabel: { name: 'Mabel', title: 'The Hoarder',   lambda: 0.8, mu: 0.6, beta: 0,  kappa: 3,   big: 0, line: "I'll hold onto that, dear." },
    otto:  { name: 'Otto',  title: 'The Spoiler',   lambda: 0.9, mu: 0.2, beta: 4,  kappa: 0,   big: 0, spiteAt: ['glasshouse'], line: 'Nobody gets that one.' },
    june:  { name: 'June',  title: 'The Counter',   lambda: 1.3, mu: 0.2, beta: 0,  kappa: 0.5, big: 0, memFixed: 1.0, hardAt: ['glasshouse'], line: "There's one 6 left. It isn't yours." },
    sol:   { name: 'Sol',   title: 'The Trapper',   lambda: 1.0, mu: 0.8, beta: 0,  kappa: 1,   big: 0, slowplay: true, hardAt: ['supper', 'glasshouse'], line: 'Go on. Feed it.' },
    // baselines (not shown in the app)
    random:   { name: 'Random', random: true },
    greedy:   { name: 'Greedy', greedy: true },     // scoop the biggest tray if possible, else random
    rollout:  { name: 'Rollout', rolloutPolicy: true }, // the fast WIN% rollout policy
    // model of "a sensible human" used when a hard-tier AI simulates the human's reply
    sensible: { name: 'Sensible', lambda: 1.0, mu: 0.3, beta: 0, kappa: 0.5, big: 0 }
  };

  var SIGMA = { 2: 6.5, 3: 5.5, 4: 5.2 }; // per-remaining-hand noise for WIN%
  // seatWeights [CHANGED vs spec: all 1]: weight on each opponent's gain by seat distance (next, 2nd, 3rd).
  // Equal weights made the hard tier feed the seat right after it (+3.3 pts/hand for that seat at 4 seats).
  var HARD = { samples: 120, budgetMs: 60, minSamples: 30, passWeight: 0.15, leaderWeight: 1.2, setupWeight: 0.5,
               seatWeights: { 2: [1], 3: [1, 1], 4: [2, 1, 0.6] } };
  // [CHANGED vs spec] WIN% rollouts are table-aware by default: AI seats play their own style at venue sharpness,
  // your seat plays this "decent player" profile (plain fast-policy rollouts read 14-18 pts low against Café rivals).
  var SELF_PROFILE = { name: 'self', lambda: 1.0, mu: 0.3, beta: 0, kappa: 0.5, big: 0, tau: 0.3, eps: 0.02 };

  // ------------------------------------------------------------------ utilities
  function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
  function mix32(s) {
    var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function nextRand(st) { var s = (st.rng + 0x6D2B79F5) >>> 0; st.rng = s; return mix32(s); }
  /** makeRng(seed) -> function returning floats in [0,1) (mulberry32). */
  function makeRng(seed) { var s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) >>> 0; return mix32(s); }; }
  function hash32() {
    var h = 0x9E3779B9 | 0;
    for (var i = 0; i < arguments.length; i++) {
      h = Math.imul(h ^ (arguments[i] | 0), 0x85EBCA6B); h ^= h >>> 13;
      h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16;
    }
    return h >>> 0;
  }
  function shuffle(a, r) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
  function pc(x) { x = x - ((x >> 1) & 0x55555555); x = (x & 0x33333333) + ((x >> 2) & 0x33333333); return (((x + (x >> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; }
  function fullMask(V) { return (1 << (V + 1)) - 2; }
  function gumbel(r) { var x = r(); if (x < 1e-12) x = 1e-12; if (x > 1 - 1e-12) x = 1 - 1e-12; return -Math.log(-Math.log(x)); }
  function normal(r) { var u = r() || 1e-12, v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function insertSorted(arr, x) { var i = arr.length; arr.push(x); while (i > 0 && arr[i - 1] > x) { arr[i] = arr[i - 1]; i--; } arr[i] = x; return arr; }

  // ------------------------------------------------------------------ trio maths
  /** Completer bitmask of a tray given its P/D masks (rule 2.3). */
  function compMask(P, D, full) { return (D | ((P << 2) & (P << 1)) | ((P << 1) & (P >> 1)) | ((P >> 1) & (P >> 2))) & full; }
  function masksOf(chips) {
    var P = 0, D = 0, T = 0;
    for (var i = 0; i < chips.length; i++) { var b = 1 << chips[i]; if (D & b) T |= b; else if (P & b) D |= b; else P |= b; }
    return [P, D, T];
  }
  /** isTrio(chips): does this tray hold a Set (x·x·x) or a Run (x·x+1·x+2)? (rule 2.1/2.2) */
  function isTrio(chips) { var m = masksOf(chips); return m[2] !== 0 || (m[0] & (m[0] >> 1) & (m[0] >> 2)) !== 0; }
  /** completers(chips, V=8): sorted numbers that would make this tray hold a trio. */
  function completers(chips, V) {
    V = V || 8; var m = masksOf(chips);
    if (m[2] !== 0 || (m[0] & (m[0] >> 1) & (m[0] >> 2)) !== 0) return []; // already a trio (never between turns)
    return maskValues(compMask(m[0], m[1], fullMask(V)), V);
  }
  function maskValues(mask, V) { var out = []; for (var v = 1; v <= V; v++) if (mask & (1 << v)) out.push(v); return out; }
  function sumU(mask, u, V) { var s = 0; for (var v = 1; v <= V; v++) if (mask & (1 << v)) s += u[v]; return s; }
  /** Number of distinct trios the chip x takes part in, in a tray that already contains x (for the DOUBLE label, rule 9.4). */
  function triosWith(chips, x) {
    var c = {}; for (var i = 0; i < chips.length; i++) c[chips[i]] = (c[chips[i]] || 0) + 1;
    var n = 0; if ((c[x] || 0) >= 3) n++;
    if (c[x - 2] && c[x - 1]) n++; if (c[x - 1] && c[x + 1]) n++; if (c[x + 1] && c[x + 2]) n++;
    return n;
  }
  /** pHit(U, m, h): chance that h chips drawn from U unseen chips include one of m "hits". */
  function pHit(U, m, h) {
    if (m <= 0 || h <= 0) return 0;
    if (U - m < h) return 1;
    var p = 1; for (var i = 0; i < h; i++) p *= (U - m - i) / (U - i);
    return 1 - p;
  }

  // ------------------------------------------------------------------ setup
  /** Rule 2.4: top chip of the bag, then the first chip from the top that differs by >= gap. Mutates bag. */
  function seedTray(bag, count, gap) {
    var t = [];
    if (count <= 0 || !bag.length) return t;
    var a = bag.pop(); t.push(a);
    if (count >= 2) {
      for (var i = bag.length - 1; i >= 0; i--) {
        if (Math.abs(bag[i] - a) >= gap) { insertSorted(t, bag[i]); bag.splice(i, 1); break; }
      }
    }
    return t;
  }

  /**
   * newMatch(opts) -> state
   *   opts.players : [{name, human:true} | {name, personality:'rico'|...}]  (2-4 entries)
   *   opts.seed    : uint32 (default random)
   *   opts.venue   : 'cafe'|'noodle'|'tea'|'supper'|'glasshouse' (sets AI sharpness)
   *   opts.rules   : overrides of DEFAULT_RULES (variants)
   *   opts.record  : keep per-turn history for the "What they held" recap (default true)
   */
  function newMatch(opts) {
    opts = opts || {};
    var rules = {}, k;
    for (k in DEFAULT_RULES) rules[k] = DEFAULT_RULES[k];
    if (opts.rules) for (k in opts.rules) rules[k] = opts.rules[k];
    var pl = opts.players || [{ name: 'You', human: true }, { name: 'Rico', personality: 'rico' }];
    var N = pl.length;
    if (N < 2 || N > 4) throw new Error('Scoop needs 2-4 players');
    var seed = (opts.seed == null ? Math.floor(Math.random() * 4294967296) : opts.seed) >>> 0;
    var st = {
      version: 1, rules: rules, N: N,
      copies: rules.copies || (N >= rules.largeFrom ? rules.copiesLarge : rules.copiesSmall),
      venue: opts.venue || null, seed: seed, rng: (seed ^ 0x5C0FFEE5) >>> 0,
      players: pl.map(function (p, i) {
        return { id: i, name: p.name || ('Player ' + (i + 1)), human: !!p.human, personality: p.personality || (p.human ? null : 'sensible'),
                 score: 0, scoops: 0, biggest: 0, boils: 0, sprung: 0, doubles: 0, fullTrays: 0, handPoints: [] };
      }),
      phase: 'play', handNo: -1, order: [], starter: -1, turn: -1, ply: 0, handPly: 0,
      bag: [], trays: [], trayEpoch: [], hands: [], piles: [], discard: [], gone: [],
      lastFed: [], notHeld: [], handSummaries: [], history: [], events: [],
      record: opts.record !== false
    };
    startHand(st, st.events);
    return st;
  }

  function startHand(st, ev) {
    var R = st.rules, N = st.N, r = function () { return nextRand(st); }, i, p;
    st.handNo++;
    if (st.handNo === 0 || R.seatShuffle) st.order = shuffle(range(N), r);
    var starter;
    if (st.handNo === 0 || R.starter === 'random') starter = st.order[Math.floor(r() * N)];
    else if (R.starter === 'rotate') starter = st.order[(st.order.indexOf(st.starter) + 1) % N];
    else {
      var target = st.players[0].score;
      for (p = 1; p < N; p++) target = R.starter === 'leader' ? Math.max(target, st.players[p].score) : Math.min(target, st.players[p].score);
      var cands = st.order.filter(function (q) { return st.players[q].score === target; });
      starter = cands[Math.floor(r() * cands.length)];
    }
    var bag = [];
    for (var v = 1; v <= R.values; v++) for (i = 0; i < st.copies; i++) bag.push(v);
    shuffle(bag, r);
    st.bag = bag; st.trays = []; st.trayEpoch = [];
    for (i = 0; i < R.trays; i++) { st.trays.push(seedTray(bag, R.seedCount, R.seedGap)); st.trayEpoch.push(0); }
    st.hands = []; st.piles = []; st.lastFed = []; st.notHeld = [];
    for (p = 0; p < N; p++) { st.hands.push([]); st.piles.push([]); st.lastFed.push(null); st.notHeld.push(0); }
    var si = st.order.indexOf(starter);
    for (i = 0; i < R.handSize; i++) for (var j = 0; j < N; j++) { p = st.order[(si + j) % N]; if (bag.length) st.hands[p].push(bag.pop()); }
    st.discard = []; st.gone = []; st.starter = starter; st.turn = starter; st.handPly = 0;
    ev.push({ type: 'handStart', hand: st.handNo, order: st.order.slice(), starter: starter, trays: st.trays.map(function (t) { return t.slice(); }) });
  }

  function cloneState(s) {
    var c = {}, k;
    for (k in s) c[k] = s[k];
    c.rules = s.rules; // never mutated
    c.players = s.players.map(function (p) { var q = {}, kk; for (kk in p) q[kk] = p[kk]; q.handPoints = p.handPoints.slice(); return q; });
    c.order = s.order.slice(); c.bag = s.bag.slice(); c.trayEpoch = s.trayEpoch.slice();
    c.trays = s.trays.map(function (t) { return t.slice(); });
    c.hands = s.hands.map(function (h) { return h.slice(); });
    c.piles = s.piles.map(function (h) { return h.slice(); });
    c.discard = s.discard.slice(); c.gone = s.gone.slice();
    c.lastFed = s.lastFed.slice(); c.notHeld = s.notHeld.slice();
    c.handSummaries = s.handSummaries.slice(); c.history = s.history.slice(); c.events = [];
    return c;
  }

  // ------------------------------------------------------------------ queries
  function currentPlayer(st) { return st.phase === 'play' ? st.turn : -1; }
  function isOver(st) { return st.phase === 'over'; }
  function handSizes(st) { return st.hands.map(function (h) { return h.length; }); }

  /** legalActions(state, pid) -> [{type:'play', chip, tray}] — one per distinct (number, tray). Empty if not pid's turn. */
  function legalActions(st, pid) {
    if (pid == null) pid = st.turn;
    if (st.phase !== 'play' || st.turn !== pid) return [];
    var out = [], seen = {}, h = st.hands[pid];
    for (var a = 0; a < h.length; a++) {
      if (seen[h[a]]) continue; seen[h[a]] = 1;
      for (var t = 0; t < st.trays.length; t++) out.push({ type: 'play', chip: h[a], tray: t });
    }
    return out;
  }

  /** Outcome of dropping chip into tray t, without changing anything: {kind:'scoop'|'boil'|'feed', size, double}. */
  function moveOutcome(st, chip, t) {
    var after = insertSorted(st.trays[t].slice(), chip);
    if (isTrio(after)) return { kind: 'scoop', size: after.length, double: triosWith(after, chip) >= 2, chips: after };
    if (after.length >= st.rules.cap) return { kind: 'boil', size: after.length, chips: after };
    return { kind: 'feed', size: after.length, chips: after, completers: completers(after, st.rules.values) };
  }

  // ------------------------------------------------------------------ the transition
  /**
   * applyAction(state, {type:'play', chip, tray}) -> new state (input untouched).
   * Pass {inPlace:true} as 3rd argument to mutate instead. Throws on illegal actions.
   * state.events lists what happened (play/scoop/boil/refill/draw/handEnd/handStart/matchEnd)
   * so the UI can animate it.
   */
  function applyAction(state, action, opts) {
    if (state.phase !== 'play') throw new Error('match is over');
    if (!action || action.type !== 'play') throw new Error('unknown action');
    var pid = state.turn;
    if (action.pid != null && action.pid !== pid) throw new Error('not your turn');
    var hi = state.hands[pid].indexOf(action.chip);
    if (hi < 0) throw new Error('chip ' + action.chip + ' not in hand');
    var t = action.tray;
    if (!(t >= 0 && t < state.trays.length)) throw new Error('bad tray');

    var st = (opts && opts.inPlace) ? state : cloneState(state);
    var ev = st.events = [];
    var R = st.rules, full = fullMask(R.values), P = st.players[pid];
    // public pass inference: completers of every tray before the play
    var union = 0, i;
    for (i = 0; i < st.trays.length; i++) { var m = masksOf(st.trays[i]); union |= compMask(m[0], m[1], full); }
    if (st.record) {
      st.history.push({ hand: st.handNo, ply: st.ply, pid: pid, chip: action.chip, tray: t,
        trays: st.trays.map(function (x) { return x.slice(); }), hands: st.hands.map(function (x) { return x.slice(); }), bag: st.bag.length });
    }
    st.hands[pid].splice(hi, 1);
    var tray = insertSorted(st.trays[t].slice(), action.chip);
    st.trays[t] = tray;
    ev.push({ type: 'play', pid: pid, chip: action.chip, tray: t });
    var scooped = false;
    if (isTrio(tray)) {
      scooped = true;
      var n = tray.length, dbl = triosWith(tray, action.chip) >= 2;
      var lf = st.lastFed[pid], trap = !!(lf && lf.tray === t && lf.epoch === st.trayEpoch[t]);
      var sprung = trap && lf.heat >= (R.sprungHeat || 0);
      P.score += n; P.scoops++; if (n > P.biggest) P.biggest = n;
      if (dbl) P.doubles++; if (n >= R.cap) P.fullTrays++; if (sprung) P.sprung++;
      for (i = 0; i < n; i++) { st.piles[pid].push(tray[i]); st.gone.push(tray[i]); }
      ev.push({ type: 'scoop', pid: pid, tray: t, chips: tray.slice(), points: n, double: dbl, sprung: sprung, trap: trap, trapHeat: trap ? lf.heat : 0, full: n >= R.cap });
      st.trays[t] = []; st.trayEpoch[t]++; st.lastFed[pid] = null;
      refill(st, t, ev);
    } else if (tray.length >= R.cap) {
      P.boils++;
      for (i = 0; i < tray.length; i++) { st.discard.push(tray[i]); st.gone.push(tray[i]); }
      ev.push({ type: 'boil', pid: pid, tray: t, chips: tray.slice() });
      st.trays[t] = []; st.trayEpoch[t]++; st.lastFed[pid] = null;
      refill(st, t, ev);
    } else {
      st.lastFed[pid] = { tray: t, epoch: st.trayEpoch[t], heat: feedHeat(st, pid, tray) };
    }
    st.notHeld[pid] = scooped ? 0 : union;
    if (st.bag.length) { var d = st.bag.pop(); st.hands[pid].push(d); ev.push({ type: 'draw', pid: pid, chip: d }); }
    st.ply++; st.handPly++;
    var nxt = nextWithChips(st, pid);
    if (nxt < 0) endHand(st, ev); else st.turn = nxt;
    return st;
  }

  // heat of a tray just fed by pid, from pid's own view (unseen = everything not visible to pid; S = all opponents' chips)
  function feedHeat(st, pid, chips) {
    var V = st.rules.values, u = unseenCounts(st, pid), U = 0, S = 0, v, m = masksOf(chips);
    for (v = 1; v <= V; v++) U += u[v];
    for (v = 0; v < st.N; v++) if (v !== pid) S += st.hands[v].length;
    return heatFrom(compMask(m[0], m[1], fullMask(V)), u, U, S, V);
  }
  function refill(st, t, ev) {
    if (!st.bag.length) return;
    st.trays[t] = seedTray(st.bag, st.rules.refillCount, st.rules.seedGap);
    if (st.trays[t].length) ev.push({ type: 'refill', tray: t, chips: st.trays[t].slice() });
  }

  function nextWithChips(st, pid) {
    var idx = st.order.indexOf(pid);
    for (var k = 1; k <= st.N; k++) { var p = st.order[(idx + k) % st.N]; if (st.hands[p].length) return p; }
    return -1;
  }

  function endHand(st, ev) {
    var left = [], N = st.N, p, i;
    for (i = 0; i < st.trays.length; i++) { for (var j = 0; j < st.trays[i].length; j++) { left.push(st.trays[i][j]); st.discard.push(st.trays[i][j]); } st.trays[i] = []; }
    var pts = [];
    for (p = 0; p < N; p++) { pts.push(st.piles[p].length); st.players[p].handPoints.push(st.piles[p].length); }
    var summary = { hand: st.handNo, points: pts, totals: st.players.map(function (q) { return q.score; }), leftOnTable: left, nextStarter: null };
    st.handSummaries.push(summary);
    ev.push({ type: 'handEnd', summary: summary });
    if (st.handNo >= st.rules.hands - 1) {
      st.phase = 'over'; st.turn = -1;
      ev.push({ type: 'matchEnd', ranking: ranking(st) });
    } else {
      startHand(st, ev);
      summary.nextStarter = st.starter;
    }
  }

  // ------------------------------------------------------------------ ranking & rewards
  function cmpPlayers(a, b) { return (b.score - a.score) || (b.scoops - a.scoops) || (b.biggest - a.biggest) || (b.last - a.last); }
  /** ranking(state) -> [{pid, place, score, scoops, biggest, last, shared}] best first. Ties after tiebreaks share a place (rule 7.2). */
  function ranking(st) {
    var fh = st.rules.finalHandTiebreak;
    var rows = st.players.map(function (p) {
      var last = fh ? (st.phase === 'over' ? (p.handPoints[p.handPoints.length - 1] || 0) : (st.piles[p.id] ? st.piles[p.id].length : 0)) : 0;
      return { pid: p.id, score: p.score, scoops: p.scoops, biggest: p.biggest, last: last, place: 0, shared: 1 };
    });
    rows.sort(cmpPlayers);
    for (var i = 0; i < rows.length;) {
      var j = i; while (j + 1 < rows.length && cmpPlayers(rows[i], rows[j + 1]) === 0) j++;
      for (var k = i; k <= j; k++) { rows[k].place = i + 1; rows[k].shared = j - i + 1; }
      i = j + 1;
    }
    return rows;
  }
  /** prizes(state, venueKey) -> Sparks per pid; tied players pool the prizes of the places they occupy and split (floored). */
  function prizes(st, venueKey) {
    var vn = VENUES[venueKey], out = st.players.map(function () { return 0; });
    if (!vn) return out;
    var rk = ranking(st);
    for (var i = 0; i < rk.length; i++) {
      var r = rk[i], pool = 0;
      for (var q = r.place - 1; q < r.place - 1 + r.shared; q++) pool += vn.prizes[q] || 0;
      out[r.pid] = Math.floor(pool / r.shared);
    }
    return out;
  }
  var PLACE_XP = { 2: [40], 3: [40, 20], 4: [40, 20, 10] };
  /** matchXP(state, pid, venueKey, {firstWinToday, pro}) -> {lines:[[label,xp]], total} */
  function matchXP(st, pid, venueKey, o) {
    o = o || {};
    var P = st.players[pid], vn = VENUES[venueKey] || { xpMult: 1 }, lines = [];
    lines.push(['Chips scooped', P.score]);
    if (P.sprung) lines.push(['Sprung', 5 * P.sprung]);
    if (P.boils) lines.push(['Boil-overs', 3 * P.boils]);
    lines.push(['Hands', 10 * P.handPoints.length]);
    var rk = ranking(st).filter(function (r) { return r.pid === pid; })[0];
    var px = (PLACE_XP[st.N] || [])[rk.place - 1] || 0;
    if (px) lines.push(['Placement', px]);
    var base = lines.reduce(function (a, l) { return a + l[1]; }, 0);
    var total = base * vn.xpMult;
    if (o.firstWinToday && rk.place === 1) total *= 2;
    if (o.pro) total *= 1.1;
    return { lines: lines, base: base, total: Math.round(total) };
  }
  // [CHANGED vs spec 120 + 30(L-1)] x1.4: with the spec curve the sim'd median player hit Lv10 at match 13 (target ~20).
  function xpToNext(L) { return 168 + 42 * (L - 1); }
  function levelFromXP(xp) {
    var L = 1;
    while (L < 50 && xp >= xpToNext(L)) { xp -= xpToNext(L); L++; }
    return { level: L, into: xp, need: L < 50 ? xpToNext(L) : 0 };
  }

  // ------------------------------------------------------------------ information / glance stats
  /** unseenCounts(state, pid) -> u[0..V]: copies not visible to pid (bag + opponents' hands). Perfect memory (the app's unseen strip). */
  function unseenCounts(st, pid) {
    var V = st.rules.values, u = [0], v, i;
    for (v = 1; v <= V; v++) u.push(st.copies);
    for (i = 0; i < st.trays.length; i++) for (var j = 0; j < st.trays[i].length; j++) u[st.trays[i][j]]--;
    for (i = 0; i < st.gone.length; i++) u[st.gone[i]]--;
    var h = st.hands[pid]; for (i = 0; i < h.length; i++) u[h[i]]--;
    return u;
  }
  /** Total chips held by opponents who act between now and pid's next turn (all opponents during pid's own turn). */
  function oppChipsBeforeNext(st, pid) {
    if (st.phase !== 'play') return 0;
    var S = 0, N = st.N, idx = st.order.indexOf(st.turn === pid ? pid : st.turn), start = st.turn === pid ? 1 : 0;
    for (var k = start; k <= N; k++) { var p = st.order[(idx + k) % N]; if (p === pid) break; S += st.hands[p].length; }
    return S;
  }
  function heatFrom(comp, u, U, S, V) { return pHit(U, sumU(comp, u, V), S); }
  /** trayHeat(state, pid, t) -> 0..1: chance that some opponent acting before pid's next turn holds a completer of tray t. */
  function trayHeat(st, pid, t) {
    var V = st.rules.values, u = unseenCounts(st, pid), U = 0;
    for (var v = 1; v <= V; v++) U += u[v];
    var m = masksOf(st.trays[t]);
    return heatFrom(compMask(m[0], m[1], fullMask(V)), u, U, oppChipsBeforeNext(st, pid), V);
  }
  function heatBand(h) { return h >= 0.5 ? 'hot' : h >= 0.2 ? 'warm' : 'cool'; }

  /** glance(state, pid) -> {heat:[..], bands:[..], completers:[[..]], unseen:u, U, bag} — cheap, call after every play. */
  function glance(st, pid) {
    var V = st.rules.values, u = unseenCounts(st, pid), U = 0, v;
    for (v = 1; v <= V; v++) U += u[v];
    var S = oppChipsBeforeNext(st, pid), full = fullMask(V);
    var heat = st.trays.map(function (t) { var m = masksOf(t); return heatFrom(compMask(m[0], m[1], full), u, U, S, V); });
    return { heat: heat, bands: heat.map(heatBand), completers: st.trays.map(function (t) { return completers(t, V); }),
             unseen: u, U: U, bag: st.bag.length, oppChips: S };
  }

  // ---- fast internal board used by rollouts and the hard tier
  function boardMasks(st) {
    var n = st.trays.length, TP = new Int32Array(n), TD = new Int32Array(n);
    for (var i = 0; i < n; i++) { var m = masksOf(st.trays[i]); TP[i] = m[0]; TD[i] = m[1]; }
    return { TP: TP, TD: TD };
  }
  // seed an emptied fast tray from a bag array (rule 2.4)
  function fastSeed(TP, TD, t, bag, count, gap) {
    TP[t] = 0; TD[t] = 0;
    if (count <= 0 || !bag.length) return;
    var a = bag.pop(); TP[t] = 1 << a;
    if (count >= 2) for (var i = bag.length - 1; i >= 0; i--) {
      if (Math.abs(bag[i] - a) >= gap) { var b = 1 << bag[i]; if (TP[t] & b) TD[t] |= b; else TP[t] |= b; bag.splice(i, 1); break; }
    }
  }
  function addGone(gone, P, D, V) { if (!gone) return; for (var v = 1; v <= V; v++) gone[v] += ((P >> v) & 1) + ((D >> v) & 1); }

  // fast rollout policy: biggest scoop, else feed that leaves fewest completers (+U(0,.5) jitter), boil only if forced.
  // returns handIndex*8 + tray
  function rolloutPick(TP, TD, hand, full, cap, r) {
    var bestS = -1, bestSN = -1, bestF = -1, bestFS = 1e9, boil = -1;
    for (var t = 0; t < TP.length; t++) {
      var P = TP[t], D = TD[t], n = pc(P) + pc(D), comp = compMask(P, D, full);
      for (var a = 0; a < hand.length; a++) {
        var xb = 1 << hand[a];
        if (comp & xb) { if (n + 1 > bestSN) { bestSN = n + 1; bestS = a * 8 + t; } }
        else if (n + 1 >= cap) { if (boil < 0) boil = a * 8 + t; }
        else if (bestS < 0) {
          var P2 = P, D2 = D; if (P & xb) D2 |= xb; else P2 |= xb;
          var s = pc(compMask(P2, D2, full)) + r() * 0.5;
          if (s < bestFS) { bestFS = s; bestF = a * 8 + t; }
        }
      }
    }
    return bestS >= 0 ? bestS : bestF >= 0 ? bestF : boil;
  }

  // apply chip x to fast tray t for player p; returns points scooped (0 if none), -size if boiled
  function fastPlay(F, p, x, t) {
    var P = F.TP[t], D = F.TD[t], xb = 1 << x;
    var n0 = pc(P) + pc(D);
    if (compMask(P, D, F.full) & xb) {
      var n = n0 + 1;
      F.pts[p] += n; F.scoops[p]++; if (n > F.big[p]) F.big[p] = n;
      if (F.gone) { addGone(F.gone, P, D, F.V); F.gone[x]++; }
      fastSeed(F.TP, F.TD, t, F.bag, F.refill, F.gap);
      return n;
    }
    if (P & xb) D |= xb; else P |= xb;
    if (n0 + 1 >= F.cap) { if (F.gone) addGone(F.gone, P, D, F.V); fastSeed(F.TP, F.TD, t, F.bag, F.refill, F.gap); return -(n0 + 1); }
    F.TP[t] = P; F.TD[t] = D;
    return 0;
  }

  // deal a hidden world for `viewer` with perfect knowledge (WIN%): returns fast state
  function dealWorld(st, viewer, r) {
    var V = st.rules.values, u = unseenCounts(st, viewer), pool = [], v, k, p;
    for (v = 1; v <= V; v++) for (k = 0; k < u[v]; k++) pool.push(v);
    shuffle(pool, r);
    var hands = [];
    for (p = 0; p < st.N; p++) {
      if (p === viewer) { hands.push(st.hands[p].slice()); continue; }
      var h = []; for (k = 0; k < st.hands[p].length; k++) h.push(pool.pop()); hands.push(h);
    }
    var bm = boardMasks(st);
    return {
      TP: bm.TP, TD: bm.TD, bag: pool, hands: hands, V: V, full: fullMask(V), cap: st.rules.cap,
      refill: st.rules.refillCount, gap: st.rules.seedGap,
      pts: st.players.map(function (q) { return q.score; }), scoops: st.players.map(function (q) { return q.scoops; }),
      big: st.players.map(function (q) { return q.biggest; }), gone: null, copies: st.copies, pol: null
    };
  }
  // Medium profiles for every AI seat (table-aware WIN%); seats listed in `skip` (the viewer) keep the fast policy
  function tablePolicies(st, skip, selfProfile) {
    return st.players.map(function (q) {
      if (q.id === skip) return selfProfile || null;
      if (q.human || !q.personality) return null;
      var pr = resolveProfile(q.personality, st.venue);
      if (pr.random || pr.greedy || pr.rolloutPolicy) return null;
      return pr;
    });
  }
  // play out the current hand from order index `cur`. F.pol[p] (optional) = Medium profile for seat p, else the fast policy.
  var R_u = new Int32Array(16), R_oppH = [];
  function playoutHand(F, order, cur, r) {
    var N = order.length, guard = 0;
    for (;;) {
      var k, p = -1;
      for (k = 0; k < N; k++) { p = order[(cur + k) % N]; if (F.hands[p].length) break; }
      if (k === N || guard++ > 500) return;
      cur = (cur + k) % N;
      var h = F.hands[p], mv, prm = F.pol ? F.pol[p] : null;
      if (prm && !(prm.eps > 0 && r() < prm.eps)) {
        var U = 0, v, ti;
        for (v = 1; v <= F.V; v++) {
          var on = 0; for (ti = 0; ti < F.TP.length; ti++) on += ((F.TP[ti] >> v) & 1) + ((F.TD[ti] >> v) & 1);
          R_u[v] = F.copies - F.gone[v] - on;
        }
        for (ti = 0; ti < h.length; ti++) R_u[h[ti]]--;
        for (v = 1; v <= F.V; v++) { if (R_u[v] < 0) R_u[v] = 0; U += R_u[v]; }
        R_oppH.length = 0;
        for (ti = 1; ti < N; ti++) R_oppH.push(F.hands[order[(cur + ti) % N]].length);
        var b = mediumCore(F.TP, F.TD, h, R_u, U, R_oppH, null, prm, F.V, F.cap, r, null);
        mv = h.indexOf(b >> 3) * 8 + (b & 7);
      } else if (prm) {
        mv = Math.floor(r() * h.length) * 8 + Math.floor(r() * F.TP.length);
      } else mv = rolloutPick(F.TP, F.TD, h, F.full, F.cap, r);
      var a = mv >> 3, t = mv & 7, x = h[a];
      h[a] = h[h.length - 1]; h.pop();
      fastPlay(F, p, x, t);
      if (F.bag.length) h.push(F.bag.pop());
      cur = (cur + 1) % N;
    }
  }

  /** Mathematically decided? +1 = pid certainly wins outright, -1 = certainly cannot win, 0 = open. */
  function decided(st, pid) {
    if (st.phase === 'over') { var rk = ranking(st).filter(function (r) { return r.pid === pid; })[0]; return rk.place === 1 && rk.shared === 1 ? 1 : (rk.place === 1 ? 0 : -1); }
    var rem = st.bag.length, i;
    for (i = 0; i < st.trays.length; i++) rem += st.trays[i].length;
    for (i = 0; i < st.N; i++) rem += st.hands[i].length;
    rem += (st.rules.hands - 1 - st.handNo) * st.copies * st.rules.values;
    var me = st.players[pid].score, win = true;
    for (i = 0; i < st.N; i++) if (i !== pid) {
      if (st.players[i].score > me + rem) return -1;
      if (!(me > st.players[i].score + rem)) win = false;
    }
    return win ? 1 : 0;
  }

  /** One WIN% rollout: share of first place pid gets (0..1). firstAction forces pid's move first. */
  /** Play the rest of the current hand once (hidden hands re-dealt from pid's unseen pool). Returns {pts, scoops, big} match totals. */
  function rolloutHandEnd(st, pid, r, firstAction, pol) {
    var F = dealWorld(st, pid, r), N = st.N, order = st.order, cur = order.indexOf(st.turn);
    if (pol) {
      F.pol = pol; F.gone = new Int32Array(F.V + 1);
      for (var gi = 0; gi < st.gone.length; gi++) F.gone[st.gone[gi]]++;
    }
    if (firstAction && st.turn === pid) {
      var h = F.hands[pid], a = h.indexOf(firstAction.chip);
      if (a >= 0) {
        h[a] = h[h.length - 1]; h.pop();
        fastPlay(F, pid, firstAction.chip, firstAction.tray);
        if (F.bag.length) h.push(F.bag.pop());
        cur = (cur + 1) % N;
      }
    }
    playoutHand(F, order, cur, r);
    return F;
  }
  function winRollout(st, pid, r, sigma, firstAction, pol) {
    var F = rolloutHandEnd(st, pid, r, firstAction, pol), N = st.N;
    var left = st.rules.hands - 1 - st.handNo, p;
    if (left > 0) for (var k = 0; k < left; k++) for (p = 0; p < N; p++) F.pts[p] += sigma * normal(r);
    // final-hand points (only matter when no hands remain and the rule is on)
    var fh = (left === 0 && st.rules.finalHandTiebreak), last = null;
    if (fh) { last = []; for (p = 0; p < N; p++) last.push(st.piles[p].length + F.pts[p] - st.players[p].score); }
    // rank with real tiebreaks (ties only possible when no noise)
    var best = -1, tied = 0, mine = false;
    for (p = 0; p < N; p++) {
      var c = best < 0 ? -1 : ((F.pts[p] - F.pts[best]) || (F.scoops[p] - F.scoops[best]) || (F.big[p] - F.big[best]) || (fh ? last[p] - last[best] : 0));
      if (best < 0 || c > 0) { best = p; tied = 1; mine = p === pid; }
      else if (c === 0) { tied++; if (p === pid) mine = true; }
    }
    return mine ? 1 / tied : 0;
  }

  /**
   * winProbability(state, pid, {rollouts=300, rng, sigma, first:{chip,tray}}) ->
   *   {p, display (whole %, clamped 1-99 unless decided), decided, rollouts}
   * For the 50-per-frame UI, call createWinEstimator instead.
   */
  function winProbability(st, pid, o) {
    o = o || {};
    var R = o.rollouts || 300, dec = decided(st, pid);
    if (st.phase === 'over' || dec !== 0) {
      var pp = st.phase === 'over' ? (function () { var rk = ranking(st).filter(function (x) { return x.pid === pid; })[0]; return rk.place === 1 ? 1 / rk.shared : 0; })() : (dec > 0 ? 1 : 0);
      return { p: pp, display: Math.round(pp * 100), decided: true, rollouts: 0 };
    }
    var r = o.rng || makeRng(hash32(st.seed, st.ply, pid, 0xBEEF, o.salt || 0));
    var sigma = o.sigma != null ? o.sigma : SIGMA[st.N];
    var w = 0, pol = o.table !== false ? tablePolicies(st, pid, o.selfProfile || SELF_PROFILE) : null;
    for (var i = 0; i < R; i++) w += winRollout(st, pid, r, sigma, o.first, pol);
    var p = w / R;
    return { p: p, display: Math.min(99, Math.max(1, Math.round(p * 100))), decided: false, rollouts: R };
  }
  /** createWinEstimator(state, pid, opts) -> {step(n) -> {p, display, n}} for chunked (50 per frame) computation. */
  function createWinEstimator(st, pid, o) {
    o = o || {};
    var r = o.rng || makeRng(hash32(st.seed, st.ply, pid, 0xBEEF, o.salt || 0)), sigma = o.sigma != null ? o.sigma : SIGMA[st.N];
    var w = 0, n = 0, dec = decided(st, pid), pol = o.table !== false ? tablePolicies(st, pid, o.selfProfile || SELF_PROFILE) : null;
    return {
      step: function (k) {
        if (st.phase === 'over' || dec !== 0) return winProbability(st, pid, o);
        for (var i = 0; i < k; i++) { w += winRollout(st, pid, r, sigma, o.first, pol); n++; }
        var p = w / n; return { p: p, display: Math.min(99, Math.max(1, Math.round(p * 100))), decided: false, n: n };
      }
    };
  }

  /**
   * previewMove(state, pid, {chip,tray}, {win:true, winBefore, rollouts=100}) ->
   *  {kind:'scoop'|'boil'|'feed', points, lost, double, heatBefore, heatAfter, label,
   *   winBefore, winAfter, next}
   */
  function previewMove(st, pid, action, o) {
    o = o || {};
    var V = st.rules.values, full = fullMask(V), out = moveOutcome(st, action.chip, action.tray);
    var u = unseenCounts(st, pid), U = 0, v; for (v = 1; v <= V; v++) U += u[v];
    var S = 0; for (var q = 0; q < st.N; q++) if (q !== pid) S += st.hands[q].length;
    var m0 = masksOf(st.trays[action.tray]);
    var res = { kind: out.kind, heatBefore: heatFrom(compMask(m0[0], m0[1], full), u, U, S, V) };
    if (out.kind === 'scoop') { res.points = out.size; res.double = out.double; res.heatAfter = 0; res.label = 'SCOOP +' + out.size + (out.double ? ' DOUBLE' : ''); }
    else if (out.kind === 'boil') { res.lost = out.size; res.heatAfter = 0; res.label = 'BOIL −' + out.size; }
    else {
      var m1 = masksOf(out.chips); res.heatAfter = heatFrom(compMask(m1[0], m1[1], full), u, U, S, V);
      res.label = 'HEAT ' + Math.round(res.heatBefore * 100) + '% → ' + Math.round(res.heatAfter * 100) + '%';
    }
    // NEXT: chance to be able to scoop next turn if nobody touches the trays
    var kept = st.hands[pid].slice(); kept.splice(kept.indexOf(action.chip), 1);
    var keptMask = 0; kept.forEach(function (x) { keptMask |= 1 << x; });
    var union = 0;
    for (var t = 0; t < st.trays.length; t++) {
      var chips = t === action.tray ? (out.kind === 'feed' ? out.chips : []) : st.trays[t];
      if (!chips.length) continue;
      var mm = masksOf(chips); union |= compMask(mm[0], mm[1], full);
    }
    res.next = (union & keptMask) ? 1 : (st.bag.length && U ? sumU(union, u, V) / U : 0);
    if (o.win !== false) {
      res.winBefore = o.winBefore != null ? o.winBefore : winProbability(st, pid, { rollouts: o.rolloutsBefore || 300, table: o.table, sigma: o.sigma }).p;
      res.winAfter = winProbability(st, pid, { rollouts: o.rollouts || 100, first: action, salt: 7, table: o.table, sigma: o.sigma }).p;
    }
    return res;
  }

  // ------------------------------------------------------------------ AI
  /**
   * resolveProfile(personality, venueKey, overrides) -> numeric params.
   * personality: a key of PERSONALITIES or an object {lambda, mu, beta, kappa, big, tau, eps, memory, ...}.
   */
  function resolveProfile(personality, venueKey, o) {
    o = o || {};
    var base = typeof personality === 'string' ? PERSONALITIES[personality] : personality;
    if (!base) throw new Error('unknown personality ' + personality);
    var vn = VENUES[venueKey] || VENUES.tea;
    var p = { name: base.name || 'custom', lambda: base.lambda || 0, mu: base.mu || 0, beta: base.beta || 0, kappa: base.kappa || 0, big: base.big || 0,
      tau: base.tau != null ? base.tau : vn.tau, eps: base.eps != null ? base.eps : vn.eps, memory: base.memory != null ? base.memory : vn.memory,
      slowplay: !!base.slowplay, random: !!base.random, greedy: !!base.greedy, rolloutPolicy: !!base.rolloutPolicy,
      hard: !!(base.hard || (base.hardAt && base.hardAt.indexOf(vn.key) >= 0)),
      spite: !!(base.spite || (base.spiteAt && base.spiteAt.indexOf(vn.key) >= 0)),
      passInference: base.passInference !== false, setupAll: !!base.setupAll };
    if (base.memCap != null) p.memory = Math.min(p.memory, base.memCap);
    if (base.memFixed != null) p.memory = base.memFixed;
    for (var k in o) if (o[k] !== undefined && k in p) p[k] = o[k];
    return p;
  }

  // module scratch (mediumCore is not re-entrant, it never calls itself)
  var S_n = new Int32Array(8), S_c = new Int32Array(8), S_m = new Int32Array(8), S_v = new Float64Array(8), S_p = new Float64Array(8);

  /**
   * Medium evaluation (spec "MEDIUM EVALUATION"). Returns chip*8+tray of the best move.
   *  TP/TD tray masks, hand: values, u: unseen counts (AI's view), U = sum(u),
   *  oppH: hand sizes of opponents in turn order after me, oppMul: per-opponent risk multiplier (spite) or null.
   *  list (optional array) receives every scored move.
   */
  function mediumCore(TP, TD, hand, u, U, oppH, oppMul, prm, V, cap, r, list) {
    var nT = TP.length, full = fullMask(V), i, j;
    var keepA = V >> 1, keepB = keepA + 1;
    for (i = 0; i < nT; i++) { S_n[i] = pc(TP[i]) + pc(TD[i]); S_c[i] = compMask(TP[i], TD[i], full); S_m[i] = sumU(S_c[i], u, V); }
    var h1 = 0, hAll = 0;
    for (i = 0; i < oppH.length; i++) { if (oppH[i] > 0 && !h1) h1 = oppH[i]; hAll += oppH[i]; }
    var hSetup = prm.setupAll ? hAll : h1;
    var best = -1, bestS = -Infinity, seen = 0;
    for (var a = 0; a < hand.length; a++) {
      var x = hand[a], xb = 1 << x;
      if (seen & xb) continue; seen |= xb;
      var restMask = 0, keepN = 0, skip = false;
      for (j = 0; j < hand.length; j++) { var y = hand[j]; if (!skip && y === x) { skip = true; continue; } restMask |= 1 << y; if (y === keepA || y === keepB) keepN++; }
      for (var t = 0; t < nT; t++) {
        var n0 = S_n[t], gain = 0, boil = 0, nN = 0, cN = 0, mN = 0;
        if (S_c[t] & xb) gain = n0 + 1;
        else if (n0 + 1 >= cap) boil = 1;
        else { var P = TP[t], D = TD[t]; if (P & xb) D |= xb; else P |= xb; nN = n0 + 1; cN = compMask(P, D, full); mN = sumU(cN, u, V); }
        var risk = 0, w = 1;
        for (var k = 0; k < oppH.length; k++) {
          var h = oppH[k];
          if (h > 0) {
            var cnt = 0;
            for (i = 0; i < nT; i++) {
              var ni = i === t ? nN : S_n[i]; if (!ni) continue;
              var mi = i === t ? mN : S_m[i]; if (!mi) continue;
              var vi = ni + 1, pi = pHit(U, mi, h), q = cnt++;
              while (q > 0 && S_v[q - 1] < vi) { S_v[q] = S_v[q - 1]; S_p[q] = S_p[q - 1]; q--; }
              S_v[q] = vi; S_p[q] = pi;
            }
            var rem = 1, rk = 0;
            for (i = 0; i < cnt; i++) { rk += rem * S_p[i] * S_v[i]; rem *= 1 - S_p[i]; }
            if (oppMul) rk *= oppMul[k];
            risk += w * rk;
          }
          w *= 0.5;
        }
        var setup = 0;
        if (prm.mu) for (i = 0; i < nT; i++) {
          var n2 = i === t ? nN : S_n[i]; if (!n2) continue;
          var c2 = i === t ? cN : S_c[i]; if (!(c2 & restMask)) continue;
          var sv = (n2 + 1) * (1 - pHit(U, i === t ? mN : S_m[i], hSetup)); if (sv > setup) setup = sv;
        }
        var s = gain - prm.lambda * risk + prm.mu * setup + prm.beta * boil + prm.kappa * 0.15 * keepN + ((!gain && !boil) ? prm.big * n0 : 0);
        if (list) list.push({ chip: x, tray: t, score: s, gain: gain, boil: !!boil, risk: risk, setup: setup });
        if (prm.tau > 0 && r) s += prm.tau * gumbel(r);
        if (s > bestS) { bestS = s; best = x * 8 + t; }
      }
    }
    return best;
  }

  /** What an AI knows (spec "STATE AVAILABLE TO AN AI"). Memory of gone chips is rolled once per chip per hand via a hash. */
  function aiView(st, pid, memory) {
    var V = st.rules.values, u = new Int32Array(V + 1), v, i;
    for (v = 1; v <= V; v++) u[v] = st.copies;
    for (i = 0; i < st.trays.length; i++) for (var j = 0; j < st.trays[i].length; j++) u[st.trays[i][j]]--;
    var h = st.hands[pid]; for (i = 0; i < h.length; i++) u[h[i]]--;
    for (i = 0; i < st.gone.length; i++) {
      if (memory >= 1 || (memory > 0 && hash32(st.seed, st.handNo, pid, i, 0x3E3) / 4294967296 < memory)) u[st.gone[i]]--;
    }
    var U = 0; for (v = 1; v <= V; v++) { if (u[v] < 0) u[v] = 0; U += u[v]; }
    var idx = st.order.indexOf(pid), opp = [], oppH = [];
    for (var k = 1; k < st.N; k++) { var q = st.order[(idx + k) % st.N]; opp.push(q); oppH.push(st.hands[q].length); }
    var bm = boardMasks(st);
    return { pid: pid, V: V, u: u, U: U, hand: h.slice(), opp: opp, oppH: oppH, TP: bm.TP, TD: bm.TD, bag: st.bag.length };
  }

  function leaderOf(st, exclude) {
    var best = -1, bs = -1;
    for (var p = 0; p < st.N; p++) if (st.players[p].score > bs) { bs = st.players[p].score; best = p; }
    if (bs <= 0) return -1;
    var cnt = 0; for (p = 0; p < st.N; p++) if (st.players[p].score === bs) cnt++;
    if (cnt > 1 || best === exclude) return -1;
    return best;
  }

  function mediumMove(st, view, prof, r, list) {
    var mul = null;
    if (prof.spite) {
      var L = leaderOf(st, view.pid);
      if (L >= 0) mul = view.opp.map(function (q) { return q === L ? 1.5 : 1; });
    }
    var best = mediumCore(view.TP, view.TD, view.hand, view.u, view.U, view.oppH, mul, prof, view.V, st.rules.cap, r, list);
    return { type: 'play', chip: best >> 3, tray: best & 7 };
  }

  // Sol's slowplay: grow a tray only he can scoop while keeping a completer and adding no live completer.
  function slowplayMove(st, view, prof) {
    if (!view.bag) return null;
    var full = fullMask(view.V), hand = view.hand, hm = 0, i;
    for (i = 0; i < hand.length; i++) hm |= 1 << hand[i];
    var cands = [];
    for (var t = 0; t < view.TP.length; t++) {
      var P = view.TP[t], D = view.TD[t], n = pc(P) + pc(D);
      if (n < 1 || n > 3) continue;
      var comp = compMask(P, D, full);
      if (!comp || !(comp & hm) || sumU(comp, view.u, view.V) !== 0) continue;
      var seen = 0;
      for (var a = 0; a < hand.length; a++) {
        var y = hand[a], yb = 1 << y;
        if ((seen & yb) || (comp & yb)) continue; seen |= yb;
        var P2 = P, D2 = D; if (P & yb) D2 |= yb; else P2 |= yb;
        var c2 = compMask(P2, D2, full);
        if (sumU(c2 & ~comp, view.u, view.V) !== 0) continue;
        var rest = 0, skip = false;
        for (i = 0; i < hand.length; i++) { if (!skip && hand[i] === y) { skip = true; continue; } rest |= 1 << hand[i]; }
        if (!(rest & c2)) continue;
        cands.push({ chip: y, tray: t });
      }
    }
    if (!cands.length) return null;
    if (cands.length === 1) return { type: 'play', chip: cands[0].chip, tray: cands[0].tray };
    var list = []; mediumCore(view.TP, view.TD, view.hand, view.u, view.U, view.oppH, null, prof, view.V, st.rules.cap, null, list);
    var best = null, bs = -Infinity;
    list.forEach(function (m) { if (cands.some(function (c) { return c.chip === m.chip && c.tray === m.tray; }) && m.score > bs) { bs = m.score; best = m; } });
    return { type: 'play', chip: best.chip, tray: best.tray };
  }

  // Hard tier: Monte Carlo over hidden hands with pass inference; opponents reply once with Medium (tau 0).
  function hardMove(st, view, prof, r, o) {
    var V = view.V, full = fullMask(V), cap = st.rules.cap, N = st.N, i, k, v;
    var moves = [], seen = 0;
    for (i = 0; i < view.hand.length; i++) { var x = view.hand[i]; if (seen & (1 << x)) continue; seen |= 1 << x; for (var t = 0; t < view.TP.length; t++) moves.push([x, t]); }
    if (moves.length <= 1) return { move: { type: 'play', chip: moves[0][0], tray: moves[0][1] }, samples: 0, fallback: false };
    var K = o.samples || HARD.samples, budget = o.budgetMs != null ? o.budgetMs : HARD.budgetMs, scale = o.timeScale || 1;
    var minS = o.minSamples != null ? o.minSamples : HARD.minSamples;
    var passW = prof.passInference ? HARD.passWeight : 1;
    // opponents: hand size, style, pass-inference mask, gain weight
    var L = N >= 3 ? leaderOf(st, view.pid) : -1;
    var opps = view.opp.map(function (q, j) {
      var pers = st.players[q].human || !st.players[q].personality ? 'sensible' : st.players[q].personality;
      var pr = resolveProfile(pers, st.venue, { tau: 0, eps: 0 });
      if (pr.random || pr.greedy || pr.rolloutPolicy) pr = resolveProfile('sensible', st.venue, { tau: 0, eps: 0 });
      return { pid: q, h: view.oppH[j], prm: pr, notHeld: st.notHeld[q] || 0, w: (q === L ? HARD.leaderWeight : 1) * (((HARD.seatWeights[N] || [])[j]) != null ? HARD.seatWeights[N][j] : 1) };
    });
    var goneAll = new Int32Array(V + 1); for (i = 0; i < st.gone.length; i++) goneAll[st.gone[i]]++;
    var bagCount = st.bag.length, nm = moves.length, sums = new Float64Array(nm), done = 0, t0 = now(), truncated = false;
    var pool = new Int32Array(V + 1), wv = new Float64Array(V + 1);
    var uK = new Int32Array(V + 1), oppHK = [], TP = new Int32Array(view.TP.length), TD = new Int32Array(view.TD.length);
    var oppHands = opps.map(function () { return []; });
    for (var s = 0; s < K; s++) {
      if (s > 0 && s % 10 === 0 && (now() - t0) * scale > budget) { truncated = true; break; }
      // ---- sample a world consistent with the AI's view
      for (v = 1; v <= V; v++) pool[v] = view.u[v];
      for (k = 0; k < opps.length; k++) {
        var hk = oppHands[k]; hk.length = 0;
        for (var d = 0; d < opps[k].h; d++) {
          var tot = 0;
          for (v = 1; v <= V; v++) { wv[v] = pool[v] * ((opps[k].notHeld >> v) & 1 ? passW : 1); tot += wv[v]; }
          if (tot <= 0) break;
          var z = r() * tot, pick = V;
          for (v = 1; v <= V; v++) { z -= wv[v]; if (z < 0) { pick = v; break; } }
          pool[pick]--; hk.push(pick);
        }
      }
      var rest = []; for (v = 1; v <= V; v++) for (i = 0; i < pool[v]; i++) rest.push(v);
      shuffle(rest, r);
      if (rest.length > bagCount) rest = rest.slice(rest.length - bagCount);
      // ---- evaluate every candidate on this world (common random numbers)
      for (var mi = 0; mi < nm; mi++) {
        TP.set(view.TP); TD.set(view.TD);
        var F = { TP: TP, TD: TD, bag: rest.slice(), V: V, full: full, cap: cap, refill: st.rules.refillCount, gap: st.rules.seedGap,
                  pts: [0, 0, 0, 0, 0], scoops: [0, 0, 0, 0, 0], big: [0, 0, 0, 0, 0], gone: goneAll.slice() };
        var my = view.hand.slice(), mx = moves[mi][0];
        my.splice(my.indexOf(mx), 1);
        var gAI = fastPlay(F, 4, mx, moves[mi][1]); if (gAI < 0) gAI = 0;
        if (F.bag.length) my.push(F.bag.pop());
        var net = gAI;
        var hs = oppHands.map(function (h) { return h.slice(); });
        for (k = 0; k < opps.length; k++) {
          var hh = hs[k]; if (!hh.length) continue;
          // opponent's own unseen view (public gone + trays + their hand)
          var Uk = 0;
          for (v = 1; v <= V; v++) {
            var onT = 0; for (var ti = 0; ti < TP.length; ti++) onT += ((TP[ti] >> v) & 1) + ((TD[ti] >> v) & 1);
            uK[v] = st.copies - F.gone[v] - onT;
          }
          for (i = 0; i < hh.length; i++) uK[hh[i]]--;
          for (v = 1; v <= V; v++) { if (uK[v] < 0) uK[v] = 0; Uk += uK[v]; }
          oppHK.length = 0;
          for (var j2 = k + 1; j2 < opps.length; j2++) oppHK.push(hs[j2].length);
          oppHK.push(my.length);
          for (j2 = 0; j2 < k; j2++) oppHK.push(hs[j2].length);
          var b = mediumCore(TP, TD, hh, uK, Uk, oppHK, null, opps[k].prm, V, cap, null, null);
          var ox = b >> 3; hh.splice(hh.indexOf(ox), 1);
          var g = fastPlay(F, k, ox, b & 7); if (g < 0) g = 0;
          net -= opps[k].w * g;
          if (F.bag.length) hh.push(F.bag.pop());
        }
        // setup at my next turn: best scoop I could make
        var su = 0, hm = 0; for (i = 0; i < my.length; i++) hm |= 1 << my[i];
        for (i = 0; i < TP.length; i++) { var nn = pc(TP[i]) + pc(TD[i]); if (nn && (compMask(TP[i], TD[i], full) & hm) && nn + 1 > su) su = nn + 1; }
        sums[mi] += net + HARD.setupWeight * su;
      }
      done++;
    }
    if (done < minS && truncated) return { move: null, samples: done, fallback: true };
    var bi = 0; for (i = 1; i < nm; i++) if (sums[i] > sums[bi]) bi = i;
    return { move: { type: 'play', chip: moves[bi][0], tray: moves[bi][1] }, samples: done, fallback: false, truncated: truncated };
  }

  /**
   * aiChooseAction(state, pid, personality, opts) -> {type:'play', chip, tray, meta}
   *   personality: 'rico'|'priya'|'mabel'|'otto'|'june'|'sol'|'random'|'greedy'|'rollout'|'sensible' or a params object.
   *   opts: {venue, rng, tau, eps, memory, hard, samples, budgetMs, timeScale, minSamples, list:true}
   *   meta: {mode:'medium'|'hard'|'slowplay'|'eps'|'random'|'greedy'|'rollout', ms, samples, fallback, list}
   */
  function aiChooseAction(st, pid, personality, opts) {
    opts = opts || {};
    if (st.phase !== 'play' || st.turn !== pid) return null;
    var t0 = now();
    var prof = resolveProfile(personality, opts.venue || st.venue, opts);
    var r = opts.rng || makeRng(hash32(st.seed, st.ply, pid, 0xA11));
    var legal = legalActions(st, pid), act = null, meta = { mode: 'medium' };
    if (prof.random) { act = legal[Math.floor(r() * legal.length)]; meta.mode = 'random'; }
    else if (prof.greedy) {
      var bs = 0;
      legal.forEach(function (a) { var oc = moveOutcome(st, a.chip, a.tray); if (oc.kind === 'scoop' && oc.size > bs) { bs = oc.size; act = a; } });
      if (!act) act = legal[Math.floor(r() * legal.length)];
      meta.mode = 'greedy';
    } else if (prof.rolloutPolicy) {
      var bm = boardMasks(st), h = st.hands[pid], mv = rolloutPick(bm.TP, bm.TD, h, fullMask(st.rules.values), st.rules.cap, r);
      act = { type: 'play', chip: h[mv >> 3], tray: mv & 7 }; meta.mode = 'rollout';
    } else {
      var view = aiView(st, pid, prof.memory);
      if (prof.slowplay) { act = slowplayMove(st, view, prof); if (act) meta.mode = 'slowplay'; }
      if (!act && prof.eps > 0 && r() < prof.eps) { act = legal[Math.floor(r() * legal.length)]; meta.mode = 'eps'; }
      if (!act && prof.hard) {
        var hr = hardMove(st, view, prof, r, opts);
        meta.samples = hr.samples; meta.fallback = hr.fallback; meta.truncated = !!hr.truncated;
        if (hr.move) { act = hr.move; meta.mode = 'hard'; }
      }
      if (!act) { var list = opts.list ? [] : null; act = mediumMove(st, view, prof, r, list); if (list) meta.list = list; if (meta.fallback) meta.mode = 'medium-fallback'; }
    }
    meta.ms = now() - t0;
    return { type: 'play', chip: act.chip, tray: act.tray, meta: meta };
  }

  /** Move used when the Glasshouse 20 s timer runs out (rule 9.9): June's Medium choice at tau 0. */
  function timeoutAction(st, pid) { return aiChooseAction(st, pid, 'june', { venue: 'glasshouse', tau: 0, eps: 0, hard: false }); }

  // ------------------------------------------------------------------ weekly league (The Kiln)
  var KILN = { tiers: ['Clay', 'Terracotta', 'Stoneware', 'Porcelain', 'Gold Leaf'], median: [500, 800, 1200, 1800, 2700],
               base: [300, 600, 1200, 2500, 5000], placeMult: [3, 2, 1.5],
               // [CHANGED vs spec: spread 0.55, rival median x1] so the top-4 cutoff sits ~108% of a median player's XP
               spread: 0.30, medianMul: 0.8, pacers: [1.1, 0.95] };
  var RIVAL_NAMES = ['Ada', 'Bo', 'Cass', 'Dev', 'Elif', 'Finn', 'Gus', 'Hana', 'Ines', 'Jo', 'Kai', 'Lux', 'Mo', 'Nell', 'Oz', 'Pia', 'Quin', 'Ren', 'Sage', 'Tam', 'Uma', 'Vic', 'Wren', 'Yuki', 'Zed'];
  /** kilnRivals(isoWeek, tier, playerSeed, lastWeekXP, cfg) -> 19 rivals {name, glyph, target, sessions:[{day, hour, xp}]} */
  function kilnRivals(week, tier, playerSeed, lastWeekXP, cfg) {
    cfg = cfg || {};
    var spread = cfg.spread != null ? cfg.spread : KILN.spread, pacers = cfg.pacers || KILN.pacers, medMul = cfg.medianMul || KILN.medianMul;
    var r = makeRng(hash32(week, tier, playerSeed, 0x4B11)), M = KILN.median[tier] * medMul, out = [];
    var names = shuffle(RIVAL_NAMES.slice(), r);
    for (var i = 0; i < 19; i++) {
      var T = i < pacers.length ? pacers[i] * Math.max(KILN.median[tier], lastWeekXP || 0) : M * Math.exp(spread * normal(r));
      var a = 0.5 + 0.45 * r(), ws = [], days = [];
      for (var d = 0; d < 7; d++) { if (r() < a) { var wgt = -Math.log(r() || 1e-9); ws.push(wgt); days.push({ day: d, hour: 8 + 15 * r() }); } }
      var sw = ws.reduce(function (x, y) { return x + y; }, 0) || 1;
      if (!days.length) { days.push({ day: Math.floor(r() * 7), hour: 12 }); ws = [1]; sw = 1; }
      days.forEach(function (dd, j) { dd.xp = T * ws[j] / sw; });
      out.push({ name: names[i % names.length], glyph: names[i % names.length][0], target: T, pacer: i < pacers.length, sessions: days });
    }
    return out;
  }
  /** XP a rival has at time tDays (0..7) into the week; each session ramps in over 30 minutes. */
  function kilnXPAt(rival, tDays) {
    var x = 0;
    rival.sessions.forEach(function (s) { var st = s.day + s.hour / 24, f = (tDays - st) / (0.5 / 24); x += s.xp * Math.max(0, Math.min(1, f)); });
    return x;
  }

  // ------------------------------------------------------------------ public API
  return {
    DEFAULT_RULES: DEFAULT_RULES, SELF_PROFILE: SELF_PROFILE, VENUES: VENUES, PERSONALITIES: PERSONALITIES, SIGMA: SIGMA, HARD: HARD, KILN: KILN,
    makeRng: makeRng, hash32: hash32,
    newMatch: newMatch, legalActions: legalActions, applyAction: applyAction, currentPlayer: currentPlayer, isOver: isOver,
    handSizes: handSizes, moveOutcome: moveOutcome, ranking: ranking, prizes: prizes, matchXP: matchXP, xpToNext: xpToNext, levelFromXP: levelFromXP,
    isTrio: isTrio, completers: completers, pHit: pHit, triosWith: triosWith,
    unseenCounts: unseenCounts, trayHeat: trayHeat, heatBand: heatBand, glance: glance,
    winProbability: winProbability, rolloutHandEnd: rolloutHandEnd, tablePolicies: tablePolicies, createWinEstimator: createWinEstimator, previewMove: previewMove, decided: decided,
    resolveProfile: resolveProfile, aiChooseAction: aiChooseAction, timeoutAction: timeoutAction,
    kilnRivals: kilnRivals, kilnXPAt: kilnXPAt,
    _internal: { mediumCore: mediumCore, aiView: aiView, rolloutPick: rolloutPick, seedTray: seedTray, compMask: compMask, masksOf: masksOf, fullMask: fullMask }
  };
})();
if (typeof module !== 'undefined') module.exports = Scoop;
