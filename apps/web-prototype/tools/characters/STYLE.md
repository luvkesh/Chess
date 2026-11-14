# Chackmate characters: the look (v3)

The person rejected the earlier passes three times: "all characters look same", "old school and
goofy". The target is **cute, modern, AAA-quality 3D**: the appeal of a current animated feature or
a premium mobile game mascot, for children, premium and never casino. Original characters only.

## What made the old ones goofy and alike (do not repeat)

- **Bowling-pin bodies**: head, neck and chest the same width, a thick tube neck. Every animal
  shared `torso()` and `critter_head()`, so the silhouettes matched.
- **Staring ball eyes**: bulging spheres in thick lids, a ring of white all round, the same brown
  iris on almost everyone, looking straight ahead.
- **The same open grin** with a band of teeth and a tongue on every face.
- **Felt, not fur**: one short uniform pelt, no fluff, no direction, no colour change.
- **Bulbous muzzles** and big noses; costumes piled on (hat, coat, collar, prop) instead of design.
- Same camera, same pose, same expression, so 18 pictures read as one at badge size.

## The look

1. **Proportions.** Big head, small body: the head is about 60% of the picture's height and
   clearly wider than the shoulders. Short, narrow neck, mostly hidden by cheek fluff or a collar.
   Small, soft shoulders. Babyish: large cranium, low face, short muzzle, small nose.
2. **Eyes carry the appeal.** Large, set on or below the head's midline and well apart. A big
   dark iris and pupil that fill most of the opening, little or no white showing on small animals,
   **two catchlights** (one large upper, one small lower), a darker upper lash line. Eyes sit *in*
   the face (out <= 0.45), never bulging. Each character has its own eye colour, shape and lid
   line; nobody shares.
3. **Small mouths.** A small closed smile or a tiny open one. No tooth bands. Teeth only where
   they are the character (the beaver's two, the bunny's two), and small.
4. **Soft fur that reads as fur.** Longer and fluffier at cheeks, chest and ear tips, short on the
   muzzle; combed with the body's flow; root darker, tip lighter; clumped a little. Feathers as
   layered soft tufts. Scales small and satin, not rubber.
5. **One signature prop each**, small and well made, in the era's material (gold, enamel, silk,
   knit). No stacks of costume. The prop must not hide the face.
6. **Shape language differs per character**: round, pear, heart, tall oval, wide wedge, long
   snout. Design the *silhouette* first and check it as a black cut-out at 64 px against the
   others in your group and the benchmark.
7. **Expression and pose differ**: sweet, sly, proud, sleepy, eager, wise. A head tilt and a
   three-quarter turn (render.py POSE), eyes glancing, never all straight ahead.
8. **Colour**: clear, rich, slightly saturated; one main coat colour, one accent. No two
   characters in the same group may share a main colour unless the species demands it.

## Shared and fixed (do not change in a character thread)

`sdf.py`, `kit.py`, `common.py`, `render.py` (except your characters' own POSE and FRAME rows),
`to-art.py`. If you need a new helper, write it in your own `cast/<animal>.py`. If the shared kit
is truly wrong, tell the characters thread; it makes the change once for everyone.

- **Camera**: built by each character's return value `(camera location, look-at, lens)`; keep
  the location near `(0.55, 0.12, 3.9)` and lens 70 to 80. Framing: the whole head with ears or
  crest inside the picture, shoulders cut by the bottom edge, 6% clear space at the top.
- **Lighting**: `K.studio()` as is (soft warm key from upper left, cool rim right, warm rim left).
- **Render**: Cycles, `--size 800 --samples 96`, transparent film. Preview at `--size 300
  --samples 20` while you sculpt. Two renders at a time fit in memory, not more.
- **Output**: `python3 tools/characters/to-art.py --src <dir>` writes
  `apps/web-prototype/src/art/avatar-<animal>.webp` (480 px). The game (build.py inlines them, art.js
  frames them) and the website (apps/website/tools/render-art.js) both read those files.
- Blender: `/opt/bv/bin/python` (venv with the `bpy` 5.3 wheel, scikit-image, scipy). If the venv
  is missing: `python3.13 -m venv /opt/bv && /opt/bv/bin/pip install bpy scikit-image scipy pillow`.

## Working rules

- One file per character: `cast/<animal>.py` with `build()`. Touch only your group's files.
- Judge every render twice: at 800 px for quality and at **64 px beside the others** for
  distinctness. If two read alike at 64 px, change silhouette or colour, not details.
- Compare against the benchmark picture in `/mnt/project-files/characters-v3/` before you call
  one done.
- Gotchas: no SUBSURF at render time (it ran out of memory); models are y-up (`K.y_up()` handles
  it); never `str.replace` with an empty search string.
