# Legal pages

`build.sh` runs `node legal/build.mjs dist`, which renders
`legal/<lang>/<doc>.md` to static pages in the site style. No dependencies.

| Document | DE | EN | FR | IT |
|---|---|---|---|---|
| privacy.md | /datenschutz | /en/privacy | /fr/confidentialite | /it/privacy |
| impressum.md | /impressum | /en/imprint | /fr/mentions-legales | /it/note-legali |
| terms.md | /nutzungsbedingungen | /en/terms | /fr/conditions | /it/condizioni |
| opensource.md | /open-source | /en/open-source | /fr/open-source | /it/open-source |

German is the binding version. The apps link to these URLs (openvolley:
`escoresheet/frontend/src/legal/legalLinks.js`), so keep them stable.

## Address and place of jurisdiction

Fill them in once in `legal/operator.txt`. The build puts them into every
language where the texts say `[ADRESSE / ADDRESS]` or
`[GERICHTSSTAND / PLACE OF JURISDICTION]`; until then the pages show the
placeholder highlighted and the build prints a warning.

## Updating the texts

The markdown is a copy of `escoresheet/docs/legal/<lang>/*.md` in the
openvolley repository, where the texts are maintained (with the data map and
the internal review notes, which are not published). After a change there:

```bash
for l in de en fr it; do cp ../openvolley/escoresheet/docs/legal/$l/{privacy,impressum,terms,opensource}.md legal/$l/; done
npm run build && npm run check:links
```

The converter knows a small markdown subset: `#`/`##`/`###` headings, the
`**Product** · Version · <date>` line under the title, paragraphs (a trailing
`\` is a line break), `-` and `1.` lists, pipe tables, `**bold**`,
`` `code` ``, `[text](privacy.md)` links (mapped to the page URLs) and bare
URLs and email addresses. "section 12" / "Abschnitt 12" / "sezione 12" link to
the numbered heading. Anything else fails the build or renders as text, so
check the page after editing.
