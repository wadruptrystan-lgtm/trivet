// Prints the numbers used in the structured report from out/results.json
const R = require(require('path').join(__dirname, 'out', process.argv[2] || 'results.json'));
const order = ['cafe', 'noodle', 'tea', 'supper', 'glasshouse', 'daily'];
const pxs = [...new Set(R.table.map(t => t.proxy))];
const f = x => x == null ? '-' : (+x).toFixed(4);
for (const px of pxs) {
  console.log('\n## ' + px);
  for (const v of order) { const t = R.table.find(t => t.proxy === px && t.venue === v); if (!t) continue;
    console.log(v.padEnd(11), t.matches, 'win', f(t.winRate), 'sole', f(t.soleWinRate), 'scoops', t.avgScoops.toFixed(2), 'xp', t.avgXP.toFixed(1), 'net', t.netSparks == null ? '-' : t.netSparks.toFixed(0), 'EN', t.everyNum.median + '/' + t.everyNum.p90);
  }
}
const keys = process.argv[3] ? process.argv[3].split(',') : null;
if (keys) for (const px of pxs) { console.log('\n# ' + px + ' ' + keys.join(' '));
  for (const v of order) { const t = R.table.find(t => t.proxy === px && t.venue === v); if (!t) continue;
    console.log(v.padEnd(11), keys.map(k => f(k in t.rates ? t.rates[k] : t.variants[k])).join(' ')); } }
