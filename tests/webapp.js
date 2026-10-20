// The installable web app: serves dist/web over localhost, checks the manifest and icons,
// that the service worker installs, and that the game still starts with the network off.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '../dist/web'), OUT = process.argv[2] || path.join(__dirname, 'webapp.out');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
setTimeout(() => { fs.writeFileSync(OUT, 'WATCHDOG'); process.exit(2); }, 90000);
const srv = http.createServer((q, s) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); s.end(d); });
}).listen(8765);
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 390, height: 844 } }), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(2500);
  const r = {};
  r.online = await p.evaluate(async () => {
    const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json();
    const icons = await Promise.all(m.icons.map(i => fetch(new URL(i.src, location.href)).then(x => x.status)));
    const reg = await navigator.serviceWorker.ready;
    return { name: m.name, display: m.display, icons, sw: !!reg.active, tabs: document.querySelectorAll('.tabs button').length, title: document.title };
  });
  r.controlled = await p.evaluate(() => !!navigator.serviceWorker.controller);
  r.cached = await p.evaluate(async () => (await caches.keys()).join(','));
  fs.writeFileSync(OUT, JSON.stringify(r, null, 1));
  await p.waitForTimeout(800);
  await ctx.setOffline(true);
  await p.goto('http://localhost:8765/').catch(e => { r.offlineErr = e.message.split('\n')[0]; }); await p.waitForTimeout(2500);
  r.offline = await p.evaluate(() => ({ booted: typeof S === 'object' && !!S, tabs: document.querySelectorAll('.tabs button').length, home: !document.querySelector('#home').hidden }));
  await p.screenshot({ path: OUT.replace(/\.out$/, '.png') });
  r.errs = errs.filter(e => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
  fs.writeFileSync(OUT, JSON.stringify(r, null, 1)); await b.close(); srv.close(); process.exit(0);
})();
