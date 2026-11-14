# Modelled piece sets: how a set is rebuilt

The owner's bar (said many times): every set must match its reference picture to about 99%,
with super-high-quality models, minute details, natural scratches, shiny gems and intricate
patterns. Pieces built from simple shapes in code were rejected as "kiddish and similar", and
the first picture-based Forest set was called "ugly, ugly, ugly" for being blurry and smeared
with flat sides. Nothing ships unless it is clearly more beautiful than what is live.

This folder holds the tools. The work for one set is always the same four steps:

1. **Hero pictures**: one clean, sharp picture per piece (12 a set).
2. **Set module**: `sets/<id>.py` says how each piece is shaped and painted from its picture.
3. **Build and judge**: build the mesh pack, shoot it in the game, lay it beside the live set
   and the reference.
4. **Ship**: PR, merge on green CI, republish the game, tell the website thread.

Step 1 is the long one and the one everything else depends on, whichever 3D method turns the
pictures into shapes. Do it first and do it well.

## Rules that are not up for debate

- **Match the reference.** Where a set has a reference picture, the hero picture is that piece
  redrawn sharper, not redesigned. Keep comparing side by side.
- **Franchise-inspired sets stay original** (`elves`, `sunshadow`, `galactic`): the owner's
  pictures for them are close copies of Warcraft, Mario and Star Wars, so they set the mood
  only. No franchise names, logos, characters or signature props. Design new figures.
- **Children's game, premium, never casino.** No gore, nothing frightening beyond storybook.
- **New downloads need the owner's OK in your own thread, naming the tool.** Already OK'd:
  Blender (bpy), Segment Anything, TripoSR, SDXL-Lightning, TripoSG. Hunyuan3D is refused
  (its licence excludes the EU, UK and South Korea); check a tool's licence before asking.
- **Never spend the owner's credits** (Tripo, Rodin, Meshy) without their word for that use.
- **Shared code is owned by the recipe thread.** Do not edit `kit.py`, `classic.py`,
  `build.py`, `hero.py`, `tsr.py`, `sam.py`, `pack.py` or this file in a set thread: several
  threads build from them at once. If a set needs something they cannot do, put the special
  case in your set module, or ask the recipe thread ("Remodel new sets to match references").
- **One thread per mesh pack.** A pack is one file, `meshes/<pack>.txt`, rebuilt whole; two
  threads changing the same pack cannot be merged. The split is in the table at the end.
- **Every piece fits its square** and king > queen > the rest in height. `build.py` enforces
  this at build time; do not work round it.

## 0. Setup (once per container, about 20 minutes)

```
bash apps/web-prototype/tools/model/setup.sh
```

It makes two Python environments and fetches the models (18 GB; see the script's header for
what and where). The container's disk allowance is about 39 GB: `df -h /` shows what is left.
Everything runs on the CPU. Reference pictures the owner uploaded are in
`/mnt/project-files/uploads/hearth/` (files named by id, no extension, all PNG).

## 1. Hero pictures

A hero picture is the whole piece with its base, alone, upright, seen from the front, on a
flat mid-grey backdrop with clear grey all round: 768 x 1024,
`tools/model/pics/<set>/<side>-<type>.jpg` (`w`/`b`, `k q b n r p`). Knights may stand side on.
Look at `pics/forest/` and `pics/army/` for the standard.

### A set that has a reference picture

```
cd apps/web-prototype
/opt/bv/bin/python tools/model/picture/cutouts.py navy /tmp/cut/navy     # RGBA cut-outs + a check sheet + HEIGHTS
```

Look at `/tmp/cut/navy/navy-cutouts.jpg`. A cut-out with a neighbour's arm in it, a missing
staff or a chopped foot gives a bad picture however long it is redrawn: fix the set module's
boxes and Segment Anything points first (`neg=` points on the neighbour, `add=` strokes down
a staff). Keep the printed `HEIGHTS` for step 2.

Write a jobs file, one line per candidate (tabs between fields):

```
navy-w-k-45	/tmp/cut/navy/navy-w-k.png	0.45	7	chess king, ivory marble with gold leaf crown and ruby lozenges, turned Staunton shape, on round plinth, premium collectible, crisp fine detail, studio photo, plain grey background
navy-w-k-60	/tmp/cut/navy/navy-w-k.png	0.6	7	(same words)
```

```
~/.cache/chackmate/pv/bin/python tools/model/picture/i2i.py jobs.tsv /tmp/hero/navy     # 30 to 60 s a picture
python3 tools/model/picture/contact.py /tmp/hero/navy-w.jpg 6 /tmp/hero/navy/navy-w-*-45.png /tmp/hero/navy/navy-w-*-60.png
```

- Strength 0.45 keeps the design almost line for line and only sharpens. 0.6 is crisper and
  cleaner but starts to redesign: faces, hands and ornaments move. Make both for every piece,
  open the sheet, and take **the sharpest one that is still the same design**. Where both are
  wrong (a second head, a melted hand, a lost staff, dark blocks left from the cut-out), try
  0.5 and 0.55 with other seeds, or clean the cut-out and run it again.
- Say what the piece is, its material and its colours. The prompt is read to 77 tokens, about
  55 words; the tail is silently dropped after that.
- Both armies of a set must still read as one set: same plinths, same style.

```
python3 tools/model/picture/pick.py navy w-k=/tmp/hero/navy/navy-w-k-45.png w-q=... b-p=...
```

### A set with no reference picture (design first, the owner chooses)

The owner asked for this in these words: "you can provide me images to choose which upscales
the design and quality". For The Royal Army they were shown three directions and answered "a
mix of all 3. The clarity of A, material and shine of B and the premiumness of C in one."
That blend is the house taste: **crisply carved shapes, rich glossy materials (enamel,
polished gold, real gems), and a luxury finish (marble, inlay)**. `pics/army/` is the result.

1. Read the set's entry in `src/pieces3d.js` (`SETS.<id>`: name, era, story and one line per
   piece). Keep the set's idea, colours and which figure plays which piece. Upgrade the
   design and the quality; do not change what the set is.
2. Write prompts: the piece first, then material and colours, then one tail for the whole
   set. The Royal Army's, as a pattern:
   `Indian Maharaja chess king, full standing figure head to feet, jewelled crown, beard, one sceptre, crisp carved ivory marble figurine, glossy saffron enamel robe, polished gold inlay, rubies, round marble and gold plinth, front view, centered, studio photo, plain grey background, highly detailed`
   and for the dark army the same with `black marble`, `indigo enamel`, `emeralds`.
3. `picture/gen.py jobs.tsv OUT` with 3 or 4 seeds per piece (the same seeds for every piece).
   Choose per piece. Throw out anything with two heads, extra arms, a cropped top, no base, or
   a second figure. A whole figure must show head to feet.
4. Make one sheet for the set (`contact.py`, white row over black row, k q b n r p), save it
   to `/mnt/project-files/set-remodel/designs/<set>.jpg`, and show it to the owner in your
   thread with a decision card ("Use this design", "Change it": they say what). Recommend
   yours and keep working on it while you wait; a design is easy to redo.
5. `pick.py` the chosen pictures into `pics/<set>/`.

## 2. Set module

**A set that already has a module** (the 17 built from references): keep its `SPEC`, `LOOK`,
`HALF` and `SIDED`, and give its builders the hero pictures instead of the small cut-outs.
Rename the old `refs()` to `source_refs()` (cutouts.py still needs it) and add:

```python
import hero
HEIGHTS = {'w': {...}, 'b': {...}}        # printed by cutouts.py

def refs():
    return hero.refs(hero.pics('navy'), HEIGHTS)
```

`SPEC` heights are fractions of each piece's height, so they carry over; check every piece
all the same, because a redrawn picture can move a collar or a crown line by a few percent.
Pieces the old module stacked from parts (a pawn made of the bishop's foot and a pearl) now
come from their own hero picture like every other piece.

**A new set** gets a module like `sets/forest_hero.py`: hero pictures in, and per piece
either `classic.build(t, refs, SPEC)` (turned bodies, crowns, rooks with merlons, figures on a
turned plinth: read `classic.py` and the existing sets for the kinds) or `hero.build(t, refs)`
(the whole picture as one rounded relief; set `HERO = True`). Turned pieces (anything that is
round like a Staunton piece) should be turned: they are true 3D and look right from every
side. Add `mesh: '<pack>'` to the set in `src/pieces3d.js`.

The 3D method itself (how a picture becomes a shape) is being improved by the recipe thread:
a true 3D generator is on trial on Forest. Do not spend hours hand-tuning shapes; when the
better method lands, every set is rebuilt from the same hero pictures.

## 3. Build and judge

```
cd apps/web-prototype
git stash -u; python3 build.py; node tools/model/shots.js navy /tmp/shots/navy-live; git stash pop   # the live set, once
/opt/bv/bin/python tools/model/build.py classic1 navy sapphire fantasy opulent    # the whole pack, about a minute a set
python3 build.py && node tools/model/shots.js navy /tmp/shots/navy-new
python3 tools/model/ba.py navy /tmp/shots/navy-live /tmp/shots/navy-new /tmp/shots/navy-ba.jpg
```

Open the sheet. The low board views at the bottom are the ones that count: that is the camera
the owner was looking through when they called Forest ugly. Ship only when the new set is
clearly better than the live one for every piece and in the low views. Check for: blur,
smeared or stretched paint, streaky bases, dark seams round the outline, a piece that reads
as a flat cut-out from the side, a face that came out wrong, a piece much smaller or larger
than its neighbours, and both armies telling apart at a glance.

To try a single set without rebuilding a shared pack, build it into a scratch pack
(`build.py tst navy`), point the set at it for the moment (`mesh: 'tst'` in `src/pieces3d.js`)
and never commit either.

## 4. Ship

- Branch as your thread says. Commit the hero pictures, the set module, the pack
  (`meshes/<pack>.txt`), `src/pieces3d.js` if it changed, and the rebuilt
  `dist/` (`python3 build.py`). A conflict in `dist/chackmate.html` or `dist/meshes/` is
  settled by taking main's and running `python3 build.py` again.
- PRs merge themselves once CI is green (the owner's standing approval).
- After the merge: republish the live game artifact from a clean checkout of main (the page
  plus `meshes/<pack>.txt` as a file), and tell the website thread ("Improve website
  presentation and story flow") which packs changed, so it republishes them and re-shoots
  the set pictures. The game artifact has 511 file slots and about 470 are used: one new
  file per new pack, nothing else.
- Post one before-and-after sheet to the owner. Lead with the result.

## Sets, packs and who has them

Packs with a reference picture (ids in `/mnt/project-files/uploads/hearth/`):

| pack | sets | reference pictures |
| --- | --- | --- |
| `classic1` | `navy`, `sapphire`, `fantasy`, `opulent` | navy 1d2e35ab (board 9e5327a2), sapphire b781657f, fantasy e967ebaa, opulent bd922a12 |
| `classic2` | `pagoda`, `pharaoh`, `ocean`, `manhattan` | pagoda db8bfd70 48120445 383455ca, pharaoh 1f4e9ac8 e0d8aec1 cbb54601, ocean 4de778ec 6cbefc82 23b75d01, manhattan c3f9a4cd f389be7d 2fb43a43 |
| `glass1` | `clockwork`, `astral`, `elemental`, `neon`, `lumen` | clockwork 05344cff 2d7557d5, astral 22d85eab af439ac4 0d79e2bb, elemental c2d5507c 65938865, neon 2aaea82c, lumen be5ce42b |
| `figures2` | `dino`, `jarl`, `rune` (and the old `forest`) | dino e5e13bf3 2297d987, jarl and rune 46f45cce 9183b6fe |
| `forest1` (new) | `forest` | 1c104eea cf6d63e3 38e1c660. Recipe thread. |

Sets with no usable reference: design first (new packs, at most four sets each):

| pack | sets | note |
| --- | --- | --- |
| `figures3` | `elves`, `sunshadow`, `galactic` | franchise-inspired: original designs only. The owner's pictures (168b739a 78b7220f, a1778643, 12eb6d90) are mood, never copied |
| `world1` | `olympian`, `imperial`, `sounion` | |
| `world2` | `harappa`, `inca`, `sarsen`, `norse` | |
| `royal1` | `regency`, `staunton`, `tsarina`, `falcon` | |
| `jewel1` | `crystal`, `celestial`, `peacock` | |
| `india1` | `army`, `maharaja`, `chaturanga` | `army`: blended design shown to the owner 2026-11-13 (`pics/army`, sheet `/mnt/project-files/set-remodel/designs/royal-army-blend.jpg`) |
| `craft1` | `dynasty`, `murano`, `robots`, `astro` | |

## Things that went wrong before

- Hugging Face downloads stall unless `HF_HUB_DISABLE_XET=1` is set. `download.pytorch.org`
  is blocked; PyPI works.
- "No space left on device": `df` shows the session's own allowance. Delete pip caches, old
  venvs and models you no longer need; deletes work even when writes fail.
- `transformers` 5 refuses torch 2.5: keep the pins in `setup.sh`.
- A picture of a piece standing behind pawns has no foot: `kit.compose()` sets the visible
  figure on a plinth cut from another piece. Hero pictures end the need for it once made.
- Segment Anything can swallow a same-coloured neighbour or drop a thin staff. Look at the
  cut-out sheet every time.
- SDXL at strength 0.6 on a rough cut-out invents things. Clean the cut-out first.
- The game shows each army from both sides (your own from behind), and a carved piece's back
  shows the front picture through, so both players see faces. Pieces face the opponent: the
  front is game +z, Blender -y.
