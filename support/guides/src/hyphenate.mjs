#!/usr/bin/env node
// Copies a guide page with soft hyphens (U+00AD) in its justified text, for
// render.sh to print. Google Chrome on Linux has no hyphenation dictionaries
// of its own (it downloads them only into a normal profile), so in the
// headless print "hyphens: auto" does nothing and justified lines open wide
// gaps. The patterns are the TeX ones Chrome uses too (package "hyphen"), in
// the page's language (<html lang>).
//
//   node hyphenate.mjs <page>.html <out>.html     (out in the same folder)
//
// Only the running text of <p> and <li> is hyphenated (the justified ones;
// not .lead or .scope, which stay left), and in it no addresses or links
// (a dot or @ or / in the word), numbers, names with a capital inside
// (OpenVolley, eScoresheet) or words in capitals (SVRZ, PDF).

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PATTERNS = { de: 'hyphen/de-1996', en: 'hyphen/en-gb', fr: 'hyphen/fr', it: 'hyphen/it' };

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: node hyphenate.mjs <page>.html <out>.html');
  process.exit(2);
}
const html = readFileSync(src, 'utf8');
const lang = /<html[^>]*\blang="([a-z]{2})/.exec(html)?.[1];
if (!PATTERNS[lang]) throw new Error(`${src}: no hyphenation patterns for lang="${lang}"`);
const { hyphenateSync } = require(PATTERNS[lang]);

const SKIP_TOKEN = /[@/]|\.\p{L}|\d|&\w+;/u;
const word = (w) => (w.length < 6 || /\p{Ll}\p{Lu}/u.test(w) || w === w.toUpperCase() ? w : hyphenateSync(w, { html: false, minWordLength: 6 }));
const text = (s) => s.split(/(\s+)/).map((tok) => (SKIP_TOKEN.test(tok) ? tok : tok.replace(/\p{L}[\p{L}\p{M}]*/gu, word))).join('');
// The text between the tags of one element (tags themselves untouched)
const inner = (s) => s.split(/(<[^>]*>)/).map((part, i) => (i % 2 ? part : text(part))).join('');

const result = html.replace(/<(p|li)(\s[^>]*)?>([\s\S]*?)<\/\1>/g, (all, tag, attrs = '', body) => {
  if (/class="[^"]*\b(lead|scope)\b/.test(attrs)) return all;
  return `<${tag}${attrs}>${inner(body)}</${tag}>`;
});
writeFileSync(out, result);
