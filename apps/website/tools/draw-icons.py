"""Draws the website's 3D feature icons as SVG files in img/ic-*.svg.

    python3 apps/website/tools/draw-icons.py

Each icon is a small glossy object (lit from the top left, with a soft shadow under it), drawn
with gradients so it reads as 3D at 40-72 px. build.py inlines them like the other pictures.
"""
import pathlib

out = pathlib.Path(__file__).parent.parent / 'img'


def lin(id, stops, x1=0, y1=0, x2=0, y2=1):
    s = ''.join('<stop offset="%s" stop-color="%s"%s/>' % (o, c, '' if a is None else ' stop-opacity="%s"' % a) for o, c, a in [(t + (None,))[:3] for t in stops])
    return '<linearGradient id="%s" x1="%s" y1="%s" x2="%s" y2="%s">%s</linearGradient>' % (id, x1, y1, x2, y2, s)


def rad(id, stops, cx=0.35, cy=0.3, r=0.75):
    s = ''.join('<stop offset="%s" stop-color="%s"%s/>' % (o, c, '' if a is None else ' stop-opacity="%s"' % a) for o, c, a in [(t + (None,))[:3] for t in stops])
    return '<radialGradient id="%s" cx="%s" cy="%s" r="%s">%s</radialGradient>' % (id, cx, cy, r, s)


GOLD = lin('gold', [(0, '#fff4c8'), (0.35, '#f2cf7c'), (0.7, '#c8933c'), (1, '#8a5a1c')])
GLOSS = lin('gloss', [(0, '#ffffff', 0.75), (1, '#ffffff', 0)])
SHADOW = '<filter id="sh" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="2.6" flood-color="#000" flood-opacity="0.45"/></filter>'
FLOOR = '<ellipse cx="48" cy="88" rx="26" ry="4.5" fill="#000" opacity="0.28"/>'
# a red "not here" badge, for things the game leaves out
NO = ('<g transform="translate(66 64)" filter="url(#sh)"><circle r="15" fill="url(#noR)"/><circle r="15" fill="none" stroke="#fff" stroke-width="2.6"/>'
      '<path d="M-8.5 -8.5L8.5 8.5" stroke="#fff" stroke-width="4.6" stroke-linecap="round"/><ellipse cx="-3" cy="-8" rx="8" ry="4" fill="url(#gloss)" opacity="0.7"/></g>')
NO_DEFS = rad('noR', [(0, '#ff7a6a'), (0.6, '#e0342a'), (1, '#9a1410')])


def svg(name, defs, body):
    out.joinpath('ic-%s.svg' % name).write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96"><defs>%s%s%s%s</defs>%s</svg>\n'
        % (GOLD, GLOSS, SHADOW, defs, FLOOR + body))


def bubble(fill_id, rim):
    # a puffy speech bubble with a tail at the bottom left
    return ('<path d="M22 14h52a14 14 0 0 1 14 14v26a14 14 0 0 1-14 14H42l-16 14 3-14h-7A14 14 0 0 1 8 54V28a14 14 0 0 1 14-14z" fill="url(#%s)" stroke="%s" stroke-width="1.5"/>'
            '<path d="M22 17h52a11 11 0 0 1 11 11v4c-20-6-50-6-74 2v-6a11 11 0 0 1 11-11z" fill="url(#gloss)" opacity="0.55"/>') % (fill_id, rim)


def star(cx, cy, r, fill='url(#gold)'):
    k = r * 0.28
    return '<path d="M%s %sL%s %sL%s %sL%s %sL%s %sL%s %sL%s %sL%s %sZ" fill="%s"/>' % (
        cx, cy - r, cx + k, cy - k, cx + r, cy, cx + k, cy + k, cx, cy + r, cx - k, cy + k, cx - r, cy, cx - k, cy - k, fill)


# ---- hero row
svg('coach', lin('bT', [(0, '#5fe0d0'), (0.5, '#17a596'), (1, '#0a5c58')]),
    '<g filter="url(#sh)">' + bubble('bT', '#0a4a46') + star(48, 41, 15) + star(68, 30, 7) + star(30, 54, 5) + '</g>')

svg('lessons', lin('cv', [(0, '#e0485a'), (1, '#7a1020')]) + lin('pgL', [(0, '#fffaf0'), (1, '#e8d6b4')], 1, 0, 0, 0) + lin('pgR', [(0, '#fffaf0'), (1, '#e8d6b4')]),
    '<g filter="url(#sh)">'
    '<path d="M6 30c14-6 28-6 42 4 14-10 28-10 42-4v48c-14-6-28-6-42 3-14-9-28-9-42-3z" fill="url(#cv)"/>'
    '<path d="M10 26c12-5 25-4 38 5v44c-13-8-26-9-38-4z" fill="url(#pgL)"/>'
    '<path d="M86 26c-12-5-25-4-38 5v44c13-8 26-9 38-4z" fill="url(#pgR)"/>'
    '<path d="M48 31v44" stroke="#c9b08a" stroke-width="1.6"/>'
    '<path d="M16 38c8-2.5 16-2 24 2M16 46c8-2.5 16-2 24 2M16 54c8-2.5 16-2 24 2M56 40c8-4 16-4.5 24-2M56 48c8-4 16-4.5 24-2M56 56c8-4 16-4.5 24-2" stroke="#b9a07a" stroke-width="2" stroke-linecap="round" fill="none"/>'
    '<path d="M66 22v22l5-4 5 4V24z" fill="url(#gold)" stroke="#8a5a1c" stroke-width="0.8"/></g>')

svg('online', rad('sea', [(0, '#8fd8ff'), (0.55, '#2f86d6'), (1, '#123a7a')]) + rad('land', [(0, '#9be27a'), (1, '#2f8a3c')]),
    '<g filter="url(#sh)"><circle cx="48" cy="46" r="32" fill="url(#sea)"/>'
    '<path d="M30 26c6-3 12-1 14 4s-4 8-2 13 9 4 8 10-9 7-12 3-3-9-8-11-6-8-4-12 2-5 4-7z" fill="url(#land)"/>'
    '<path d="M58 22c7 2 14 8 17 15-4 1-8-1-10 2s1 8-3 10-8-3-8-8 4-6 2-10-1-7 2-9z" fill="url(#land)"/>'
    '<path d="M56 62c4-2 9 0 10 4s-4 9-8 8-6-9-2-12z" fill="url(#land)"/>'
    '<ellipse cx="38" cy="30" rx="18" ry="10" fill="url(#gloss)" opacity="0.6"/>'
    '<ellipse cx="48" cy="48" rx="44" ry="13" fill="none" stroke="url(#gold)" stroke-width="4" transform="rotate(-18 48 48)"/>'
    '<path d="M48 14.2a32 32 0 0 1 0 63.6" fill="none"/></g>'
    '<g filter="url(#sh)"><circle cx="86" cy="34" r="6" fill="url(#gold)"/><circle cx="10" cy="62" r="5" fill="#f2f2f2"/></g>')

W, H = 7, 3.5
board = ''.join('<path d="M%s %sl%s %s %s -%sz" fill="%s"/>' % (48 - W + (c - r) * W, 22 + H + (c + r) * H, W, H, W, H, '#f3dfb8' if (r + c) % 2 == 0 else '#7a3f1c')
                + '<path d="M%s %sl%s -%s %s %sz" fill="%s"/>' % (48 - W + (c - r) * W, 22 + H + (c + r) * H, W, H, W, H, '#f3dfb8' if (r + c) % 2 == 0 else '#7a3f1c')
                for r in range(6) for c in range(6))
PAWN = '<path d="M0-14c-3.6 0-6 2.6-6 5.8 0 2.2 1.2 3.8 2.8 4.8L-6 4h12L3.2-3.4C4.8-4.4 6-6 6-8.2 6-11.4 3.6-14 0-14z" fill="%s" stroke="%s" stroke-width="1"/><ellipse cy="4" rx="7.5" ry="2.6" fill="%s" stroke="%s" stroke-width="1"/>'
svg('boards', lin('side1', [(0, '#a8662c'), (1, '#5a2c0e')]) + lin('side2', [(0, '#7a4418'), (1, '#3a1a06')]),
    '<g filter="url(#sh)">'
    '<path d="M0 43l48 25v9L0 52z" fill="url(#side1)"/><path d="M96 43L48 68v9l48-25z" fill="url(#side2)"/>'
    '<path d="M48 18l48 25-48 25L0 43z" fill="url(#gold)"/>'
    + board +
    '<path d="M14 36l34-17.5 34 17.5" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1.2"/></g>'
    '<g filter="url(#sh)"><g transform="translate(62 44)">' + PAWN % ('#fbf4e6', '#a89878', '#fbf4e6', '#a89878') + '</g>'
    '<g transform="translate(34 40)">' + PAWN % ('#3a2a22', '#120a06', '#3a2a22', '#120a06') + '</g></g>')

# ---- Meet Rooky tiles
svg('explain', lin('bP', [(0, '#c58ae8'), (0.5, '#7a3cb0'), (1, '#3e1666')]),
    '<g filter="url(#sh)">' + bubble('bP', '#2e0e4e') +
    '<path d="M28 52c4-14 18-20 32-14" fill="none" stroke="url(#gold)" stroke-width="5.5" stroke-linecap="round"/>'
    '<path d="M54 30l10 8-11 5z" fill="url(#gold)"/><circle cx="28" cy="53" r="5" fill="#fff4dc"/></g>')

svg('aloud', lin('spk', [(0, '#ff9a6a'), (0.55, '#e0503a'), (1, '#8a1e14')]) + lin('cone', [(0, '#ffd2a0'), (1, '#c86a2a')], 0, 0, 1, 0),
    '<g filter="url(#sh)"><rect x="10" y="34" width="20" height="28" rx="5" fill="url(#spk)"/>'
    '<path d="M28 36l26-18v60L28 60z" fill="url(#spk)"/><path d="M30 38l22-15v14c-8 1-15 3-22 6z" fill="url(#gloss)" opacity="0.5"/>'
    '<path d="M64 36c6 6 6 18 0 24" fill="none" stroke="#3fc8e8" stroke-width="5.5" stroke-linecap="round"/>'
    '<path d="M73 28c11 11 11 29 0 40" fill="none" stroke="#2a9ad0" stroke-width="5.5" stroke-linecap="round"/>'
    '<circle cx="70" cy="18" r="5" fill="url(#gold)"/><path d="M75 18V4l8 3" fill="none" stroke="url(#gold)" stroke-width="3" stroke-linecap="round"/></g>')

svg('offline', rad('orb', [(0, '#ffd27a'), (0.6, '#f08a1c'), (1, '#9a4206')]),
    '<g filter="url(#sh)"><circle cx="48" cy="46" r="34" fill="url(#orb)"/><circle cx="48" cy="46" r="34" fill="none" stroke="#fff3d0" stroke-opacity="0.6" stroke-width="2"/>'
    '<path d="M48 18c3 0 4 3 4 6v14l20 12v6l-20-6v12l6 5v5l-10-3-10 3v-5l6-5V50l-20 6v-6l20-12V24c0-3 1-6 4-6z" fill="#fffaf0" stroke="#b8621a" stroke-width="1"/>'
    '<ellipse cx="38" cy="28" rx="20" ry="10" fill="url(#gloss)" opacity="0.55"/></g>')

# ---- Play for it
svg('trophy', rad('ruby', [(0, '#ff8a9a'), (0.6, '#d0203a'), (1, '#6a0816')]) + lin('base', [(0, '#5a2c1a'), (1, '#2a120a')]),
    '<g filter="url(#sh)"><path d="M26 14h44v18c0 14-10 24-22 24S26 46 26 32z" fill="url(#gold)"/>'
    '<path d="M26 20H14c0 12 6 18 14 20M70 20h12c0 12-6 18-14 20" fill="none" stroke="url(#gold)" stroke-width="5"/>'
    '<path d="M42 54h12l2 12H40z" fill="url(#gold)"/><rect x="28" y="66" width="40" height="14" rx="3" fill="url(#base)"/><rect x="38" y="70" width="20" height="5" rx="1" fill="url(#gold)"/>'
    '<circle cx="48" cy="32" r="8" fill="url(#ruby)" stroke="#fff4c8" stroke-width="1.5"/>'
    '<path d="M30 18h14c-1 10-4 20-10 26-4-6-4-16-4-26z" fill="url(#gloss)" opacity="0.45"/></g>')

svg('pass', lin('tk', [(0, '#9a6ae8'), (0.55, '#5a2aa8'), (1, '#2a0e5a')], 0, 0, 1, 1),
    '<g filter="url(#sh)" transform="rotate(-12 48 48)"><path d="M10 26h76v14a8 8 0 0 0 0 16v14H10V56a8 8 0 0 0 0-16z" fill="url(#tk)" stroke="#f2cf7c" stroke-width="2"/>'
    '<path d="M64 28v40" stroke="#f2cf7c" stroke-width="1.6" stroke-dasharray="3 3"/>'
    + star(37, 48, 14) +
    '<path d="M70 38h10M70 46h10M70 54h8" stroke="#f2cf7c" stroke-width="2.4" stroke-linecap="round"/>'
    '<path d="M12 28h72v8c-24 4-48 4-72 0z" fill="url(#gloss)" opacity="0.35"/></g>')

svg('daily', lin('top', [(0, '#ff6a5a'), (1, '#b01e1a')]) + lin('pg', [(0, '#ffffff'), (1, '#e8dcc6')]),
    '<g filter="url(#sh)"><rect x="14" y="16" width="68" height="66" rx="10" fill="url(#pg)"/>'
    '<path d="M14 26a10 10 0 0 1 10-10h48a10 10 0 0 1 10 10v8H14z" fill="url(#top)"/>'
    '<rect x="28" y="8" width="6" height="16" rx="3" fill="url(#gold)"/><rect x="62" y="8" width="6" height="16" rx="3" fill="url(#gold)"/>'
    '<path d="M38 46h8a4 4 0 1 1 8 0h8v8a4 4 0 1 0 0 8v8H54a4 4 0 1 0-8 0h-8V62a4 4 0 1 1 0-8z" fill="#2fae6a" stroke="#14683a" stroke-width="1.2"/>'
    '<path d="M16 18h64v6c-22 3-44 3-64 0z" fill="url(#gloss)" opacity="0.5"/></g>')

svg('crown', rad('gemB', [(0, '#9ad8ff'), (1, '#1a4aa0')]) + rad('gemR', [(0, '#ff9aa8'), (1, '#a0102a')]) + rad('gemG', [(0, '#9affc0'), (1, '#0a7a3a')]),
    '<g filter="url(#sh)"><path d="M12 30l18 16 18-26 18 26 18-16-6 40H18z" fill="url(#gold)" stroke="#8a5a1c" stroke-width="1"/>'
    '<rect x="16" y="66" width="64" height="12" rx="3" fill="url(#gold)" stroke="#8a5a1c" stroke-width="1"/>'
    '<circle cx="12" cy="29" r="5" fill="url(#gold)"/><circle cx="48" cy="18" r="6" fill="url(#gold)"/><circle cx="84" cy="29" r="5" fill="url(#gold)"/>'
    '<circle cx="48" cy="56" r="7" fill="url(#gemR)"/><circle cx="30" cy="60" r="5" fill="url(#gemB)"/><circle cx="66" cy="60" r="5" fill="url(#gemG)"/>'
    '<circle cx="32" cy="72" r="2.6" fill="url(#gemR)"/><circle cx="48" cy="72" r="2.6" fill="url(#gemB)"/><circle cx="64" cy="72" r="2.6" fill="url(#gemR)"/>'
    '<path d="M20 34l10 10 18-22c-2 14-12 26-28 30z" fill="url(#gloss)" opacity="0.45"/></g>')

# ---- Families
svg('nochat', lin('bS', [(0, '#a8c4e8'), (0.5, '#5a7aa8'), (1, '#2a3e62')]) + NO_DEFS,
    '<g filter="url(#sh)">' + bubble('bS', '#1e2c48') +
    '<circle cx="32" cy="42" r="4.5" fill="#fff"/><circle cx="48" cy="42" r="4.5" fill="#fff"/><circle cx="64" cy="42" r="4.5" fill="#fff"/></g>' + NO)

svg('noads', lin('mg', [(0, '#ffe08a'), (0.6, '#e8a21c'), (1, '#8a5206')], 0, 0, 0, 1) + NO_DEFS,
    '<g filter="url(#sh)"><path d="M14 38h14l34-20v56L28 54H14z" fill="url(#mg)" stroke="#7a4806" stroke-width="1.2"/>'
    '<rect x="8" y="36" width="10" height="20" rx="3" fill="#c8761a"/><path d="M22 56l6 18h8l-4-18z" fill="#a85e12"/>'
    '<path d="M18 40h12l28-16v10c-14 2-28 6-40 10z" fill="url(#gloss)" opacity="0.55"/></g>' + NO)

svg('parents', lin('shd', [(0, '#7ae0a0'), (0.55, '#1f9a5a'), (1, '#0a5030')]),
    '<g filter="url(#sh)"><path d="M48 8l34 12v24c0 20-14 34-34 42C28 78 14 64 14 44V20z" fill="url(#shd)" stroke="url(#gold)" stroke-width="4"/>'
    '<path d="M32 46l11 11 21-22" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'
    '<path d="M48 13l29 10v12c-20-4-38-2-58 4V23z" fill="url(#gloss)" opacity="0.5"/></g>')

svg('healthy', lin('wood', [(0, '#b8743a'), (1, '#5a2c10')]) + lin('glass', [(0, '#e8f6ff', 0.55), (1, '#bfe2f5', 0.25)], 0, 0, 1, 0) + lin('sand', [(0, '#ffd890'), (1, '#e0a040')]),
    '<g filter="url(#sh)"><rect x="18" y="8" width="60" height="10" rx="4" fill="url(#wood)"/><rect x="18" y="74" width="60" height="10" rx="4" fill="url(#wood)"/>'
    '<rect x="22" y="18" width="5" height="56" fill="url(#wood)"/><rect x="69" y="18" width="5" height="56" fill="url(#wood)"/>'
    '<path d="M32 18h32c0 14-10 20-13 28 3 8 13 14 13 28H32c0-14 10-20 13-28-3-8-13-14-13-28z" fill="url(#glass)" stroke="#d8eef8" stroke-width="1.4"/>'
    '<path d="M38 28h20c-2 6-7 10-10 14-3-4-8-8-10-14z" fill="url(#sand)"/><path d="M34 72c2-8 8-12 14-14 6 2 12 6 14 14z" fill="url(#sand)"/>'
    '<path d="M47.4 46h1.2v12h-1.2z" fill="#e0a040"/><path d="M34 20h8c-1 10-3 16-6 20-2-6-2-12-2-20z" fill="#fff" opacity="0.45"/></g>')
print('wrote', len(list(out.glob('ic-*.svg'))), 'icons')
