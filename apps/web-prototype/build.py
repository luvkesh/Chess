"""Inline the shared packages, the web client and the content JSON into one HTML file."""
import json
import pathlib
import re

here = pathlib.Path(__file__).parent
root = here.parent.parent
core = root / 'packages' / 'chess-core' / 'src'
content = root / 'packages' / 'content'
src = here / 'src'

SCRIPTS = [
    core / 'engine.js',
    core / 'coach.js',
    src / 'render.js',
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
]
for path in SCRIPTS:
    if path.exists():
        parts.append('// ---- %s ----\n%s' % (path.name, EXPORTS.sub('', path.read_text())))
code = '\n'.join(parts)
assert '</script' not in code.lower()

html = (src / 'shell.html').read_text().replace('/*SCRIPTS*/', code)
out = here / 'dist' / 'chacklate-chess.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html)
print(out, len(html))
