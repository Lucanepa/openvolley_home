# Site images

| File | What | Source |
|---|---|---|
| `brand/openvolley-lockup.svg` | Header logo: OpenVolley logo A (mark + wordmark, outlined paths, no font needed) | logo A `lockup.svg` |
| `brand/openvolley-mark.svg` | The ball alone (hero, indoor app card) | logo A `mark.svg` |
| `brand/og-image.png` | 1200×630 link preview: the lockup on white | rendered from the lockup |
| `openbeach-mark.svg` | OpenBeach mark B2 "sun" (beach app card) | OpenBeach logo B2 `mark.svg` |
| `readvolley-mark.png` | ReadVolley mark (rules card) | current ReadVolley image, 256 px |

The favicons sit in the site root: `favicon.svg`, `favicon.ico` (16/32/48 from logo A's
favicon PNGs) and `apple-touch-icon.png` (180 px, the mark on white).

**Swapping the OpenBeach logo:** replace `openbeach-mark.svg` with the new mark (square,
transparent or white background). If the new file is not an SVG, also change the one
`src="assets/openbeach-mark.svg"` in `index.html`.

`fonts/` is created by `build.sh` from `@fontsource-variable/inter`; it is not committed.
