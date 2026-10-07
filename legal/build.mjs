#!/usr/bin/env node
// Renders the legal texts (legal/<lang>/<doc>.md) to static pages in the
// site style. No dependencies: the markdown is a small, known subset
// (headings, paragraphs, hard breaks, lists, pipe tables, bold, inline code,
// links, bare URLs and email addresses), and this converter handles exactly
// that subset.
//
//   node legal/build.mjs <outdir>     (build.sh passes dist)
//
// The markdown is a copy of escoresheet/docs/legal/<lang>/*.md in the
// openvolley repository; see legal/README.md for how to update it.
// The operator's address and the place of jurisdiction come from
// legal/operator.txt, the one place to fill them in.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2];
if (!OUT) {
  console.error('usage: node legal/build.mjs <outdir>');
  process.exit(2);
}

const SITE = 'https://openvolley.app';
const LANGS = ['de', 'en', 'fr', 'it'];
const DOCS = ['privacy', 'impressum', 'terms', 'opensource'];

// Clean URLs. Cloudflare Pages serves /datenschutz from datenschutz.html.
// Keep in step with the shared constant in the openvolley repository
// (escoresheet/frontend/src/legal/legalLinks.js) and with openbeach.
export const ROUTES = {
  de: { privacy: '/datenschutz', impressum: '/impressum', terms: '/nutzungsbedingungen', opensource: '/open-source' },
  en: { privacy: '/en/privacy', impressum: '/en/imprint', terms: '/en/terms', opensource: '/en/open-source' },
  fr: { privacy: '/fr/confidentialite', impressum: '/fr/mentions-legales', terms: '/fr/conditions', opensource: '/fr/open-source' },
  it: { privacy: '/it/privacy', impressum: '/it/note-legali', terms: '/it/condizioni', opensource: '/it/open-source' },
};

const UI = {
  de: {
    name: 'Deutsch',
    eyebrow: 'Rechtliches',
    contents: 'Inhalt',
    skip: 'Zum Inhalt springen',
    language: 'Sprache',
    home: 'OpenVolley Startseite',
    legalNav: 'Rechtliches',
    links: { privacy: 'Datenschutz', impressum: 'Impressum', terms: 'Nutzungsbedingungen', opensource: 'Open Source' },
    free: 'freie Software unter der',
    source: 'Quellcode',
    section: /\b(Abschnitte?)(\s+)(\d{1,2})(?:(\s+und\s+)(\d{1,2}))?\b/g,
    months: ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'],
  },
  en: {
    name: 'English',
    eyebrow: 'Legal',
    contents: 'Contents',
    skip: 'Skip to content',
    language: 'Language',
    home: 'OpenVolley home',
    legalNav: 'Legal',
    links: { privacy: 'Privacy', impressum: 'Legal notice', terms: 'Terms of use', opensource: 'Open source' },
    free: 'free software under the',
    source: 'Source code',
    section: /\b(sections?)(\s+)(\d{1,2})(?:(\s+and\s+)(\d{1,2}))?\b/g,
    months: ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
  },
  fr: {
    name: 'Français',
    eyebrow: 'Informations légales',
    contents: 'Sommaire',
    skip: 'Aller au contenu',
    language: 'Langue',
    home: 'Accueil OpenVolley',
    legalNav: 'Informations légales',
    links: { privacy: 'Protection des données', impressum: 'Mentions légales', terms: "Conditions d'utilisation", opensource: 'Open source' },
    free: 'logiciel libre sous la',
    source: 'Code source',
    section: /\b(sections?)(\s+)(\d{1,2})(?:(\s+et\s+)(\d{1,2}))?\b/g,
    months: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  },
  it: {
    name: 'Italiano',
    eyebrow: 'Note legali',
    contents: 'Indice',
    skip: 'Vai al contenuto',
    language: 'Lingua',
    home: 'Pagina iniziale OpenVolley',
    legalNav: 'Note legali',
    links: { privacy: 'Protezione dei dati', impressum: 'Note legali', terms: "Condizioni d'uso", opensource: 'Open source' },
    free: 'software libero sotto la',
    source: 'Codice sorgente',
    section: /\b(sezion[ei])(\s+)(\d{1,2})(?:(\s+e\s+)(\d{1,2}))?\b/g,
    months: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  },
};

// ---------- operator.txt: the one place for address and jurisdiction ----------

const PLACEHOLDERS = {
  address: '[ADRESSE / ADDRESS]',
  jurisdiction: '[GERICHTSSTAND / PLACE OF JURISDICTION]',
};

function readOperator() {
  const values = {};
  for (const raw of readFileSync(join(HERE, 'operator.txt'), 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) values[m[1]] = m[2].trim();
  }
  for (const key of Object.keys(PLACEHOLDERS)) {
    if (!(key in values)) throw new Error(`legal/operator.txt: missing "${key}:" line`);
  }
  return values;
}

const operator = readOperator();
const unfilled = Object.keys(PLACEHOLDERS).filter(
  (k) => !operator[k] || operator[k] === PLACEHOLDERS[k],
);

function operatorHtml(key) {
  if (unfilled.includes(key)) {
    return `<mark class="placeholder" title="legal/operator.txt">${esc(PLACEHOLDERS[key])}</mark>`;
  }
  return operator[key].split('|').map((s) => esc(s.trim())).filter(Boolean).join('<br>\n');
}

// ---------- inline markdown ----------

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const HARD_BREAK = '\u0002';

/**
 * Renders one block of inline text. Pieces that must not be touched again
 * (code, links, placeholders) are stashed behind \u0001n\u0001 tokens and
 * put back at the end.
 */
function inline(text, ctx) {
  const stash = [];
  const put = (html) => `\u0001${stash.push(html) - 1}\u0001`;

  for (const [key, ph] of Object.entries(PLACEHOLDERS)) {
    text = text.split(ph).join(put(operatorHtml(key)));
  }
  text = text.replace(/`([^`]+)`/g, (_, code) => put(`<code>${esc(code)}</code>`));
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) =>
    put(`<a href="${esc(mapHref(href, ctx))}">${inline(label, ctx)}</a>`),
  );
  text = text.replace(
    /\bhttps?:\/\/[^\s<>()]+|\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s<>()]*|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g,
    (match) => {
      let url = match;
      let tail = '';
      while (/[.,;:!?]$/.test(url)) {
        tail = url.slice(-1) + tail;
        url = url.slice(0, -1);
      }
      const href = url.includes('@') && !url.includes('/') ? `mailto:${url}` : url.startsWith('www.') ? `https://${url}` : url;
      return put(`<a href="${esc(href)}">${esc(url)}</a>`) + tail;
    },
  );
  if (ctx.sections.size) {
    text = text.replace(ctx.ui.section, (all, word, sp, n1, conj, n2) => {
      const link = (n) => (ctx.sections.has(n) ? put(`<a href="#${ctx.sections.get(n)}">${n}</a>`) : n);
      return `${word}${sp}${link(n1)}${conj ? `${conj}${link(n2)}` : ''}`;
    });
  }

  text = esc(text);
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  if (ctx.lang === 'fr') {
    // French spacing: narrow no-break space before : ; ! ? and inside « ».
    text = text.replace(/ ([:;!?»])/g, ' $1').replace(/« /g, '« ');
  }
  text = text.split(HARD_BREAK).join('<br>\n');
  while (/\u0001\d+\u0001/.test(text)) {
    text = text.replace(/\u0001(\d+)\u0001/g, (_, i) => stash[Number(i)]);
  }
  return text;
}

function mapHref(href, ctx) {
  const m = href.match(/^([a-z]+)\.md(#.*)?$/);
  if (m && DOCS.includes(m[1])) return ROUTES[ctx.lang][m[1]] + (m[2] || '');
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  throw new Error(`${ctx.file}: unknown link target "${href}"`);
}

/** Joins wrapped lines; a trailing backslash is a hard line break. */
function joinLines(lines) {
  return lines
    .map((l) => l.trim())
    .map((l) => (l.endsWith('\\') ? l.slice(0, -1).trimEnd() + HARD_BREAK : l + ' '))
    .join('')
    .trim();
}

// ---------- blocks ----------

function slug(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const isListItem = (l) => /^(- |\d+\. )/.test(l);
const isBlockStart = (l) => /^#{1,3} /.test(l) || l.startsWith('|') || isListItem(l);

function parse(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,3}) (.*)$/);
    if (h) {
      blocks.push({ type: `h${h[1].length}`, text: h[2].trim() });
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (rows.length < 2 || !/^\|?[\s:|-]+\|?$/.test(rows[1])) throw new Error(`table without separator: ${rows[0]}`);
      blocks.push({ type: 'table', head: cells(rows[0]), rows: rows.slice(2).map(cells) });
      continue;
    }
    if (isListItem(line)) {
      const ordered = /^\d+\. /.test(line);
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        if (isListItem(l)) {
          items.push([l.replace(/^(- |\d+\. )/, '')]);
          i++;
        } else if (/^\s{2,}\S/.test(l) && items.length) {
          items[items.length - 1].push(l);
          i++;
        } else if (!l.trim() && i + 1 < lines.length && isListItem(lines[i + 1])) {
          i++;
        } else break;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items: items.map(joinLines) });
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && isBlockStart(lines[i]))) para.push(lines[i++]);
    blocks.push({ type: 'p', text: joinLines(para) });
  }
  return blocks;
}

function renderBlocks(blocks, ctx) {
  const out = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'h2':
        out.push(`<h2 id="${b.id}">${inline(b.text, ctx)}</h2>`);
        break;
      case 'h3':
        out.push(`<h3>${inline(b.text, ctx)}</h3>`);
        break;
      case 'p':
        out.push(`<p>${inline(b.text, ctx)}</p>`);
        break;
      case 'ul':
      case 'ol':
        out.push(`<${b.type}>\n${b.items.map((t) => `  <li>${inline(t, ctx)}</li>`).join('\n')}\n</${b.type}>`);
        break;
      case 'table': {
        const head = b.head.map((c) => `<th scope="col">${inline(c, ctx)}</th>`).join('');
        const body = b.rows.map((r) => `    <tr>${r.map((c) => `<td>${inline(c, ctx)}</td>`).join('')}</tr>`).join('\n');
        out.push(`<div class="table-wrap">\n<table>\n  <thead><tr>${head}</tr></thead>\n  <tbody>\n${body}\n  </tbody>\n</table>\n</div>`);
        break;
      }
      default:
        throw new Error(`unexpected block ${b.type}`);
    }
  }
  return out.join('\n');
}

/** "7. Oktober 2026" / "7 October 2026" / "7 octobre 2026" -> 2026-10-07 */
function isoDate(text, ui) {
  const m = text.toLowerCase().match(/(\d{1,2})\.?\s+([a-zà-ü]+)\s+(\d{4})/);
  if (!m) return null;
  const month = ui.months.indexOf(m[2]) + 1;
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// ---------- page ----------

// Inline SVG copied from lucide-static 1.52.0 (ISC License, Copyright (c)
// Lucide Icons and Contributors, https://lucide.dev), like index.html.
const CALENDAR_ICON = '<svg class="icon lucide-calendar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>';
const CHEVRON_ICON = '<svg class="icon toc-chevron lucide-chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';

const FOOTER_ICONS = 'Icons: <a href="https://lucide.dev">Lucide</a> (ISC) · Font: <a href="https://rsms.me/inter/">Inter</a> (SIL OFL 1.1)';

export function legalLinksHtml(lang, current) {
  const ui = UI[lang];
  return DOCS.map((doc) => {
    const cur = doc === current ? ' aria-current="page"' : '';
    return `<a href="${ROUTES[lang][doc]}"${cur}>${esc(ui.links[doc])}</a>`;
  }).join(' · ');
}

function page({ lang, doc, title, meta, toc, body }) {
  const ui = UI[lang];
  const url = SITE + ROUTES[lang][doc];
  const alternates = LANGS.map(
    (l) => `  <link rel="alternate" hreflang="${l}" href="${SITE}${ROUTES[l][doc]}">`,
  ).join('\n');
  const switcher = LANGS.map((l) => {
    const cur = l === lang ? ' aria-current="page"' : '';
    return `<a href="${ROUTES[l][doc]}" lang="${l}" hreflang="${l}" title="${UI[l].name}"${cur}>${l.toUpperCase()}</a>`;
  }).join('');
  const tocItems = toc.map((t) => `          <li><a href="#${t.id}">${inline(t.text, { lang, ui, sections: new Map(), file: doc })}</a></li>`).join('\n');
  const description = `${title} – OpenVolley ${lang === 'de' ? 'und' : lang === 'en' ? 'and' : lang === 'fr' ? 'et' : 'e'} OpenBeach`;

  return `<!DOCTYPE html>
<html lang="${lang}">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)} – OpenVolley</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="#e2001a">
  <meta name="color-scheme" content="light">
  <link rel="canonical" href="${url}">
${alternates}
  <link rel="alternate" hreflang="x-default" href="${SITE}${ROUTES.de[doc]}">

  <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">

  <link rel="preload" href="/assets/fonts/inter-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/landing.css">
  <link rel="stylesheet" href="/legal.css">
</head>

<body>
  <a class="skip-link" href="#main">${esc(ui.skip)}</a>

  <header class="topbar">
    <div class="wrap">
      <a class="brand" href="/" aria-label="${esc(ui.home)}">
        <img src="/assets/brand/openvolley-lockup.svg" alt="OpenVolley" width="149" height="32" draggable="false">
      </a>
      <nav class="lang-switch" aria-label="${esc(ui.language)}">${switcher}</nav>
    </div>
  </header>

  <main id="main" class="wrap legal-main">
    <header class="legal-head">
      <p class="eyebrow">${esc(ui.eyebrow)}</p>
      <h1>${esc(title)}</h1>
      <p class="legal-meta">${meta}</p>
    </header>

    <div class="legal-layout">
      <details class="card toc" open>
        <summary><span class="eyebrow">${esc(ui.contents)}</span>${CHEVRON_ICON}</summary>
        <ol>
${tocItems}
        </ol>
      </details>
      <script>if (!matchMedia('(min-width: 1024px)').matches) document.currentScript.previousElementSibling.open = false;</script>

      <article class="card legal-doc">
${body}
      </article>
    </div>
  </main>

  <footer class="footer">
    <div class="wrap">
      <nav class="legal-links" aria-label="${esc(ui.legalNav)}">${legalLinksHtml(lang, doc)}</nav>
      <p>OpenVolley · ${esc(ui.free)} <a href="https://github.com/Lucanepa/openvolley/blob/main/LICENSE">GPL-3.0</a> · <a href="https://github.com/Lucanepa/openvolley">${esc(ui.source)}</a></p>
      <p>${FOOTER_ICONS}</p>
    </div>
  </footer>
</body>

</html>
`;
}

function build() {
  let count = 0;
  for (const lang of LANGS) {
    const ui = UI[lang];
    for (const doc of DOCS) {
      const file = `legal/${lang}/${doc}.md`;
      const blocks = parse(readFileSync(join(HERE, lang, `${doc}.md`), 'utf8'));

      const h1 = blocks.shift();
      if (h1?.type !== 'h1') throw new Error(`${file}: must start with "# title"`);
      // Second block: "**Product** · Version 1.0 · As of <date>"
      const metaBlock = blocks[0]?.type === 'p' && blocks[0].text.startsWith('**') ? blocks.shift() : null;
      if (!metaBlock) throw new Error(`${file}: missing the "**…** · … · <date>" line`);

      const sections = new Map();
      const used = new Set();
      const toc = [];
      for (const b of blocks.filter((x) => x.type === 'h2')) {
        let id = slug(b.text) || 'section';
        while (used.has(id)) id += '-x';
        used.add(id);
        b.id = id;
        toc.push({ id, text: b.text });
        const n = b.text.match(/^(\d{1,2})\. /);
        if (n) sections.set(n[1], id);
      }

      const ctx = { lang, ui, sections, file };
      // Product and version as text, the date ("As of …") as a chip.
      const parts = metaBlock.text.split(' · ');
      const datePart = parts.find((part) => isoDate(part, ui));
      if (!datePart) throw new Error(`${file}: no date in "${metaBlock.text}"`);
      const rest = parts.filter((part) => part !== datePart).map((part) => inline(part, ctx));
      const meta =
        `<span>${rest.join(' · ')}</span>` +
        `<time class="chip" datetime="${isoDate(datePart, ui)}">${CALENDAR_ICON}${inline(datePart, ctx)}</time>`;

      const html = page({
        lang,
        doc,
        title: h1.text,
        meta,
        toc,
        body: renderBlocks(blocks, ctx),
      });
      const outFile = join(OUT, `${ROUTES[lang][doc].slice(1)}.html`);
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, html);
      count++;
    }
  }
  console.log(`Legal pages: ${count} written.`);
  for (const key of unfilled) {
    console.warn(`WARNING: legal/operator.txt "${key}" is still the placeholder ${PLACEHOLDERS[key]}.`);
  }
}

build();
