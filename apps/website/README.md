# Website

The public site for Chackmate, served by `services/game-server` at `/`, with the families privacy policy at `/privacy` and the terms at `/terms`.

The audience is children and their parents, so the page is built to be safe as well as pretty: it sets no cookies, stores nothing on the device and makes no requests to other companies. Fonts, pictures and art are all inside the one HTML file.

| Path | What it is |
| --- | --- |
| `src/index.html` | Page template: the story, layout, styles and the script that drives the live 3D table behind the page (the coach's lesson, the world-wonder picker and the turning sets). |
| `img/` | Pictures as WebP: `crest` (the logo, the game's 3D knight), `<era>-hero` (the era room from the home-screen camera) and `set-<era>` (the era set on a pedestal). The page shows these stills until the live 3D is ready, and instead of it where WebGL is missing. |
| `guide.json`, `audio/` | Rooky's guide, built like JongClub's guided game: a card in the bottom right that says one line per section as the reader reaches it (`{coach}` is the coach's name from `packages/content/campaign.json`), and the recorded MP3s. The voice is off until someone taps the speaker. |
| `tools/render-art.js` | Draws the crest, animal portraits and era banners with the game's own `art.js`. |
| `build.py` | Inlines the game's fonts, its 3D renderer (three.js, `kit3d`, `pieces3d`, `world3d`, `scene`), `img/`, the art and the facts from `packages/content` (eras, coaches, sets, rooms, counts) into `index.html`. |
| `index.html` | The built page, committed. CI fails if it is stale. |
| `privacy.html`, `terms.html` | Written by hand, not built. |

## Commands

Needs Python 3 (with Pillow only to make new pictures) and Node 22.

```sh
python3 apps/website/build.py                      # rebuild index.html after changing src/, img/ or packages/content
python3 apps/website/build.py --preview /tmp/site  # stand-alone copy (index, privacy, terms) that links to the hosted game
```

## New pictures

The era pictures are rendered from the game itself, so they always match it. After changing a set, board or room, rebuild the game and run:

```sh
node apps/website/tools/shoot.js [crest,egypt,venice,...]   # PNGs in tools/out (Playwright, SwiftShader: about 3 minutes for all)
python3 apps/website/tools/to-webp.py                 # into img/
python3 apps/website/build.py
```

`shoot.js` sets `window.__SHOT`, hides the menus and uses the table directly: the home-screen camera with the board pushed down (`hero`), `__view.snapshot` for the set on its pedestal, and the black gold-and-silver knight alone for the crest (`to-webp.py` puts it on the ruby disc). Keep each picture under about 140 KB; the whole page is about 3.7 MB, of which the 3D renderer is about 1.1 MB.

## The coach's audio guide

The clips are recorded offline with Kokoro-82M in Rooky's voice from the game ("Toby", the Kokoro blend `am_puck,am_michael`), using the same setup as `tools/voice/record.py`:

```sh
HF_HOME=... python3.12 apps/website/tools/record-guide.py   # audio/<section>.mp3 and audio/index.json
python3 apps/website/build.py
```

`build.py` stops if a clip no longer matches its line in `guide.json` or the coach's name, so after renaming the coach or changing a line, record again.
