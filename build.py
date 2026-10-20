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
print('built', len(page), 'bytes')
