# Support pages

`build.sh` runs `node support/build.mjs dist`, which writes the support page
in four languages and copies the videos (and the guide PDFs listed in
`GUIDES`, none for now). No dependencies beyond the site's own
(`lucide-static` for the icons).

| Language | Page |
|---|---|
| DE | /support |
| EN | /en/support |
| FR | /fr/support |
| IT | /it/support |

Each page has one section per help section of the app, with the anchor
`#<id>` (`home`, `setup`, `coin-toss`, `scoring`, `subs-timeouts`,
`sanctions`, `set-end`, `match-end`, `corrections`, `connections`, `referee`,
`bench`, `livescore`, `handover`, `sync-offline`, `install-updates`): the
video, the questions (`#q-<id>-<question>` opens one) and "Ask about this",
which opens the contact form with that area. Then the downloads, "Which app for
what" and the contact form.

The app's "?" help links to `https://openvolley.app/support#<id>`. The German
page at the root sends such a link (or `?lang=en|fr|it`) on to the reader's
language, unless they picked one with the language switch.

## Files

| File | What | Served at |
|---|---|---|
| `help.json` | The questions and answers per section, in en/de/fr/it | (built into the pages) |
| `videos/<id>.mp4`, `<id>.jpg`, `<id>.<lang>.vtt` | One video per section, its poster and subtitles | /support/videos/ |
| `videos/manifest.json` | The videos: titles, length, size, app version | (read by the build) |
| `GUIDES` in `build.mjs` | Guide PDFs from the repository root, none listed now: the Quick guide (January 2026) shows a real referee's name and the old look, the roll-out deck is the January plan. List only a current guide with invented names | /support/guides/ |
| `../support.css`, `../support.js` | Style, search and contact form | /support.css, /support.js |

The app streams the videos from `/support/videos/` too, so keep those names.
Cloudflare Pages takes files up to 25 MiB; the videos are made to stay under
6 MB each (the build stops above 25 MiB and warns above 6 MB).

## Updating

The texts come from the app (`escoresheet/frontend/src/components/help/` and
the `contextHelp.*` keys of its locales, openvolley repository). After a
change there:

```bash
# in the openvolley checkout
node escoresheet/frontend/scripts/export-help.mjs --out ../openvolley_home/support/help.json
```

The videos are recorded from the real app after a release, with the recorder
in `support-videos/tools/` (kept with the recordings, not in this
repository; its `README.md` says how). Copy the results in:

```bash
cp <recordings>/*.mp4 <recordings>/*.jpg <recordings>/*.vtt <recordings>/manifest.json support/videos/
npm run build && npm run check:links
```

A section of `help.json` without a video in the manifest is built without
one (with a warning).

## The contact form

It posts `multipart/form-data` to `https://backend.openvolley.app/api/contact`
(`escoresheet/backend/lib/contact.js`), the same contract as the app's
Support & feedback dialog: `contactType`, `area` (a section id or `other`),
`supportType`, `email`, `comments`, `source=website`, `language`,
`platform=web`, `url`, `userAgent`, `timestamp`, the honeypot `website` and up
to 5 `files` (10 MB together). The backend mails support@openvolley.app with
Reply-To the user, which FreeScout (support.openvolley.app) reads. support.js
sends it; the form has no `action` and its Send button is disabled until the
script runs, so without JavaScript nothing is posted and the page says to
write to support@openvolley.app.
