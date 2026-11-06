# Piece sound sources

Every sound a piece makes on the board is built from the real recordings in `sources/`. All of
them are **CC0 1.0** (public domain, https://creativecommons.org/publicdomain/zero/1.0/): free for
commercial use, no attribution required. We credit the recordists anyway.

| File in `sources/` | What it is | Recordist | Original |
|---|---|---|---|
| `elboss-piece-placement.mp3` | A wooden chess piece set down on a wooden board | el_boss | Freesound 546119, "Piece Placement", pack "Chess Puzzle Blitz SFX" (30764) |
| `mh2o-alabaster.wav` | A chess piece moved on an alabaster board (8 kHz original) | mh2o | Freesound 351518, "chess_move_on_alabaster.wav" |
| `j1987-put-item.ogg` | An object put down on a wooden surface | j1987 | Freesound 335751, "put_item.wav" |
| `kenney-impactWood_*`, `kenney-impactGlass_*`, `kenney-impactPlate_light_*`, `kenney-impactSoft_medium_*` | Recorded taps on wood, glass, ceramic and felt | Kenney (www.kenney.nl) | "Impact Sounds" 1.0 (2019), CC0 |

Copies were taken from public mirrors of those packs (the el_boss and alabaster files as published
in open-source chess projects that credit them as CC0; the Kenney pack from its CC0 distribution).

## How the packs are made

`python3 apps/web-prototype/tools/sfx.py` (Python 3, numpy, ffmpeg) writes `wood.mp3`,
`marble.mp3`, `glass.mp3`, `soft.mp3` and `index.json`. Each pack has three weight tiers with four
takes each:

- **L1** king and queen: pitched lowest, longest, loudest, with the most board thump under it.
- **L2** rook, bishop and knight.
- **L3** pawn: lighter, brighter, shorter.

| Pack | Built from |
|---|---|
| Felted Wood | the real wooden chess piece and the put-down recording, with wood grain and body from Kenney's wood taps |
| Marble | the real alabaster chess move for the stone body, with the bright top end of a ceramic tap |
| Crystal Glass | Kenney's light, medium and heavy glass taps (one per weight) |
| Soft Touch | the wooden chess piece with its top end rolled off, over a felt tap |

In the game (`src/audio.js`) each move picks a take that differs from the last one and nudges its
pitch and level slightly, so no two moves sound identical. A capture is a light tap of the taken
piece followed by the capturing piece setting down.
