"""Forest Guardians, sculpted (trial; build as: build.py tst forest=forest_sculpt): white elves
in ivory, green and gold against the black forest's treants, dryads and goblins in bark, moss
and bronze. Each piece is a true 3D shape made from its own hero picture
(pics/forest/<side>-<type>.jpg, cut from the user's board pictures of 2026-11-12: 1c104eea
white, 38e1c660 black, and redrawn sharper) and painted from it: see sculpt.py."""
import hero

SCULPT = True
SIDED = set('kqbnrp')
# the knights' pictures show them side on, heads to the picture's right: turned to look down the file
TURN = {'n': -90}
# the pictures are the pieces' colours as they are: no gold tone is laid over them. The white
# army is glazed ivory, the black one bark and moss, which do not shine; gold leaf and gems do.
LOOK = {
    'w': {'body': (0.42, 0.0), 'gold': 'gold', 'gem': 'gem', 'gold_tone': None, 'emit': 0.3,
          'classify': {'gold_sat': 0.6, 'gold_val': 0.55}},
    'b': {'body': (0.8, 0.0), 'gold': 'bronze', 'gem': 'gem', 'gold_tone': None, 'emit': 0.3,
          'classify': {'gold_sat': 0.72, 'gold_val': 0.62}},
}


def refs():
    return hero.refs(hero.pics('forest'))


# what each piece is, for the pictures of its back and sides (see sculpt.view)
WORDS = {
    'w': {'k': 'elf king chess piece, ivory armour with gold filigree, green cape, crown of gold antlers and leaves',
          'q': 'elf queen chess piece, long golden hair, ivory and gold gown, leaf crown, teal gems',
          'b': 'elf mage chess piece, white hood, ivory robe with gold trim, tall staff with blue crystal',
          'n': 'white stag chess knight, golden antlers, ivory and teal barding with gold filigree',
          'r': 'crystal lantern tower chess rook, ivory and gold gothic arches, glowing crystal spire',
          'p': 'elf sentry chess pawn, ivory armour, green and gold leaf shield, spear'},
    'b': {'k': 'treant king chess piece, dark bark armour with gold filigree, great antlers, long white hair, mantle of green leaves',
          'q': 'dryad queen chess piece, antler and flower crown, long brown hair, dark bark and leaf gown',
          'b': 'hooded druid chess piece, green hood with horns, dark bark robes, staff with green crystal',
          'n': 'wolf stag chess knight, dark bark fur, antlers, violet leaves on its back',
          'r': 'bark tree tower chess rook, battlements, glowing fire inside, moss and roots',
          'p': 'goblin chess pawn, dark bark skin, leafy ears, crouching'},
}
