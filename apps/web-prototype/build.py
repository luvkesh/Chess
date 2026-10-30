"""Inline the shared packages, three.js, the fonts, the web client and the content JSON into one HTML file."""
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
    src / 'world3d.js',
    src / 'scene.js',
    src / 'art.js',
    src / 'progress.js',
    src / 'audio.js',
    src / 'net.js',
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
]
# Card pictures of sets, boards and rooms are cached in the browser under this id, so any
# change to the 3D code or the catalog draws them again.
look = hashlib.sha1(b''.join((src / f).read_bytes() for f in ('kit3d.js', 'pieces3d.js', 'world3d.js', 'scene.js')) + (content / 'catalog.json').read_bytes()).hexdigest()[:12]
parts.append("const CHACKLATE_LOOK_ID = '%s';" % look)
for path in SCRIPTS:
    parts.append('// ---- %s ----\n%s' % (path.name, EXPORTS.sub('', path.read_text())))
code = '\n'.join(parts)
assert '</script' not in code.lower()

fonts = (vendor / 'fonts.css').read_text()
assert '</style' not in fonts.lower()

html = (src / 'shell.html').read_text().replace('/*FONTS*/', fonts).replace('/*SCRIPTS*/', code)
out = here / 'dist' / 'chacklate-chess.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html)
print(out, len(html))
