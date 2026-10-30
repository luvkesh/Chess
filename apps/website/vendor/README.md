# vendor

Fonts the website inlines on top of the game's own (`apps/web-prototype/vendor/fonts.css`). Nothing is fetched at run time.

| File | What | Licence |
| --- | --- | --- |
| `devanagari.css` | Noto Sans Devanagari 400 and 600, Noto Serif Devanagari 600 (Devanagari subset) as base64 `@font-face` rules, for the Hindi site. | SIL Open Font License 1.1 |

Rebuild from `npm pack @fontsource/noto-sans-devanagari @fontsource/noto-serif-devanagari` (5.3.0), using the `*-devanagari-devanagari-<weight>-normal.woff2` files.
