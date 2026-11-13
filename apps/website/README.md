# Website

The public site for Chackmate, served by `services/game-server` at `/`, with the families privacy policy at `/privacy` and the terms at `/terms`.

The audience is children and their parents, so the page is built to be safe as well as pretty: it sets no cookies, stores nothing on the device and makes no requests to other companies. Fonts, pictures and art are all inside the one HTML file.

| Path | What it is |
| --- | --- |
| `src/index.html` | Page template: the story, layout, styles and the script that drives the live 3D table behind the page (the coach's lesson, the world-wonder picker and the turning sets). |
| `img/` | Pictures as WebP: `crest` (the logo, the game's 3D knight), `<era>-hero` (the era room from the home-screen camera), `set-<era>` (the era set on a pedestal) and `ic-<name>` (the page's icons, rendered in 3D by `tools/shoot-icons.js`). The page shows the stills until the live 3D is ready, and instead of it where WebGL is missing. |
| `tools/icons3d.js`, `tools/shoot-icons.js` | The icons: colourful 3D objects (lacquer, enamel, velvet and gold, with the game's own Regency pieces) built from three.js primitives in `icons3d.js`, lit and shot in a studio by `shoot-icons.js` into `img/ic-<name>.webp` on a transparent ground. Each stands alone on the dark ground with a soft shadow. The four hero icons (coach, lessons, online, boards) follow the hero mock-up: deep enamel in a gold frame with a gem finial on top. The house rule: icons are 3D illustrations, never flat line glyphs. |
| `guide.json`, `audio/` | Rooky's guide, built like JongClub's guided game: a card in the bottom right that says one line per section as the reader reaches it (`{coach}` is the coach's name from `packages/content/campaign.json`), and the recorded MP3s. The voice is off until someone taps the speaker. |
| `tools/render-art.js` | Draws the crest, animal portraits and era banners with the game's own `art.js`, and the colourful place badges of the Wonders passport from `tools/place-icons.js`. |
| `build.py` | Inlines the game's fonts, its 3D renderer (three.js, `kit3d`, `pieces3d`, `world3d`, `scene`), `img/`, the art and the facts from `packages/content` (eras, coaches, sets, rooms, counts) into `index.html`. |
| `fx/` | The details showcase's clips, recorded from the game's own 3D table by `tools/record-fx.js`: `<id>.mp4`, its poster `<id>.jpg`, and for sound packs `<id>.lands.json` (when each piece lands, so "Hear it" knocks in time). Served at `/fx/`. |
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

`shoot.js` sets `window.__SHOT`, hides the menus and uses the table directly: the home-screen camera with the board pushed down (`hero`), `__view.snapshot` for the set on its pedestal, and the black gold-and-silver knight alone for the crest (`to-webp.py` puts it on the ruby disc). Keep each picture under about 140 KB; the whole page is about 8 MB, of which the pictures are about 4 MB and the 3D renderer about 1.1 MB.

The icons are rendered the same way, from `ICONS` in `tools/icons3d.js` (the shapes, their materials and the camera's angle for each):

```sh
node apps/website/tools/shoot-icons.js [coach,lessons,...]   # img/ic-<name>.webp, 440 px, and a contact sheet in tools/out/icons (under a minute for all)
python3 apps/website/build.py
```

## The details showcase's clips

Each tab plays two items from `FX_DEMOS` in `build.py`. Effects, trails, clocks and sound packs are real footage of the game: `tools/record-fx.js` opens the built game in Chromium, sets the table up the way the Collection's "Try on the table" preview does, and saves every frame on a fake clock, so SwiftShader's slowness never shows (about 10 minutes a clip). Avatars and frames are the game's medal art, drawn on the page.

```sh
python3 apps/web-prototype/build.py
node apps/website/tools/record-fx.js [ids]   # default: every effect in FX_DEMOS
python3 apps/website/build.py
```

## The coach's audio guide

The clips are recorded offline with Kokoro-82M in Rooky's voice from the game ("Toby", the Kokoro blend `am_puck,am_liam`), using the same setup as `tools/voice/record.py`:

```sh
HF_HOME=... python3.12 apps/website/tools/record-guide.py   # audio/<section>.mp3 and audio/index.json
python3 apps/website/build.py
```

`build.py` stops if a clip no longer matches its line in `guide.json` or the coach's name, so after renaming the coach or changing a line, record again.
