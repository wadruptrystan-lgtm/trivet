import os, sys
D = os.path.dirname(os.path.abspath(__file__))
src = lambda f: open(os.path.join(D, 'src', f)).read()
FONTS = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,400..900,0..100;1,9..144,400..900,0..100&family=Manrope:wght@400;500;600;700;800&family=DM+Serif+Display&family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Major+Mono+Display&display=swap'
CSS = ['style.css', 'economy.css', 'tablex.css', 'shop.css', 'arcade.css', 'season.css', 'profile.css', 'trophy.css']
JS = ['core.js', 'economy.js', 'table.js', 'shop.js', 'arcade.js', 'season.js', 'profile.js', 'trophy.js', 'meta.js']
css = '\n'.join(src(f) for f in CSS)
js = '\n'.join(src(f) for f in JS)
page = f'''<title>trivet</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<style>
{css}
</style>
{src('body.html')}
<script>
{src('engine.js')}
</script>
<script>
{js}
</script>
'''
os.makedirs(os.path.join(D, 'dist'), exist_ok=True)
open(os.path.join(D, 'dist', 'trivet.html'), 'w').write(page)
open(os.path.join(D, 'dist', 'test.html'), 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + page + '</body></html>')
open(os.path.join(D, 'dist', 'app.js'), 'w').write(js)
# The installable web app: a full document with the manifest, icons, safe-area padding and offline support.
import hashlib, shutil
W = os.path.join(D, 'dist', 'web')
shutil.rmtree(W, ignore_errors=True)
shutil.copytree(os.path.join(D, 'web'), W)
version = hashlib.sha1(page.encode()).hexdigest()[:10]
sw = os.path.join(W, 'sw.js'); code = open(sw).read(); open(sw, 'w').write(code.replace('__VERSION__', version))
head = """<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Scoop, an original tile game. Drop a chip, finish a trio, scoop the tray.">
<meta name="theme-color" content="#131016">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="trivet">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="icon" href="icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>
/* On phones the game fills the screen, so keep it clear of the notch and the home bar. */
@media (max-width:639px),(max-height:699px){#stage{padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}}
html,body{overscroll-behavior:none}
[hidden]{display:none!important}
</style>
"""
reg = """<script>
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
</script>
"""
cut = page.index('<div id="stage">')  # title, fonts and styles go in the head; the game in the body
open(os.path.join(W, 'index.html'), 'w').write(head + page[:cut] + '</head>\n<body>\n' + page[cut:] + reg + '</body>\n</html>\n')
print('built', len(page), 'bytes; web app', version)
