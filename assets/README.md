# Site images

| File | What | Source |
|---|---|---|
| `brand/openvolley-lockup.svg` | Header logo: OpenVolley logo A (mark + wordmark, outlined paths, no font needed) | logo A `lockup.svg` |
| `brand/openvolley-mark.svg` | The ball alone (hero, indoor app card) | logo A `mark.svg` |
| `brand/og-image.png` | 1200×630 link preview: the lockup on white | rendered from the lockup |
| `openbeach-mark.png` | OpenBeach mark (beach app card) | **placeholder**: the current OpenBeach ball, 256 px |
| `readvolley-mark.png` | ReadVolley mark (rules card) | current ReadVolley image, 256 px |

The favicons sit in the site root: `favicon.svg`, `favicon.ico` (16/32/48 from logo A's
favicon PNGs) and `apple-touch-icon.png` (180 px, the mark on white).

**Swapping the OpenBeach logo:** replace `openbeach-mark.png` with the new mark (square,
transparent or white background). If the new file is an SVG, also change the one
`src="assets/openbeach-mark.png"` in `index.html`.

`fonts/` is created by `build.sh` from `@fontsource-variable/inter`; it is not committed.
