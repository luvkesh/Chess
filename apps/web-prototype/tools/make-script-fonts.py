"""Writes vendor/fonts-<script>.css for the scripts the Latin fonts lack: Arabic (Arabic and Urdu),
Bengali and Cyrillic (Russian). Each file declares two families, 'Chack Sans' (body text) and
'Chack Serif' (titles), which sit in the font stacks of the game and the website right after the
Latin faces; their unicode-range keeps them to their own letters. Chinese uses the device's own
fonts (a CJK font is several megabytes).

  mkdir /tmp/f && cd /tmp/f && npm init -y && npm install @fontsource/noto-naskh-arabic \
      @fontsource/hind-siliguri @fontsource/noto-serif-bengali @fontsource/jost @fontsource/cormorant-garamond
  python3 tools/make-script-fonts.py /tmp/f/node_modules/@fontsource
"""
import base64, pathlib, sys

here = pathlib.Path(__file__).resolve().parent.parent
fs = pathlib.Path(sys.argv[1])

RANGES = {
    'arabic': 'U+0600-06FF, U+0750-077F, U+0870-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200E, U+2010-2011, U+204F, U+2E41',
    'bengali': 'U+0951-0952, U+0964-0965, U+0980-09FE, U+1CD0, U+1CD2, U+1CD5-1CD6, U+1CD8, U+1CE1, U+1CEA, U+1CED, U+1CF2, U+1CF5-1CF7, U+200C-200D, U+20B9, U+25CC, U+A8F1',
    'cyrillic': 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
}
SCRIPTS = {
    # file: [(family, package, subset, [(weight, file weight)])]
    'arab': ('Noto Naskh Arabic (400, 600, 700)', [
        ('Chack Sans', 'noto-naskh-arabic', 'arabic', [(400, 400), (500, 500), (600, 600)]),
        ('Chack Serif', 'noto-naskh-arabic', 'arabic', [(500, 600), (600, 700), (700, 700)]),
    ]),
    'beng': ('Hind Siliguri (400, 500, 600) and Noto Serif Bengali (600, 700)', [
        ('Chack Sans', 'hind-siliguri', 'bengali', [(400, 400), (500, 500), (600, 600)]),
        ('Chack Serif', 'noto-serif-bengali', 'bengali', [(500, 600), (600, 600), (700, 700)]),
    ]),
    'cyrl': ('Jost (400, 500, 600) and Cormorant Garamond (500, 600, 700) Cyrillic', [
        ('Chack Sans', 'jost', 'cyrillic', [(400, 400), (500, 500), (600, 600)]),
        ('Chack Serif', 'cormorant-garamond', 'cyrillic', [(500, 500), (600, 600), (700, 700)]),
    ]),
}

for name, (what, faces) in SCRIPTS.items():
    out = ['/* %s, from @fontsource, SIL Open Font License 1.1. Injected only when a language in this script is chosen. */' % what]
    for family, pkg, subset, weights in faces:
        for w, fw in weights:
            f = fs / pkg / 'files' / ('%s-%s-%d-normal.woff2' % (pkg, subset, fw))
            data = base64.b64encode(f.read_bytes()).decode()
            out.append("@font-face{font-family:'%s';font-style:normal;font-display:swap;font-weight:%d;src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:%s}"
                       % (family, w, data, RANGES[subset]))
    p = here / 'vendor' / ('fonts-%s.css' % name)
    p.write_text('\n'.join(out) + '\n')
    print(p, p.stat().st_size)
