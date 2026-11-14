"""Forest Guardians, hero rebuild (trial; build as: build.py <pack> forest_hero): white elves in ivory, green and gold against the black forest's treants,
dryads and goblins in bark, moss and bronze.
Hero set: each piece is its own picture (pics/forest/<side>-<type>.jpg), cut from the user's
board pictures of 2026-11-12 (1c104eea white, 38e1c660 black) and redrawn sharper with
SDXL-Lightning img2img; shape from TripoSR, sides and back painted from its views."""
import os
import hero
import classic
from sets.forest import SPEC

# CHACK_HERO_MODE=classic: the sharp pictures on turned plinths (classic.build) instead of
# whole-figure reliefs (the rook keeps its rounded TripoSR-depth relief, which reads as a tower)
MODE = os.environ.get('CHACK_HERO_MODE', 'hero')
HERO = True   # four painted views (the relief rook's sides use them in either mode)
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pics', 'forest')
PICS = {s: {t: os.path.join(HERE, '%s-%s.jpg' % (s, t)) for t in 'kqbnrp'} for s in 'wb'}
HALF = {t: 'full' for t in 'kqbnrp'}
SIDED = set('kqbnrp')
GOLD = (60, 165, 230)
LOOK = {
    'w': {'wb': (1.04, 1.0, 0.97), 'body': 'ceramic', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.6, 'gold_val': 0.55}},
    'b': {'wb': (1.0, 1.0, 1.0), 'body': 'wood', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.72, 'gold_val': 0.62}},
}



def refs():
    return hero.refs(PICS)


def build(t, refs):
    if MODE == 'classic' and t != 'r':
        return classic.build(t, refs, SPEC)
    return hero.build(t, refs)
