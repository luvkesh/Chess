# Website

The public site for Chacklate Chess, served by `services/game-server` at `/`, with the families privacy policy at `/privacy` and the terms at `/terms`.

The audience is children and their parents, so the page is built to be safe as well as pretty: it sets no cookies, stores nothing on the device and makes no requests to other companies. Fonts, pictures and art are all inside the one HTML file.

| Path | What it is |
| --- | --- |
| `src/index.html` | Page template: layout, styles and the small script for the hero slideshow, the era explorer and the cards. |
| `img/` | Pictures as WebP: `<era>-hero` and `<era>-room` (the era room from the home-screen camera, wide and close), `<era>-game` (the era board and set from the player's seat), `set-<era>` (the era set on a pedestal), `museum` and `phone` (game screens). |
| `tools/render-art.js` | Draws the crest, animal portraits and era banners with the game's own `art.js`. |
| `build.py` | Inlines the game's fonts, `img/`, the art and the facts from `packages/content` (eras, coaches, sets, rooms, counts) into `index.html`. |
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
node apps/website/tools/shoot.js [egypt,venice,...]   # PNGs in tools/out (Playwright, SwiftShader: about 3 minutes for all eras)
python3 apps/website/tools/to-webp.py                 # into img/
python3 apps/website/build.py
```

`shoot.js` sets `window.__SHOT`, hides the menus and uses the table directly: the home-screen camera with the board pushed down (`hero`, `room`), the low player view (`game`), and `__view.snapshot` for the set on its pedestal. Keep each picture under about 140 KB; the whole page is about 3.5 MB.
