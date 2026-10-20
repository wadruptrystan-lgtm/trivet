/* ================= trophies ================= */
// The catalogue below is the shared source of truth: ids, shelves, tiers and rules are fixed.
// The engine, banner, ceremony and Trophies screen follow the catalogue; other modules code against the API names.

// Medal tiers. Sparks are multiplied by bankRank().mult at the moment a trophy is earned. pts feed the cabinet level.
const TR_TIERS = {
  bronze: { name: 'Bronze', col: '#C8875A', sparks: 1000, gems: 10, pts: 10 },
  silver: { name: 'Silver', col: '#C9D2DE', sparks: 5000, gems: 30, boost: 3, pts: 25 },
  gold: { name: 'Gold', col: '#F3C452', sparks: 20000, gems: 100, chest: 'silver', pts: 75 },
  platinum: { name: 'Platinum', col: '#E6EEF5', sparks: 100000, gems: 1000, chest: 'golden', chests: 3, pts: 250 },
};
// Finishing every trophy on a shelf unlocks its item. The 'encore' shelf never counts toward the Platinum.
const TR_SHELVES = [
  { id: 'first', name: 'First Steps', item: { cat: 'emote', id: 'hooray' } },
  { id: 'table', name: 'At the Table', item: { cat: 'tray', id: 'kintsugi' } },
  { id: 'town', name: 'Around Town', item: { cat: 'table', id: 'lantern' } },
  { id: 'daily', name: 'Daily Tray', item: { cat: 'avatar', id: 'rooster' } },
  { id: 'climb', name: 'Climbing', item: { cat: 'glaze', id: 'raku' } },
  { id: 'collect', name: 'Collector', item: { cat: 'avatar', id: 'peacock' } },
  { id: 'secret', name: 'Secrets', item: { cat: 'emote', id: 'foundit' } },
  { id: 'encore', name: 'Beyond Platinum', item: null },
];
// The Platinum Trivet also unlocks these, plus a platinum ring around your avatar and its title.
const TR_PLAT_SET = [{ cat: 'glaze', id: 'platinum' }, { cat: 'avatar', id: 'champion' }];

// Per-player trophy state. v 0 means a save from before trophies; trInit() migrates it and sets v 1.
function TR0() { return { v: 1, c: { wheel: 0, chests: 0 }, sets: 0, setN: [0, 0, 0, 0, 0, 0, 0, 0, 0], beat: [], got: {}, seen: {}, shelf: {}, title: null }; }

const trAll = () => statBucket('all');
const trDailyWon = () => (S.stats.venue.daily || {}).won || 0;
// Streaks as they stand today: a run whose last day was before yesterday is already broken (the lobby shows it the same way).
const trRecent = k => k === dayKey() || k === dayKey(new Date(Date.now() - 864e5));
const trStreak = () => trRecent(S.daily.lastWonDay) ? S.daily.streak : 0;
const trRun = () => trRecent(S.daily.lastDay) ? S.daily.runWins || 0 : 0;
// Every Number: up to five sets of each number count toward the forty.
const trSetsOf5 = () => { const n = (S.troph && S.troph.setN) || []; let c = 0; for (let v = 1; v <= 8; v++) c += Math.min(5, +n[v] || 0); return c; };
const trDefaultName = () => /^Player \d{4}$/.test(S.profile.name);
const TR_DEFAULT_EQUIP = { glaze: 'porcelain', num: 'fraunces', tray: 'slate', table: 'aubergine', sound: 'porcelain' };
// at(n): a counted goal. ok() says it is met; prog() gives [have, need] for the progress bar.
const trAt = (get, need) => ({ ok: () => get() >= need, prog: () => [Math.min(get(), need), need] });

// kind 'event': awarded by trEarn(id) from the code that sees it happen. kind 'state': trAuto() checks ok() on every save.
// "Win" means finishing first; a shared first place counts unless the rule says otherwise.
const TROPHIES = [
  // First Steps
  { id: 'lesson', shelf: 'first', tier: 'bronze', name: 'Lesson Learned', desc: 'Finish the lesson.', kind: 'event' },
  { id: 'first', shelf: 'first', tier: 'bronze', name: 'First Scoop', desc: 'Scoop a tray.', kind: 'state', ...trAt(() => S.stats.scoops, 1) },
  { id: 'topTable', shelf: 'first', tier: 'bronze', name: 'Top of the Table', desc: 'Finish first in any match.', kind: 'state', ...trAt(() => S.stats.wins, 1) },
  { id: 'lastchip', shelf: 'first', tier: 'bronze', name: 'Last Chip', desc: 'Scoop with the final chip of a hand.', kind: 'event' },
  { id: 'spoiler', shelf: 'first', tier: 'bronze', name: 'Spoiler', desc: 'Boil over three trays in one match.', kind: 'event' },
  { id: 'chair', shelf: 'first', tier: 'bronze', name: 'Pull Up a Chair', desc: 'Play 10 matches.', kind: 'state', ...trAt(() => S.stats.matches, 10) },
  { id: 'yours', shelf: 'first', tier: 'bronze', name: 'Make It Yours', desc: 'Change your name and your avatar.', kind: 'state', ok: () => !trDefaultName() && S.profile.avatar !== 'otter' },
  { id: 'hello', shelf: 'first', tier: 'bronze', name: 'Say Hello', desc: 'Send an emote at the table.', kind: 'state', ...trAt(() => trAll().emotes, 1) },
  // At the Table
  { id: 'full', shelf: 'table', tier: 'bronze', name: 'Full Tray', desc: 'Scoop a six-chip tray.', kind: 'state', ...trAt(() => S.stats.fullTrays, 1) },
  { id: 'commis', shelf: 'table', tier: 'bronze', name: 'Commis', desc: 'Scoop 50 trays.', kind: 'state', ...trAt(() => S.stats.scoops, 50) },
  { id: 'partie', shelf: 'table', tier: 'silver', name: 'Chef de Partie', desc: 'Scoop 250 trays.', kind: 'state', ...trAt(() => S.stats.scoops, 250) },
  { id: 'headchef', shelf: 'table', tier: 'gold', name: 'Head Chef', desc: 'Scoop 1,000 trays.', kind: 'state', title: 'Head Chef', ...trAt(() => S.stats.scoops, 1000) },
  { id: 'double', shelf: 'table', tier: 'silver', name: 'Double Scoop', desc: 'Make three Double Scoops in one match. A Double Scoop is one chip that finishes two trios, like a 5 into 5·5·6·7.', kind: 'event' },
  { id: 'trapper', shelf: 'table', tier: 'silver', name: 'Trapper', desc: 'Spring four traps in one match: feed a hot tray, then scoop it yourself.', kind: 'event' },
  { id: 'sweep', shelf: 'table', tier: 'silver', name: 'Clean Sweep', desc: 'Score the most in all three hands of a match at a table of three or four.', kind: 'event' },
  { id: 'cool', shelf: 'table', tier: 'silver', name: 'Cool Customer', desc: 'Win a match that includes a cool hand from you: three or more feeds, none leaving a tray at 30% heat or more.', kind: 'event' },
  { id: 'bookends', shelf: 'table', tier: 'silver', name: 'Bookends', desc: 'Scoop a 1·1·1 and an 8·8·8 in the same match.', kind: 'event' },
  { id: 'untouch', shelf: 'table', tier: 'silver', name: 'Untouchable', desc: 'Win at a table of three or four without a rival scooping a tray you fed last in the final hand.', kind: 'event' },
  { id: 'comeback', shelf: 'table', tier: 'gold', name: 'Comeback', desc: 'Win from last place after hand two, at a table of three or four.', kind: 'event', title: 'Comeback Kid' },
  { id: 'everynum', shelf: 'table', tier: 'gold', name: 'Every Number', desc: "Scoop five sets of every number, from 1·1·1 to 8·8·8. They don't need to be in the same match.", kind: 'state', title: 'Number Cruncher', ...trAt(trSetsOf5, 40) },
  { id: 'whitewash', shelf: 'table', tier: 'gold', name: 'Whitewash', desc: 'Win a match in which no rival scoops a single tray in the final hand.', kind: 'event', title: 'Clean Plate' },
  // Around Town
  { id: 'cafe', shelf: 'town', tier: 'bronze', name: 'Café Regular', desc: 'Win at the Corner Café.', kind: 'state', ok: () => !!S.firstWin.cafe },
  { id: 'noodle', shelf: 'town', tier: 'bronze', name: 'Noodle Night', desc: 'Win at the Noodle Bar.', kind: 'state', ok: () => !!S.firstWin.noodle },
  { id: 'tea', shelf: 'town', tier: 'bronze', name: 'Quiet Victory', desc: 'Win at the Tea House.', kind: 'state', ok: () => !!S.firstWin.tea },
  { id: 'supper', shelf: 'town', tier: 'silver', name: 'Dinner Is Served', desc: 'Win at the Supper Club.', kind: 'state', ok: () => !!S.firstWin.supper },
  { id: 'glass', shelf: 'town', tier: 'silver', name: 'Through the Glass', desc: 'Win at the Glasshouse.', kind: 'state', ok: () => !!S.firstWin.glasshouse },
  { id: 'regulars', shelf: 'town', tier: 'silver', name: 'Know the Regulars', desc: 'Finish ahead of each rival at least once: Rico, Priya, Mabel, Otto, June and Sol.', kind: 'state', ...trAt(() => S.troph.beat.length, 6) },
  { id: 'pressure', shelf: 'town', tier: 'silver', name: 'Cool Under Pressure', desc: 'Win at the Glasshouse without the timer ever running out on you.', kind: 'event' },
  { id: 'headtable', shelf: 'town', tier: 'gold', name: 'Head of the Table', desc: 'Win at the Supper Club with Sol in last place and no scoop for him in the final hand.', kind: 'event', title: 'Head of the Table' },
  { id: 'glassact', shelf: 'town', tier: 'gold', name: 'Glass Act', desc: 'Win at the Glasshouse in Pro view.', kind: 'event', title: 'Glass Act' },
  // Daily Tray
  { id: 'brew', shelf: 'daily', tier: 'bronze', name: 'Morning Brew', desc: 'Win the Daily Tray.', kind: 'state', ...trAt(trDailyWon, 1) },
  { id: 'brag', shelf: 'daily', tier: 'bronze', name: 'Bragging Rights', desc: 'Copy a Daily Tray result to share it.', kind: 'event' },
  { id: 'hotstreak', shelf: 'daily', tier: 'silver', name: 'Hot Streak', desc: 'Win the Daily Tray three days in a row.', kind: 'state', ...trAt(trStreak, 3) },
  { id: 'dailyreg', shelf: 'daily', tier: 'gold', name: 'Daily Regular', desc: "Win 15 Daily Trays. They don't need to be in a row.", kind: 'state', title: 'Daily Regular', ...trAt(trDailyWon, 15) },
  // Climbing
  { id: 'appr', shelf: 'climb', tier: 'bronze', name: 'Apprentice', desc: 'Reach level 10.', kind: 'state', ...trAt(() => level().level, 10) },
  { id: 'journ', shelf: 'climb', tier: 'silver', name: 'Journeyman', desc: 'Reach level 25.', kind: 'state', ...trAt(() => level().level, 25) },
  { id: 'master', shelf: 'climb', tier: 'gold', name: 'Master Potter', desc: 'Reach level 40.', kind: 'state', title: 'Master Potter', ...trAt(() => level().level, 40) },
  { id: 'warm', shelf: 'climb', tier: 'bronze', name: 'Getting Warm', desc: 'Reach Warm rank: a best bankroll of 10,000 Sparks.', kind: 'state', ...trAt(() => bankRank().best, 1e4) },
  { id: 'hot', shelf: 'climb', tier: 'silver', name: 'Running Hot', desc: 'Reach Hot rank: a best bankroll of 100,000 Sparks.', kind: 'state', ...trAt(() => bankRank().best, 1e5) },
  { id: 'scorch', shelf: 'climb', tier: 'gold', name: 'Scorching', desc: 'Reach Scorching rank: a best bankroll of 1,000,000 Sparks.', kind: 'state', title: 'Scorching', ...trAt(() => bankRank().best, 1e6) },
  { id: 'promoted', shelf: 'climb', tier: 'bronze', name: 'Promoted', desc: 'Move up a league in the Kiln.', kind: 'state', ok: () => S.kiln.tier >= 1 },
  { id: 'china', shelf: 'climb', tier: 'silver', name: 'Fine China', desc: 'Reach the Porcelain league in the Kiln.', kind: 'state', ok: () => S.kiln.tier >= 3 },
  { id: 'goldleaf', shelf: 'climb', tier: 'gold', name: 'Gold Leaf', desc: 'Reach Gold Leaf, the top league in the Kiln.', kind: 'state', title: 'Gold Leaf', ok: () => S.kiln.tier >= 4 },
  { id: 'track', shelf: 'climb', tier: 'bronze', name: 'On the Track', desc: 'Reach tier 10 of a season.', kind: 'state', ...trAt(() => seasonTier(), 10) },
  { id: 'fullseason', shelf: 'climb', tier: 'silver', name: 'Full Season', desc: 'Reach tier 40 of a season. The free track is enough.', kind: 'state', ...trAt(() => seasonTier(), 40) },
  // Collector
  { id: 'tricks', shelf: 'collect', tier: 'bronze', name: 'Tricks of the Trade', desc: 'Use a Peek and a Swap.', kind: 'state', ok: () => trAll().peeksUsed > 0 && trAll().swapsUsed > 0 },
  { id: 'reels3', shelf: 'collect', tier: 'bronze', name: 'Three in a Row', desc: 'Line up three of a kind on the Lucky Reels.', kind: 'event' },
  { id: 'wheel10', shelf: 'collect', tier: 'bronze', name: 'Round and Round', desc: 'Spin the Prize Wheel 10 times.', kind: 'state', ...trAt(() => S.troph.c.wheel, 10) },
  { id: 'dressed', shelf: 'collect', tier: 'bronze', name: 'Dressed for Dinner', desc: "Use a glaze, numeral style, tray, table and sound that aren't the defaults, all at once.", kind: 'state', ok: () => Object.keys(TR_DEFAULT_EQUIP).every(k => S.equip[k] !== TR_DEFAULT_EQUIP[k]) },
  { id: 'chests', shelf: 'collect', tier: 'silver', name: 'Treasure Hunter', desc: 'Open 10 chests.', kind: 'state', ...trAt(() => S.troph.c.chests, 10) },
  { id: 'wardrobe', shelf: 'collect', tier: 'silver', name: 'Wardrobe', desc: 'Own 15 avatars.', kind: 'state', ...trAt(() => S.owned.avatar.length, 15) },
  { id: 'chatter', shelf: 'collect', tier: 'silver', name: 'Chatterbox', desc: 'Send 100 emotes.', kind: 'state', ...trAt(() => trAll().emotes, 100) },
  // Secrets: hidden until earned
  { id: 'cheers', shelf: 'secret', tier: 'bronze', hidden: true, name: 'Cheers, Dear', desc: "Answer Mabel's 🍵 with a 👍.", hint: 'Mabel likes a polite reply.', kind: 'event' },
  { id: 'generous', shelf: 'secret', tier: 'bronze', hidden: true, name: 'Too Generous', desc: 'Let a rival scoop six chips from a tray you fed last.', hint: 'Someone enjoyed your cooking.', kind: 'event' },
  { id: 'steam', shelf: 'secret', tier: 'bronze', hidden: true, name: 'Steam Room', desc: 'Boil over two trays in a single hand.', hint: "It's getting hot in here.", kind: 'event' },
  { id: 'sevens', shelf: 'secret', tier: 'bronze', hidden: true, name: 'Lucky Sevens', desc: 'Scoop 7·7·7.', hint: 'Some numbers are luckier than others.', kind: 'state', ok: () => !!(S.troph.sets & (1 << 7)) },
  { id: 'nightowl', shelf: 'secret', tier: 'bronze', hidden: true, name: 'Night Owl', desc: 'Finish a match between midnight and 4am.', hint: 'The tables never close.', kind: 'event' },
  { id: 'turnabout', shelf: 'secret', tier: 'silver', hidden: true, name: 'Turnabout', desc: "Twice in one match, take Sol's own trap: scoop a tray he fed last while he held the chip that finishes it.", hint: 'Some traps work both ways.', kind: 'event' },
  { id: 'photo', shelf: 'secret', tier: 'silver', hidden: true, name: 'Photo Finish', desc: 'Win a match level on points, on a tiebreak.', hint: 'Too close to call.', kind: 'event' },
  { id: 'nowaste', shelf: 'secret', tier: 'silver', hidden: true, name: 'Nothing Wasted', desc: 'Finish a match at a table of four where no tray boils over.', hint: 'Not a drop spilled.', kind: 'event' },
  { id: 'nerve', shelf: 'secret', tier: 'silver', hidden: true, name: 'Hold Your Nerve', desc: 'Scoop at the Glasshouse with 2 seconds or less on the clock.', hint: 'Fortune favours the slow.', kind: 'event' },
  // The Platinum: every trophy above (not the encore shelf)
  { id: 'plat', shelf: null, tier: 'platinum', name: 'Platinum Trivet', desc: "Earn every other trophy in the cabinet. Beyond Platinum trophies don't count.", kind: 'auto', title: 'Platinum Trivet' },
  // Beyond Platinum
  { id: 'whitehot', shelf: 'encore', tier: 'gold', name: 'White-Hot', desc: 'Reach White-Hot rank: a best bankroll of 10,000,000 Sparks.', kind: 'state', title: 'White-Hot', ...trAt(() => bankRank().best, 1e7) },
  { id: 'molten', shelf: 'encore', tier: 'gold', name: 'Molten', desc: 'Reach Molten rank: a best bankroll of 100,000,000 Sparks.', kind: 'state', title: 'Molten', ...trAt(() => bankRank().best, 1e8) },
  { id: 'grand', shelf: 'encore', tier: 'gold', name: 'Grand Master', desc: 'Reach level 50.', kind: 'state', title: 'Grand Master', ...trAt(() => level().level, 50) },
  { id: 'podium', shelf: 'encore', tier: 'gold', name: 'On the Podium', desc: 'Finish in the top three of the Gold Leaf league.', kind: 'state', title: 'Kiln Royalty', ok: () => owns('glaze', 'goldleaf') },
  { id: 'legend', shelf: 'encore', tier: 'gold', name: 'Glasshouse Legend', desc: 'Win 50 matches at the Glasshouse.', kind: 'state', title: 'Glasshouse Legend', ...trAt(() => (S.stats.venue.glasshouse || {}).won || 0, 50) },
  { id: 'iron', shelf: 'encore', tier: 'gold', name: 'Iron Streak', desc: "Win 14 Daily Trays without missing a day. A loss doesn't break the run; a day without the Daily does.", kind: 'state', title: 'Iron Will', ...trAt(trRun, 14) },
];
const trOf = id => TROPHIES.find(t => t.id === id);
// The 61 trophies the Platinum needs.
const TR_BASE = TROPHIES.filter(t => t.shelf && t.shelf !== 'encore');
// Sparks already paid by the eight achievements that came before trophies (for the one-time top-up).
const TR_OLD_SPARKS = { first: 100, full: 500, spoiler: 300, trapper: 500, comeback: 500, sweep: 400, lastchip: 300, glassact: 2000 };

/* ---------- engine ---------- */
// One award path (trGive) serves trEarn, trAuto and the migration: rewards are applied and stored in S.troph.got
// before anything is shown, so leaving or reloading never loses them; banners and the ceremony only replay them.
const TR_BOOST = ['peeks', 'swaps', 'spins'];
const TR_SILVER = TROPHIES.filter(t => t.tier === 'silver').map(t => t.id); // booster rotation order
const TR_RIVALS = ['rico', 'priya', 'mabel', 'otto', 'june', 'sol'];
const TR_TIER_ORDER = ['bronze', 'silver', 'gold'];
const TR_MAX_PTS = TROPHIES.reduce((a, t) => a + TR_TIERS[t.tier].pts, 0);
// Names for the trophy-only items, used only if the catalogue entry is missing.
const TR_ITEM_FB = { 'emote:hooray': ['Hooray', 'epic'], 'emote:foundit': ['Found it', 'legendary'], 'tray:kintsugi': ['Kintsugi', 'legendary'], 'table:lantern': ['Lantern Night', 'legendary'],
  'avatar:rooster': ['Rooster', 'epic'], 'avatar:peacock': ['Peacock', 'legendary'], 'glaze:raku': ['Raku', 'legendary'], 'glaze:platinum': ['Platinum', 'mythic'], 'avatar:champion': ['Champion', 'mythic'] };
const TR_LOG = [];            // {id, got} in the order earned this session (trMark / trSince)
let trReady = false, trBusy = false, trQuiet = false;

// S.troph with every field present (saves can come from anywhere: old builds, other tabs, hot reload).
function trS() {
  let T = S.troph;
  if (!T || typeof T !== 'object') T = S.troph = { ...TR0(), v: 0 };
  if (!T.c || typeof T.c !== 'object') T.c = { wheel: 0, chests: 0 };
  for (const k of ['got', 'seen', 'shelf']) if (!T[k] || typeof T[k] !== 'object') T[k] = {};
  if (!Array.isArray(T.beat)) T.beat = [];
  if (typeof T.sets !== 'number') T.sets = 0;
  if (!Array.isArray(T.setN) || T.setN.length !== 9) T.setN = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  if (!S.ach || typeof S.ach !== 'object') S.ach = {};
  return T;
}
const trTier = t => TR_TIERS[t.tier];
// Sounds only once the page has had a tap or key: before that the browser refuses to start audio (and logs it).
function trSound(k) { try { const ua = navigator.userActivation; if (!ua || ua.hasBeenActive) SND[k](); } catch (e) { } }
const trShelf = id => TR_SHELVES.find(s => s.id === id);
function trProg(t) { try { const [a, b] = t.prog(); return [Math.max(0, +a || 0), Math.max(1, +b || 1)]; } catch (e) { return null; } }
function trInTutorial() { try { return CUR === 'table' && typeof M !== 'undefined' && M.mode === 'tutorial'; } catch (e) { return false; } }
function trDate(k, long) {
  if (typeof k !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return '';
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' });
}
function trItemName(cat, id) {
  const it = anyItem(cat, id), fb = TR_ITEM_FB[cat + ':' + id];
  return `${it ? it.name : fb ? fb[0] : id} ${CAT_ONE[cat] || cat}`;
}

// The tier's rewards at today's bankroll rank. Platinum adds its item set.
function trRewards(t, mult = bankRank().mult) {
  const T = trTier(t), out = [{ type: 'sparks', n: Math.round(T.sparks * mult) }, { type: 'gems', n: T.gems }];
  if (T.boost) out.push({ type: TR_BOOST[Math.max(0, TR_SILVER.indexOf(t.id)) % 3], n: T.boost });
  if (T.chest) for (let i = 0; i < (T.chests || 1); i++) out.push({ type: 'chest', id: T.chest });
  if (t.id === 'plat') TR_PLAT_SET.forEach(x => out.push({ type: 'item', cat: x.cat, id: x.id }));
  return out;
}
// Trophy-only items go straight in with grant(); one you somehow own already turns into Gems like any duplicate.
function trGrantItem(cat, id) {
  if (anyItem(cat, id)) return applyReward({ type: 'item', cat, id });
  const fb = TR_ITEM_FB[cat + ':' + id] || [id, 'legendary'];
  if (S.owned[cat]) grant(cat, id);
  return { type: 'item', cat, id, rarity: fb[1], name: fb[0], sub: `New ${CAT_ONE[cat] || cat}` };
}
// Award one trophy. o.carry: an achievement from before trophies (already in S.ach) gets its top-up instead.
function trGive(t, o = {}) {
  const T = trS();
  if (!t || (!o.carry && S.ach[t.id])) return null;
  if (!o.carry) S.ach[t.id] = dayKey();
  const list = trRewards(t);
  if (o.carry) { list[0].n = Math.max(0, list[0].n - (TR_OLD_SPARKS[t.id] || 0)); if (!list[0].n) list.shift(); }
  const got = list.map(r => r.type === 'item' ? trGrantItem(r.cat, r.id) : applyReward(r));
  T.got[t.id] = got;
  trShelfDone(t.shelf && trShelf(t.shelf), got);
  if (o.carry) (T.carry || (T.carry = {}))[t.id] = 1;
  const e = { id: t.id, got };
  TR_LOG.push(e);
  if (t.id === 'plat') { T.cer = 1; trCerQueue(); } else if (!trQuiet) trBnQueue(t);
  updatePills();
  return e;
}
// A finished shelf grants its item once, as part of the last trophy's rewards.
function trShelfDone(sh, got) {
  const T = trS();
  if (!sh || T.shelf[sh.id] || !TROPHIES.every(x => x.shelf !== sh.id || S.ach[x.id])) return false;
  T.shelf[sh.id] = dayKey();
  if (sh.item) got.push(trGrantItem(sh.item.cat, sh.item.id));
  return true;
}
// Every met state trophy, then the Platinum; again until nothing changes (a Sparks reward can lift the rank).
function trSweep() {
  const T = trS();
  // a shelf whose trophies all arrived some other way (an edited or merged save) still pays its item
  TR_SHELVES.forEach(sh => { if (!T.shelf[sh.id] && TROPHIES.every(x => x.shelf !== sh.id || S.ach[x.id])) { const last = TROPHIES.filter(x => x.shelf === sh.id).pop(); trShelfDone(sh, T.got[last.id] || (T.got[last.id] = [])); } });
  for (let pass = 0, more = true; more && pass < 12; pass++) {
    more = false;
    for (const t of TROPHIES) {
      if (t.kind !== 'state' || S.ach[t.id]) continue;
      let ok = false;
      try { ok = !!t.ok(); } catch (e) { }
      if (ok && trGive(t)) more = true;
    }
    if (!S.ach.plat && TR_BASE.every(t => S.ach[t.id]) && trGive(trOf('plat'))) more = true;
  }
}
function trAuto() {
  if (!trReady || trBusy || !S || trInTutorial()) return;
  trBusy = true;
  try { trSweep(); } catch (e) { } finally { trBusy = false; }
}
function trEarn(id) {
  try {
    const t = trOf(id);
    if (!S || !t || t.kind !== 'event' || S.ach[id]) return false;
    if (!trGive(t)) return false;
    if (!trBusy) save();
    return true;
  } catch (e) { return false; }
}
function trCount(k, n = 1) { if (!S || typeof k !== 'string') return; const c = trS().c; c[k] = (+c[k] || 0) + (+n || 0); }
function trNoteSet(v) { v = +v; if (S && Number.isInteger(v) && v >= 1 && v <= 8) { const T = trS(); T.sets |= 1 << v; T.setN[v] = (+T.setN[v] || 0) + 1; } }
function trNoteBeat(pers) { if (!S || !TR_RIVALS.includes(pers)) return; const b = trS().beat; if (!b.includes(pers)) b.push(pers); }
function trMark() { return TR_LOG.length; }
function trSince(mark) { return TR_LOG.slice(Math.max(0, mark | 0)).map(e => ({ id: e.id, got: e.got })); }

/* ---------- boot and the one-time move from achievements ---------- */
function trInit() {
  if (!S) return;
  const T = trS();
  trBnEl();
  const m = T.v === 0 ? trMigrate() : null;
  trReady = true;
  save();
  if (m && (m.carried.length || m.fresh.length)) { updatePills(); if (CUR === 'home') renderHome(); trWelcome(m); }
  if (T.cer) trCerQueue();
}
// Old achievements keep their date and get the difference to their new reward; the lesson and every state trophy
// already met are awarded quietly; one welcome sheet sums it up.
function trMigrate() {
  const T = trS(), carried = [], fresh = [];
  trQuiet = true; trBusy = true;
  try {
    TROPHIES.forEach(t => { if (S.ach[t.id] && TR_OLD_SPARKS[t.id] != null && !T.got[t.id]) { const e = trGive(t, { carry: true }); if (e) carried.push(e); } });
    const n0 = TR_LOG.length;
    if (S.tutorialDone) trGive(trOf('lesson'));
    trSweep();
    fresh.push(...TR_LOG.slice(n0));
  } catch (e) { } finally { trQuiet = false; trBusy = false; }
  T.v = 1;
  return { carried, fresh };
}
function trWelcome(m) {
  const got = trMergeGot([...m.carried, ...m.fresh].flatMap(e => e.got), true), c = m.carried.length, f = m.fresh.length;
  sheet((p, close) => {
    const see = h('button', { class: 'btn' }, 'See rewards'), open = h('button', { class: 'btn cta' }, 'Open the cabinet');
    see.addEventListener('click', () => { close(); revealGot(got, { title: 'Trophy rewards', eyebrow: `${c + f} troph${c + f === 1 ? 'y' : 'ies'}` }); });
    open.addEventListener('click', () => { close(); trOpenCabinet(); const b = $('#sub-back'); if (b) b.focus({ preventScroll: true }); });
    p.append(h('div', { class: 'tr-wart', 'aria-hidden': 'true' }, trMedal('bronze', 52), trMedal('gold', 70), trMedal('silver', 52)),
      h('h3', {}, 'Meet the Trophy Cabinet'),
      h('p', {}, 'Achievements are now trophies: bronze, silver and gold medals on seven shelves, and the Platinum Trivet for earning every one.'),
      h('div', { class: 'facts tr-wfacts' }, h('div', {}, h('span', {}, 'CARRIED OVER'), h('b', {}, String(c))), h('div', {}, h('span', {}, 'UNLOCKED NOW'), h('b', {}, String(f)))),
      h('p', { class: 'tr-fine' }, c ? 'Achievements you had were topped up to their trophy rewards, less the Sparks they already paid. Everything is in your wallet.' : 'Their rewards are already in your wallet.'),
      h('div', { class: 'btnrow' }, see, open));
  }, { label: 'Meet the Trophy Cabinet' });
}
// Add up Sparks, Gems and boosters across several trophies so a combined reveal stays short.
// flat: chests are opened into the list too (the Platinum's three, or a whole migration).
function trMergeGot(list, flat) {
  const sum = {}, out = [];
  (flat ? list.flatMap(g => g && g.contents ? g.contents : [g]) : list).forEach(g => {
    if (!g) return;
    if (CURS.includes(g.type) && !g.dupe) { if (sum[g.type]) sum[g.type].n += g.n; else out.push(sum[g.type] = { ...g }); }
    else out.push(g);
  });
  for (const k in sum) sum[k].name = amountText(k, sum[k].n);
  return out;
}

/* ---------- medals ---------- */
// A small round trivet: a disc in the tier colour on three short feet, the trivet mark pressed into its face.
const TR_MEDAL_G = { bronze: ['#F6CFAA', '#C8875A', '#7A4526'], silver: ['#FFFFFF', '#C9D2DE', '#7C8798'], gold: ['#FFF3C2', '#F3C452', '#A97A1E'], platinum: ['#FFFFFF', '#DCE6F0', '#8796AD'] };
(function trGradients() {
  const defs = Object.entries(TR_MEDAL_G).map(([k, [a, b, c]]) => `<linearGradient id="tr-g-${k}" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`).join('')
    + '<linearGradient id="tr-g-iri" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9E4FF" stop-opacity=".0"/><stop offset=".45" stop-color="#D9CCFF" stop-opacity=".55"/><stop offset=".7" stop-color="#C6F1EC" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>';
  document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>${defs}</defs></svg>`);
})();
function trMedal(tier, size = 40, o = {}) {
  const dk = TR_MEDAL_G[tier][2];
  const mark = o.q ? `<text x="20" y="22.4" text-anchor="middle" font-size="14" font-weight="800" font-family="Manrope,system-ui,sans-serif" fill="#251C2B" fill-opacity=".72">?</text>`
    : `<circle cx="20" cy="15.6" r="4.6" fill="none" stroke="#000" stroke-opacity=".26" stroke-width="1.7"/><circle cx="20" cy="16.1" r="4.6" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".8"/><circle cx="16.9" cy="22.6" r="1.05" fill="#000" fill-opacity=".26"/><circle cx="20" cy="23.4" r="1.05" fill="#000" fill-opacity=".26"/><circle cx="23.1" cy="22.6" r="1.05" fill="#000" fill-opacity=".26"/>`;
  const svg = `<svg viewBox="0 0 40 44" aria-hidden="true" focusable="false">`
    + [[10.8, 36.9], [20, 38.9], [29.2, 36.9]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="${TR_MEDAL_G[tier][1]}" stroke="${dk}" stroke-width=".9"/>`).join('')
    + `<circle cx="20" cy="18" r="15.5" fill="#000" fill-opacity=".28"/><circle cx="20" cy="17" r="15.5" fill="url(#tr-g-${tier})"/>`
    + (tier === 'platinum' ? '<circle cx="20" cy="17" r="15.5" fill="url(#tr-g-iri)"/>' : '')
    + `<circle cx="20" cy="17" r="15" fill="none" stroke="#000" stroke-opacity=".2"/><circle cx="20" cy="17" r="11.2" fill="#000" fill-opacity=".07"/><circle cx="20" cy="17" r="11.2" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.1"/>`
    + `<path d="M8.6 11.5A13 13 0 0 1 17 4.3" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.8" stroke-linecap="round"/>${mark}</svg>`;
  return h('span', { class: `tr-medal t-${tier}${o.off ? ' off' : ''}${o.cls ? ' ' + o.cls : ''}`, style: `--ms:${size}px`, 'aria-hidden': 'true', html: svg });
}
// Reward chips for a list of rewards (planned or received).
function trRewChips(list, o = {}) {
  const rows = [];
  list.forEach(r => { const l = rows[rows.length - 1]; if (r.type === 'chest' && l && l.type === 'chest' && l.id === r.id) l.k++; else rows.push({ ...r, k: 1 }); });
  return h('span', { class: 'tr-rew' + (o.cls ? ' ' + o.cls : '') }, rows.map(r => {
    const txt = CURS.includes(r.type) ? (r.n >= 1e6 ? short(r.n) : fmt(r.n)) : r.name || '';
    if (r.type === 'chest') return h('span', { class: 'tr-rc', html: curIcon('chest-' + r.id, o.size || 15) }, h('span', {}, r.k > 1 ? `${r.k} ${CHESTS[r.id].name}s` : CHESTS[r.id].name));
    if (r.type === 'item') return h('span', { class: 'tr-rc' }, rewardIconEl(r, o.size || 15), h('span', {}, r.dupe ? `+${r.dupe} Gems` : o.long ? trItemName(r.cat, r.id) : r.name));
    return h('span', { class: 'tr-rc', html: curIcon(r.type, o.size || 15) }, h('span', {}, o.long ? amountText(r.type, r.n) : txt));
  }));
}

/* ---------- banner ---------- */
// One polite live region over everything but full-screen overlays. It never takes taps or focus; trophies queue.
const TR_BN = { q: [], busy: false, tm: 0 };
function trBnEl() {
  let el = $('#tr-banner');
  if (el) return el;
  el = h('div', { id: 'tr-banner', class: 'tr-bn', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, h('span', { class: 'sr-only tr-bn-sr' }), h('div', { class: 'tr-bn-card', 'aria-hidden': 'true' }));
  $('#app').append(el);
  // Keep clear of a toast that is showing at the same time.
  const ts = $('#toast');
  if (ts && typeof MutationObserver === 'function') new MutationObserver(trBnShift).observe(ts, { attributes: true, attributeFilter: ['class'] });
  return el;
}
function trBnShift() {
  const el = $('#tr-banner'), ts = $('#toast'); if (!el) return;
  let y = ts && ts.classList.contains('show') ? ts.offsetHeight + 8 : 0;
  // a lesson card at the top of the table stays readable: the banner sits just below it
  const co = CUR === 'table' && $('#table .coach'), app = $('#app');
  if (co && app) { const r = co.getBoundingClientRect(), a = app.getBoundingClientRect(); if (r.top - a.top < 160) y = Math.max(y, r.bottom - a.top); }
  el.style.setProperty('--tr-bn-y', `${Math.round(y)}px`);
}
function trBnQueue(t) { TR_BN.q.push(t); if (!TR_BN.busy) { TR_BN.busy = true; setTimeout(trBnNext, 60); } }
// A wheel spin or reels pull already holds its prize; a banner now would give the result away.
const trArcBusy = () => { try { return ARC_W.busy || ARC_R.busy; } catch (e) { return false; } };
function trBnNext() {
  if (!TR_BN.q.length) { TR_BN.busy = false; return; }
  if (overlayOpen() || trArcBusy()) { setTimeout(trBnNext, 500); return; }  // shown after the reveal, ceremony or spin finishes
  // A long queue (several at once) becomes one banner, so nothing keeps sliding in for minutes.
  const many = TR_BN.q.length >= 4 ? TR_BN.q.splice(0) : null, el = trBnEl(), card = $('.tr-bn-card', el);
  const t = many ? many.reduce((a, b) => TR_TIER_ORDER.indexOf(b.tier) > TR_TIER_ORDER.indexOf(a.tier) ? b : a) : TR_BN.q.shift(), tier = trTier(t);
  const eye = many ? 'Trophies unlocked' : t.hidden ? 'Secret trophy found' : 'Trophy unlocked', name = many ? `${many.length} new trophies` : t.name;
  card.style.setProperty('--tc', tier.col);
  card.replaceChildren(...[trMedal(t.tier, 38), h('span', { class: 'tr-bn-tx' }, h('span', { class: 'tr-bn-eye' }, eye), h('b', {}, name)), many ? null : h('span', { class: 'tr-bn-tier' }, tier.name)].filter(Boolean));
  $('.tr-bn-sr', el).textContent = many ? `${many.length} trophies unlocked: ${many.map(x => x.name).join(', ')}.` : `${eye}: ${t.name}, ${tier.name.toLowerCase()}.`;
  trBnShift();
  el.classList.add('show');
  trSound(t.tier === 'gold' ? 'fanfare' : 'tick');
  TR_BN.tm = setTimeout(trBnHide, 3000);
}
function trBnHide() {
  const el = $('#tr-banner'); clearTimeout(TR_BN.tm); TR_BN.tm = 0;
  if (!el || !el.classList.contains('show')) return;
  el.classList.remove('show');
  setTimeout(() => { $('.tr-bn-sr', el).textContent = ''; trBnNext(); }, reduced() ? 120 : 460);
}

/* ---------- the Platinum ceremony ---------- */
// Waits for the results screen during a match (trAfterResult), and for any reveal or sheet; outside matches also for banners.
let trCerT = 0;
function trCerQueue() { if (!trCerT) trCerT = setTimeout(() => trCerTry(false), 450); }
function trCerTry(now) {
  trCerT = 0;
  if (!S || !S.troph || !S.troph.cer || $('#app > .tr-cer')) return;
  if (overlayOpen() || sheetOpen() || trArcBusy() || (!now && (TR_BN.busy || CUR === 'table'))) { trCerT = setTimeout(() => trCerTry(now), 700); return; }
  trCeremony();
}
// The results screen is up: its Trophies card already lists this match's trophies, so their banners stop here.
function trAfterResult() {
  TR_BN.q.length = 0; trBnHide();
  if (!S || !S.troph || !S.troph.cer) return;
  clearTimeout(trCerT); trCerT = 0; trCerTry(true);
}
function trCeremony() {
  const T = trS(), got = T.got.plat || [], fi = captureFocus();
  const btn = h('button', { class: 'btn cta tr-cer-btn', type: 'button' }, 'See your rewards');
  const ov = h('div', { class: 'fullov tr-cer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tr-cer-h', 'aria-describedby': 'tr-cer-p' },
    h('div', { class: 'tr-cer-rays', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5].map(i => h('i', { style: `--i:${i}` }))),
    h('div', { class: 'tr-cer-stage' },
      h('div', { class: 'tr-cer-medal' }, trMedal('platinum', 176)),
      h('div', { class: 'eyebrow' }, `All ${TR_BASE.length} trophies`),
      h('h2', { id: 'tr-cer-h' }, 'Platinum Trivet'),
      h('p', { id: 'tr-cer-p' }, 'Every trophy on the seven shelves is yours. The whole kitchen is applauding.'),
      btn));
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    T.cer = 0; save();
    closeOverlay(ov); restoreFocus(fi);
    if (got.length) revealGot(trMergeGot(got), { title: 'Platinum Trivet', skipIntro: true });
    else refresh();
  };
  btn.addEventListener('click', finish);
  ov.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); }
    else if (e.key === 'Tab') { e.preventDefault(); btn.focus(); }
  });
  openOverlay(ov);
  trSound('fanfare');
  btn.focus({ preventScroll: true });
}

/* ---------- results card ---------- */
function trResultCard(list) {
  const es = (list || []).filter(e => e && trOf(e.id));
  if (!es.length) return null;
  const n = es.length, see = h('button', { class: 'btn wide tr-rsee', 'data-fk': 'tr-res-see', html: `${icon('gift', 18)}<span>See rewards</span>` });
  see.addEventListener('click', () => revealGot(trMergeGot(es.flatMap(e => e.got || [])), { title: 'Trophy rewards', eyebrow: n === 1 ? 'Trophy' : `${n} trophies` }));
  return h('section', { class: 'card tr-res', 'aria-labelledby': 'tr-res-h' },
    h('div', { class: 'tr-reshead' }, h('h2', { class: 'eyebrow', id: 'tr-res-h' }, 'Trophies'), h('span', {}, `${n} troph${n === 1 ? 'y' : 'ies'} unlocked`)),
    h('ul', { class: 'tr-reslist' }, es.map(e => {
      const t = trOf(e.id);
      return h('li', {}, trMedal(t.tier, 30), h('b', {}, t.name), h('span', {}, trTier(t).name + (t.hidden ? ' · Secret' : '')));
    })), see);
}

/* ---------- the Trophies screen ---------- */
let trCabF = 'all', trCabNew = new Set();
const trHintShown = new Set();
let trCabArc = false;
function trOpenCabinet() {
  trCabF = 'all'; trCabNew = new Set(); trCabArc = true;
  trMarkSeen();
  pushScreen('Trophies', trCabBuild, { help: trHowSheet, refresh: () => { trMarkSeen(); trCabArc = false; rebuildViews($('#sub-views'), trCabBuild); } });
}
// Earned trophies the player hasn't seen yet get a New tag for this visit, then count as seen.
function trMarkSeen() {
  const T = trS(); let ch = false;
  TROPHIES.forEach(t => { if (S.ach[t.id] && !T.seen[t.id]) { T.seen[t.id] = 1; trCabNew.add(t.id); ch = true; } });
  if (ch) save();
}
function trCabBuild(box) {
  box.append(trHeadCard());
  const near = trCabF === 'done' ? [] : TROPHIES.filter(t => !S.ach[t.id] && !t.hidden && t.prog).map((t, i) => { const p = trProg(t); return { t, i, r: p ? p[0] / p[1] : 0 }; })
    .filter(x => x.r > 0 && x.r < 1).sort((a, b) => b.r - a.r || a.i - b.i).slice(0, 3);
  if (near.length) box.append(h('section', { 'aria-labelledby': 'tr-h-near' }, h('h2', { class: 'sec', id: 'tr-h-near' }, 'Almost there'), h('div', { class: 'tr-list' }, near.map(x => trRow(x.t, 'near')))));
  const seg = h('div', { class: 'seg tr-seg', role: 'group', 'aria-label': 'Show trophies' });
  [['all', 'All'], ['todo', 'To do'], ['done', 'Earned']].forEach(([k, l]) => {
    const b = h('button', { 'aria-pressed': String(trCabF === k), 'data-fk': 'tr-f:' + k }, l);
    b.addEventListener('click', () => { if (trCabF === k) return; trCabF = k; refresh(); });
    seg.append(b);
  });
  box.append(seg);
  let shown = 0;
  TR_SHELVES.forEach(sh => {
    const all = TROPHIES.filter(t => t.shelf === sh.id), n = all.filter(t => S.ach[t.id]).length;
    const rows = all.filter(t => trCabF === 'all' || (trCabF === 'todo' ? !S.ach[t.id] : !!S.ach[t.id]));
    if (!rows.length) return;
    shown++;
    const hid = 'tr-h-' + sh.id, kids = [h('h2', { class: 'sec', id: hid }, sh.name, h('small', {}, `${n} of ${all.length}`))];
    if (sh.id === 'encore') kids.push(h('p', { class: 'tr-note' }, "Extra trophies for after the Platinum. They don't count toward it."));
    if (sh.item) {
      const done = !!trS().shelf[sh.id], nm = trItemName(sh.item.cat, sh.item.id);
      kids.push(h('div', { class: 'tr-shitem' + (done ? ' on' : '') }, h('span', { class: 'tr-shico' }, rewardIconEl({ type: 'item', ...sh.item }, 30)),
        h('span', { class: 'tr-shtx' }, done ? h('span', {}, h('b', {}, nm), ' unlocked') : h('span', {}, 'Finish the shelf: ', h('b', {}, nm))),
        h('span', { class: 'tr-shst', html: done ? icon('check', 16) : icon('lock', 15) })));
    }
    kids.push(h('div', { class: 'tr-list' }, rows.map(t => trRow(t, 'row'))));
    box.append(h('section', { class: 'tr-shelf', 'aria-labelledby': hid }, kids));
  });
  if (!shown) box.append(h('div', { class: 'card tr-empty' }, trMedal(trCabF === 'done' ? 'bronze' : 'platinum', 64, { off: trCabF === 'done' }),
    h('h3', {}, trCabF === 'done' ? 'Nothing on the shelves yet' : 'Every trophy earned'),
    h('p', {}, trCabF === 'done' ? 'Your first trophy is one scoop away.' : 'There is nothing left to win. Well played.')));
}
function trHeadCard() {
  const sm = trSummary(), p = sm.earned / sm.total, R = 52, C = 2 * Math.PI * R, pc = Math.floor(p * 100);
  const ring = h('button', { class: 'tr-ring', 'data-fk': 'tr-plat', 'aria-label': `Platinum Trivet, ${sm.plat ? `earned ${trDate(S.ach.plat, true)}` : 'locked'}. ${sm.earned} of ${sm.total} trophies. Details` },
    h('span', { class: 'tr-ringsvg', html: `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false"><circle class="tr-rtrk" cx="60" cy="60" r="${R}"/>${p > 0 ? `<circle class="tr-rarc tr-rglow${trCabArc ? ' tr-arcin' : ''}" cx="60" cy="60" r="${R}" style="--len:${(C * p).toFixed(1)};--c:${C.toFixed(1)}" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/><circle class="tr-rarc${trCabArc ? ' tr-arcin' : ''}" cx="60" cy="60" r="${R}" style="--len:${(C * p).toFixed(1)};--c:${C.toFixed(1)}" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/>` : ''}</svg>` }),
    trMedal('platinum', 62, { off: !sm.plat }));
  ring.addEventListener('click', () => trDetail('plat'));
  const lvP = (sm.points - (sm.level - 1) * 100) / 100, full = sm.points >= TR_MAX_PTS;
  const ttl = trTitle(), tb = h('button', { class: 'tr-titlebtn', 'data-fk': 'tr-title', 'aria-label': `Title: ${ttl || 'none'}. Change title` },
    h('span', { class: 'tr-tlab' }, 'Title'), h('b', { class: ttl ? '' : 'none' }, ttl || 'None'), h('span', { class: 'tr-chev', html: icon('chev', 16) }));
  tb.addEventListener('click', trTitleSheet);
  return h('section', { class: 'card tr-head', 'aria-label': 'Your cabinet' },
    h('div', { class: 'tr-htop' }, ring,
      h('div', { class: 'tr-htx' }, h('div', { class: 'tr-hbig' }, h('b', {}, String(sm.earned)), h('span', {}, ` of ${sm.total}`)),
        h('p', {}, sm.plat ? `Platinum Trivet earned ${trDate(S.ach.plat)}` : `${pc}% to the Platinum Trivet`))),
    h('div', { class: 'tr-tiers' }, TR_TIER_ORDER.map(k => h('div', { class: 'tr-tierc' }, trMedal(k, 22, { off: !sm.tiers[k][0] }),
      h('span', { 'aria-hidden': 'true' }, h('b', {}, sm.tiers[k][0]), `/${sm.tiers[k][1]}`), h('span', { class: 'sr-only' }, `${TR_TIERS[k].name}: ${sm.tiers[k][0]} of ${sm.tiers[k][1]}`)))),
    h('div', { class: 'tr-lvl' }, h('div', { class: 'tr-lvlrow' }, h('b', {}, `Cabinet level ${sm.level}`), h('span', {}, full ? `All ${fmt(sm.points)} points` : `${sm.points - (sm.level - 1) * 100} / 100 points`)),
      full ? h('div', { class: 'tr-bar', 'aria-hidden': 'true' }, h('i', { style: 'width:100%' }))
        : h('div', { class: 'tr-bar', role: 'progressbar', 'aria-label': `Progress to cabinet level ${sm.level + 1}`, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': sm.points - (sm.level - 1) * 100, 'aria-valuetext': `${sm.toNext} points to level ${sm.level + 1}` },
          h('i', { style: `width:${lvP > 0 ? `max(6px,${(lvP * 100).toFixed(1)}%)` : '0'}` }))),
    tb);
}
function trRow(t, pre) {
  const on = !!S.ach[t.id], hid = t.hidden && !on, pr = !on && t.prog ? trProg(t) : null, tier = trTier(t), isNew = trCabNew.has(t.id);
  const name = hid ? 'Secret trophy' : t.name, desc = hid ? 'Keep playing to find it.' : t.desc;
  const big = pr && pr[1] >= 1e5, num = n => big ? short(n) : fmt(n);
  const label = `${name}, ${tier.name.toLowerCase()}${t.hidden && on ? ' secret' : ''} trophy. ${on ? `Earned ${trDate(S.ach[t.id], true)}` : 'Locked'}${pr ? `, ${fmt(pr[0])} of ${fmt(pr[1])}` : ''}.${isNew ? ' New.' : ''} ${desc}`;
  const b = h('button', { class: 'tr-row' + (on ? ' on' : ''), 'data-fk': `tr-${pre}:${t.id}`, 'aria-label': label },
    trMedal(t.tier, 40, { off: !on, q: hid }),
    h('span', { class: 'tr-rtx' },
      h('span', { class: 'tr-rname' }, h('b', {}, name), isNew ? h('i', { class: 'tr-new' }, 'New') : null),
      h('span', { class: 'tr-rdesc' }, desc),
      pr ? h('span', { class: 'tr-prog' }, h('span', { class: 'tr-bar' }, h('i', { style: `width:${pr[0] > 0 ? `max(5px,${(pr[0] / pr[1] * 100).toFixed(1)}%)` : '0'}` })), h('span', { class: 'tr-pnum' }, `${num(pr[0])} / ${num(pr[1])}`)) : null,
      on ? h('span', { class: 'tr-when', html: `${icon('check', 13)}<span>Earned ${trDate(S.ach[t.id])}</span>` }) : trRewChips(trRewards(t))));
  b.addEventListener('click', () => trDetail(t.id));
  return b;
}
function trDetail(id) {
  const t = trOf(id); if (!t) return;
  const T = trS(), on = !!S.ach[id], hid = t.hidden && !on, sh = t.shelf && trShelf(t.shelf), tier = trTier(t), name = hid ? 'Secret trophy' : t.name;
  sheet((p, close) => {
    p.append(h('div', { class: 'tr-dart', style: `--tc:${tier.col}` }, trMedal(t.tier, 96, { off: !on, q: hid })),
      h('div', { class: 'eyebrow tr-deye' }, `${tier.name} · ${sh ? sh.name : 'The whole cabinet'}`), h('h3', {}, name));
    if (hid) {
      p.append(h('p', {}, 'Keep playing to find it.'));
      const hint = h('p', { class: 'tr-hint', tabindex: '-1' }, h('b', {}, 'Hint: '), t.hint);
      if (trHintShown.has(id)) p.append(hint);
      else {
        const hb = h('button', { class: 'btn smallbtn tr-hintbtn', html: `${icon('info', 16)}<span>Show hint</span>` });
        hb.addEventListener('click', () => { trHintShown.add(id); hb.replaceWith(hint); hint.focus({ preventScroll: true }); });
        p.append(hb);
      }
    } else p.append(h('p', { class: 'tr-drule' }, t.desc));
    const pr = !on && (id === 'plat' ? [trSummary().earned, TR_BASE.length] : t.prog ? trProg(t) : null);
    if (pr) p.append(h('div', { class: 'tr-dprog' }, h('div', { class: 'tr-bar', role: 'progressbar', 'aria-label': `Progress to ${name}`, 'aria-valuemin': 0, 'aria-valuemax': pr[1], 'aria-valuenow': pr[0], 'aria-valuetext': `${fmt(pr[0])} of ${fmt(pr[1])}` },
      h('i', { style: `width:${pr[0] > 0 ? `max(6px,${(pr[0] / pr[1] * 100).toFixed(1)}%)` : '0'}` })), h('span', {}, `${fmt(pr[0])} / ${fmt(pr[1])}${id === 'plat' ? ' trophies' : ''}`)));
    const got = on ? T.got[id] || [] : null, mult = bankRank().mult;
    const list = on ? got : trRewards(t, mult);
    const extra = [];
    if (t.title) extra.push(h('span', { class: 'tr-rc tr-rtitle' }, h('small', {}, 'Title'), h('b', {}, t.title)));
    if (id === 'plat') extra.push(h('span', { class: 'tr-rc' }, h('span', { class: 'tr-ringdot', 'aria-hidden': 'true' }), 'Platinum avatar ring'));
    p.append(h('div', { class: 'tr-drew' }, h('div', { class: 'eyebrow' }, on ? (T.carry && T.carry[id] ? 'Top-up received' : 'Rewards received') : 'Rewards'),
      list.length ? trRewChips(list, { long: true, size: 18, cls: 'tr-rewl' }) : h('p', {}, 'Nothing extra: the old achievement had already paid it.'), extra.length ? h('span', { class: 'tr-rew tr-rewl' }, extra) : null,
      !on && mult > 1 ? h('p', { class: 'tr-fine' }, `Sparks include ×${mult} for your ${bankRank().name} rank, at the moment you earn it.`) : null,
      on && T.carry && T.carry[id] ? h('p', { class: 'tr-fine' }, 'Carried over from your achievements: you got the new reward less the Sparks it paid before.') : null));
    if (!on && sh && sh.item && !T.shelf[sh.id] && TROPHIES.every(x => x.shelf !== sh.id || x.id === id || S.ach[x.id]))
      p.append(h('p', { class: 'tr-fine tr-last' }, `The last one on ${sh.name}: it also unlocks the ${trItemName(sh.item.cat, sh.item.id)}.`));
    if (on) p.append(h('p', { class: 'tr-dwhen', html: `${icon('check', 15)}<span>Earned ${trDate(S.ach[id], true)}</span>` }));
    const row = h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Close'));
    if (on && got.length) {
      const rp = h('button', { class: 'btn cta' }, 'Replay rewards');
      rp.addEventListener('click', () => { close(); revealGot(trMergeGot(got), { title: t.name, eyebrow: `${tier.name} trophy` }); });
      row.append(rp);
    }
    p.append(row);
  }, { label: name });
}
function trTitleSheet() {
  const T = trS(), opts = TROPHIES.filter(t => t.title && S.ach[t.id]), all = TROPHIES.filter(t => t.title).length, cur = trTitle() ? T.title : null;
  sheet((p, close) => {
    const choose = id => { if ((T.title || null) === id) { close(); return; } T.title = id; save(); close(); refresh(); toast(id ? `Title set: ${trOf(id).title}` : 'Title removed'); };
    const opt = (id, label, sub, medal) => {
      const on = cur === id, b = h('button', { class: 'tr-topt' + (on ? ' on' : ''), 'aria-pressed': String(on) },
        medal || h('span', { class: 'tr-tnone', 'aria-hidden': 'true' }, '—'), h('span', { class: 'tr-ttx' }, h('b', {}, label), h('span', {}, sub)), h('span', { class: 'tr-tck', html: on ? icon('check', 18) : '' }));
      b.addEventListener('click', () => choose(id));
      return b;
    };
    p.append(h('h3', {}, 'Your title'), h('p', {}, 'Shown under your name on your profile and in the Kiln standings.'),
      h('div', { class: 'tr-topts', role: 'group', 'aria-label': 'Titles' }, opt(null, 'None', 'Show no title'),
        opts.map(t => opt(t.id, t.title, `${trTier(t).name} · ${t.name}`, trMedal(t.tier, 30)))),
      h('p', { class: 'tr-fine' }, opts.length ? `${opts.length} of ${all} titles unlocked. Gold trophies, Beyond Platinum and the Platinum Trivet each add one.` : 'Earn a gold trophy to unlock your first title.'),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Close')));
  }, { label: 'Your title' });
}
function trHowSheet() {
  sheet((p, close) => {
    const tr = k => { const x = TR_TIERS[k]; return h('div', { class: 'tr-howt' }, trMedal(k, 30), h('b', {}, x.name), h('span', {}, `${fmt(x.sparks)} Sparks · ${fmt(x.gems)} Gems${x.boost ? ` · ${x.boost} boosters` : ''}${x.chest ? ` · ${(x.chests || 1) > 1 ? `${x.chests} ${CHESTS[x.chest].name}s` : `a ${CHESTS[x.chest].name}`}` : ''}`), h('em', {}, `${x.pts} pts`)); };
    p.append(h('h3', {}, 'How trophies work'),
      h('div', { class: 'how' },
        h('div', {}, h('i', {}, '1'), h('span', {}, 'Each trophy pays the moment you earn it. Your bankroll rank multiplies the Sparks, just like Kiln payouts.')),
        h('div', {}, h('i', {}, '2'), h('span', {}, 'Gold trophies also unlock a title to show under your name. Finish a whole shelf for its item.')),
        h('div', {}, h('i', {}, '3'), h('span', {}, `Earn all ${TR_BASE.length} for the Platinum Trivet. Beyond Platinum trophies are extra and don't count.`)),
        h('div', {}, h('i', {}, '4'), h('span', {}, 'Secret trophies stay hidden until you find them. Each one has a hint if you get stuck.'))),
      h('div', { class: 'tr-howtiers' }, ['bronze', 'silver', 'gold', 'platinum'].map(tr)),
      h('p', { class: 'tr-fine' }, 'Every 100 points is a cabinet level. No trophy needs a purchase, trivet+ or an ad.'),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn', onclick: close }, 'Close')));
  }, { label: 'How trophies work' });
}

/* ---------- small API pieces ---------- */
function trSummary() {
  if (!S) return { earned: 0, total: TR_BASE.length, tiers: { bronze: [0, 28], silver: [0, 23], gold: [0, 10] }, points: 0, level: 1, next: 100, toNext: 100, plat: false, fresh: 0, encore: [0, 6] };
  const T = trS(), ach = S.ach, tiers = {}, enc = TROPHIES.filter(t => t.shelf === 'encore');
  TR_TIER_ORDER.forEach(k => { const l = TR_BASE.filter(t => t.tier === k); tiers[k] = [l.filter(t => ach[t.id]).length, l.length]; });
  const points = TROPHIES.reduce((s, t) => s + (ach[t.id] ? TR_TIERS[t.tier].pts : 0), 0), level = 1 + Math.floor(points / 100);
  return { earned: TR_BASE.filter(t => ach[t.id]).length, total: TR_BASE.length, tiers, points, level, next: level * 100, toNext: level * 100 - points,
    plat: !!ach.plat, fresh: [...TR_BASE, trOf('plat')].filter(t => ach[t.id] && !T.seen[t.id]).length, encore: [enc.filter(t => ach[t.id]).length, enc.length] };
}
function trTitle() { if (!S || !S.troph || !S.ach) return ''; const t = trOf(S.troph.title); return t && t.title && S.ach[t.id] ? t.title : ''; }
function trHasPlat() { return !!(S && S.ach && S.ach.plat); }
function trItemSource(cat, id) {
  const sh = TR_SHELVES.find(s => s.item && s.item.cat === cat && s.item.id === id);
  if (sh) return sh.id === 'secret' ? 'Find every secret trophy' : `Finish the ${sh.name} trophies`;
  if (TR_PLAT_SET.some(x => x.cat === cat && x.id === id)) return 'Earn the Platinum Trivet';
  return '';
}
/* ================= trophies (prefix tr) ================= */
