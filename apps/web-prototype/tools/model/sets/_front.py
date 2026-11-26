"""Hero pictures put straight onto the piece (the sets of pack glass1).

classic.build folds a turned body's picture round its axis: the picture's own light, glow and
shadow then repeat eight times round the piece and read as smears (the reason the first builds
of these sets looked mottled on the table). Here every part but the knight's side-on head takes
the hero picture as a straight projection from the front, showing through to the back: each
army looks like its picture from both players' seats, and only faces turned fully sideways
stretch it. The set needs HALF = 'full' for every type, so the whole picture is in the atlas.

How these sets' hero pictures (pics/<set>) were made, beyond README.md step 1:
- SDXL-Lightning's single step (strength 0.45) keeps the design but dulls glow and turns clear
  glass to ivory, and two steps (0.6) redesign. So a picture seen whole in the reference is a
  blend: the cut-out's own colours and glow below about 7 px (Gaussian low-pass of the picture
  the model was shown) plus the redraw's detail above it (the redraw minus its own low-pass).
- An army the reference does not show whole (sets/_recolour.py) and the small pawns take the
  two-step redraw as it is: there the cleaner surfaces matter more than the recoloured source.
- Every picture is set back on flat grey 128 inside its cut-out's outline; rim pixels within 32
  levels of the grey are pushed away from it, 6 px deep, so hero.cutout() does not bite into
  pale glass or chrome; a held staff standing clear of its figure is joined to it by a bridge
  in the piece's own colours. Each set module says which pieces took which."""
import classic
import kit

HALF = {t: 'full' for t in 'kqbnrp'}


def build(t, refs, spec):
    ob = classic.build(t, refs, spec)
    if t != 'n':
        kit.set_uv(ob, t, mode='front', fold=0)
    return ob
