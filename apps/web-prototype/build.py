"""Inline the shared packages, three.js, the fonts, the web client and the content JSON into one HTML file."""
import base64
import hashlib
import json
import pathlib
import re

here = pathlib.Path(__file__).parent
root = here.parent.parent
core = root / 'packages' / 'chess-core' / 'src'
content = root / 'packages' / 'content'
src = here / 'src'
vendor = here / 'vendor'

SCRIPTS = [
    core / 'engine.js',
    core / 'coach.js',
    vendor / 'three.bundle.js',
    src / 'kit3d.js',
    src / 'pieces3d.js',
    src / 'landmarks3d.js',
    src / 'world3d.js',
    src / 'scene.js',
    src / 'art.js',
    src / 'progress.js',
    src / 'audio.js',
    src / 'net.js',
    src / 'relay.js',
    src / 'i18n.js',
    src / 'tips.js',
    src / 'app.js',
]
EXPORTS = re.compile(r"^if \(typeof module !== 'undefined'\) module\.exports = \w+;\s*$", re.M)


def data(name, file):
    value = json.loads((content / file).read_text())
    return 'const %s = %s;' % (name, json.dumps(value, separators=(',', ':'), ensure_ascii=False))


parts = [
    data('CHACKLATE_CATALOG', 'catalog.json'),
    data('CHACKLATE_LESSONS', 'lessons.json'),
    data('CHACKLATE_PUZZLES', 'puzzles.json'),
    data('CHACKLATE_OPENINGS', 'openings.json'),
    data('CHACKLATE_ENDGAMES', 'endgames.json'),
    data('CHACKLATE_SEASONS', 'seasons.json'),
    data('CHACKLATE_MISSIONS', 'missions.json'),
    data('CHACKLATE_STORE', 'store.json'),
    data('CHACKLATE_VOICE', 'voice.json'),
    data('CHACKLATE_CAMPAIGN', 'campaign.json'),
    data('CHACKLATE_GUIDE', 'guide.json'),
]
# UI strings: one file per area, every language side by side (src/i18n.js reads them).
# "check" lists the languages still waiting for a native speaker's read; the game doesn't need it.
strings = {f.stem: {k: {l: v for l, v in e.items() if l != 'check'} for k, e in json.loads(f.read_text()).items()}
           for f in sorted((content / 'i18n').glob('*.json'))}
parts.append('const CHACKLATE_STRINGS = %s;' % json.dumps(strings, separators=(',', ':'), ensure_ascii=False))
# Fonts for non-Latin scripts, added to the page only when such a language is chosen.
parts.append('const CHACKLATE_SCRIPT_FONTS = %s;' % json.dumps({'deva': (vendor / 'fonts-deva.css').read_text()}))
# Card pictures of sets, boards and rooms are cached in the browser under this id, so any
# change to the 3D code or the catalog draws them again.
look = hashlib.sha1(b''.join((src / f).read_bytes() for f in ('kit3d.js', 'pieces3d.js', 'landmarks3d.js', 'world3d.js', 'scene.js')) + (content / 'catalog.json').read_bytes()).hexdigest()[:12]
parts.append("const CHACKLATE_LOOK_ID = '%s';" % look)
# The crest (the rendered gold knight, shared with the website), inlined so the game stays one file.
parts.append("const CHACKLATE_CREST = 'data:image/webp;base64,%s';" % base64.b64encode((src / 'crest.webp').read_bytes()).decode())
# Menu pictures rendered from the game's 3D pieces and era paintings (tools/shoot-art.js, then
# tools/art-webp.py): the gold pieces for the medals and each era's view, keyed by its landmark.
uri = lambda f: 'data:image/webp;base64,' + base64.b64encode(f.read_bytes()).decode()
landmarks = {e['id']: e['landmark'] for e in json.loads((content / 'campaign.json').read_text())['eras']}
art = {'piece': {}, 'view': {}}
for f in sorted((src / 'art').glob('*.webp')):
    kind, name = f.stem.split('-', 1)
    art[kind][landmarks.get(name, name) if kind == 'view' else name] = uri(f)
parts.append('const CHACKLATE_ART = %s;' % json.dumps(art, separators=(',', ':')))
for path in SCRIPTS:
    parts.append('// ---- %s ----\n%s' % (path.name, EXPORTS.sub('', path.read_text())))
code = '\n'.join(parts)
assert '</script' not in code.lower()

fonts = (vendor / 'fonts.css').read_text()
assert '</style' not in fonts.lower()

html = (src / 'shell.html').read_text().replace('/*FONTS*/', fonts).replace('/*SCRIPTS*/', code)
out = here / 'dist' / 'chackmate.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html)
print(out, len(html))
