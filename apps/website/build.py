"""Build the marketing site into one self-contained HTML file.

    python3 apps/website/build.py                 # apps/website/index.html, served by the game server at /
    python3 apps/website/build.py --preview DIR   # a copy for hosting anywhere else (index, privacy and terms)

Everything is inlined: the game's fonts, the pictures in img/, the flat art drawn by the game's
art.js and the facts from packages/content. The page makes no third-party requests and sets no
cookies, which matters for a site aimed at children and their parents.
"""
import argparse
import base64
import json
import pathlib
import re
import subprocess
import urllib.parse

here = pathlib.Path(__file__).parent
root = here.parent.parent
content = root / 'packages' / 'content'
game = root / 'apps' / 'web-prototype'

# The instrument each room's music is played on (apps/web-prototype/src/audio.js MOODS).
MUSIC = {'nile': 'Harp', 'athens': 'Lyre', 'roma': 'Horns', 'mughal': 'Sitar', 'ming': 'Guzheng',
         'venice': 'Harpsichord', 'winter': 'Celesta', 'deco': 'Electric piano'}
# Strength of each animal friend, matching the engine's levels.
RANGES = ['250–500', '500–800', '800–1100', '1100–1400', '1400–1700', '1700–2000', '2000–2300', 'Full strength']
STAGES = {'tale': 'Story', 'lesson': 'Lesson', 'puzzles': 'Puzzles', 'endgame': 'Endgame', 'champion': 'Champion'}

LINKS = {
    'server': {'PLAY': '/play', 'PARENT': '/parent', 'PRIVACY': '/privacy', 'TERMS': '/terms'},
    'preview': {'PLAY': 'https://claude.ai/artifact/LPXvesS3kLgtjYFDkxGJFL', 'PARENT': 'privacy.html#rights',
                'PRIVACY': 'privacy.html', 'TERMS': 'terms.html'},
}


def load(name):
    return json.loads((content / name).read_text())


def set_tints():
    """Each era set's signature colour, read from the 3D code so the cards match the game."""
    src = (game / 'src' / 'pieces3d.js').read_text()
    return dict(re.findall(r"id: '([\w-]+)', name: [^\n]*?tint: '(#[0-9a-f]{6})'", src))


def mix(a, b, t):
    pa = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    pb = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join('%02x' % round(x + (y - x) * t) for x, y in zip(pa, pb))


def site_data():
    campaign, catalog = load('campaign.json'), load('catalog.json')
    items = {i['data'].get('set') or i['data'].get('room'): i for i in catalog['items'] if i['category'] in ('pieces', 'room')}
    tints = set_tints()
    eras = []
    for e in campaign['eras']:
        s, r = items[e['set']], items[e['room']]
        tint = tints[e['set']]
        eras.append({
            'id': e['id'], 'name': e['name'], 'title': e['title'], 'when': e['when'], 'place': e['place'], 'access': e['access'],
            'coach': {'full': e['coach']['full'], 'hello': e['coach']['hello']},
            'tale': e['stages'][0]['pages'][0],
            'stages': [{'kind': STAGES[st['kind']], 'title': st['title']} for st in e['stages']],
            'set': {'name': s['name'], 'desc': s['desc'], 'tint': mix(tint, '#000000', 0.35), 'glow': mix(tint, '#ffffff', 0.18)},
            'room': {'name': r['name'], 'desc': r['desc']},
            'music': MUSIC[e['room']],
        })
    opponents = [{'id': o['id'], 'name': o['name'], 'animal': o['animal'].replace('redpanda', 'red panda').capitalize(),
                  'range': RANGES[o['level']], 'blurb': o['blurb']} for o in campaign['opponents']]
    cats = {}
    for i in catalog['items']:
        cats[i['category']] = cats.get(i['category'], 0) + 1
    counts = {
        'eras': len(eras), 'lessons': len(load('lessons.json')['lessons']), 'puzzles': len(load('puzzles.json')),
        'openings': len(load('openings.json')['openings']), 'endgames': len(load('endgames.json')['endgames']),
        'items': len(catalog['items']), 'sets': cats['pieces'], 'boards': cats['board'], 'rooms': cats['room'],
    }
    return eras, opponents, counts, campaign['coach']['blurb']


def data_uri(path):
    kind = {'.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png'}[path.suffix]
    return 'data:%s;base64,%s' % (kind, base64.b64encode(path.read_bytes()).decode())


def build(target):
    eras, opponents, counts, praline = site_data()
    art = json.loads(subprocess.run(['node', str(here / 'tools' / 'render-art.js')], check=True, capture_output=True, text=True).stdout)
    # art.js hands out URI-encoded SVG; base64 is about half the size
    prefix = 'data:image/svg+xml;charset=utf-8,'
    art = {k: 'data:image/svg+xml;base64,' + base64.b64encode(urllib.parse.unquote(v[len(prefix):]).encode()).decode() for k, v in art.items()}
    img = {p.stem: data_uri(p) for p in sorted((here / 'img').iterdir()) if p.suffix in ('.webp', '.jpg', '.png')}
    for e in eras:
        for k in ('hero', 'room', 'game'):
            assert '%s-%s' % (e['id'], k) in img, 'missing img/%s-%s' % (e['id'], k)
        assert 'set-' + e['id'] in img, 'missing img/set-%s' % e['id']

    page = (here / 'src' / 'index.html').read_text()
    fonts = (game / 'vendor' / 'fonts.css').read_text()
    assert '</style' not in fonts.lower()
    used = set(re.findall(r'@@IMG:([\w-]+)@@', page))
    data = 'window.SITE = %s;' % json.dumps({'eras': eras, 'opponents': opponents, 'art': art,
                                             'img': {k: v for k, v in img.items() if k not in used}},
                                            separators=(',', ':'), ensure_ascii=False)
    assert '</script' not in data.lower()
    page = page.replace('/*FONTS*/', fonts).replace('/*DATA*/', data)
    page = re.sub(r'@@IMG:([\w-]+)@@', lambda m: img[m.group(1)], page)
    page = re.sub(r'@@ART:([\w-]+)@@', lambda m: art[m.group(1)], page)
    page = re.sub(r'@@N:(\w+)@@', lambda m: str(counts[m.group(1)]), page)
    page = page.replace('@@PRALINE@@', praline)
    for k, v in LINKS[target].items():
        page = page.replace('@@%s@@' % k, v)
    left = re.findall(r'@@\w+(?::[\w-]+)?@@', page)
    assert not left, left
    return page


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', metavar='DIR', help='write a stand-alone copy with privacy and terms beside it')
    args = ap.parse_args()
    if args.preview:
        out = pathlib.Path(args.preview)
        out.mkdir(parents=True, exist_ok=True)
        (out / 'index.html').write_text(build('preview'))
        for name in ('privacy', 'terms'):
            text = (here / (name + '.html')).read_text()
            text = text.replace('href="/"', 'href="index.html"').replace('href="/parent"', 'href="privacy.html#rights"')
            text = text.replace('href="/privacy"', 'href="privacy.html"').replace('href="/terms"', 'href="terms.html"')
            (out / (name + '.html')).write_text(text)
        print(out, 'written')
    else:
        page = build('server')
        (here / 'index.html').write_text(page)
        print(here / 'index.html', len(page))


if __name__ == '__main__':
    main()
