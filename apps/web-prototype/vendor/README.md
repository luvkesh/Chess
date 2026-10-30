# vendor

Third-party code and fonts that `build.py` inlines into the single-file game. Nothing here is fetched at run time, so the game makes no third-party requests (important for a children's app).

| File | What | Licence |
| --- | --- | --- |
| `three.bundle.js` | three.js r180 plus the add-ons the renderer uses (EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, RoomEnvironment, RoundedBoxGeometry, BufferGeometryUtils), bundled as one script that sets `window.THREE`. | MIT, notice at the top of the file |
| `fonts.css` | Cinzel, Cinzel Decorative, Cormorant Garamond and Jost (Latin subsets) as base64 `@font-face` rules. | SIL Open Font License 1.1 |
| `fonts-deva.css` | Hind (400, 500, 600) for text and Martel (600, 700) for titles, Devanagari subsets, as base64 `@font-face` rules. Added to the page only when Hindi is picked. | SIL Open Font License 1.1 |

## Rebuilding

```sh
mkdir /tmp/v && cd /tmp/v && npm init -y
npm install three@0.180.0 esbuild@0.25.10 @fontsource/cinzel @fontsource/cinzel-decorative @fontsource/cormorant-garamond @fontsource/jost
# three-entry.js imports three and the add-ons above and assigns them to window.THREE
npx esbuild three-entry.js --bundle --minify --format=iife --legal-comments=none --target=es2019 --outfile=three.bundle.js
```

Then prepend the three.js MIT licence as a comment. `fonts.css` is generated from the `@fontsource/*/files/*-latin-*.woff2` files (Cinzel Decorative 700; Cinzel 500, 600, 700; Cormorant Garamond 500, 600, 700 and italic 500, 600; Jost 400, 500, 600). `fonts-deva.css` comes the same way from `@fontsource/hind` and `@fontsource/martel` (`*-devanagari-*.woff2`).
