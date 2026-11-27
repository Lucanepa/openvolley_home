#!/usr/bin/env node
// Copies a guide page with soft hyphens (U+00AD) and break opportunities
// after slashes in its justified text, for render.sh to print. Google Chrome
// on Linux has no hyphenation dictionaries of its own (it downloads them only
// into a normal profile), so the headless print does not hyphenate by itself.
// The rules (what stays whole: quoted labels, links, addresses, numbers,
// names) are in support/hyphenate.mjs, shared with the support page.
//
//   node hyphenate.mjs <page>.html <out>.html     (out in the same folder)
//
// Only the running text of <p> and <li> is hyphenated (the justified ones;
// not .lead or .scope, which stay left), in the page's language (<html lang>).

import { readFileSync, writeFileSync } from 'node:fs';
import { hyphenateHtml } from '../../hyphenate.mjs';

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: node hyphenate.mjs <page>.html <out>.html');
  process.exit(2);
}
const html = readFileSync(src, 'utf8');
const lang = /<html[^>]*\blang="([a-z]{2})/.exec(html)?.[1];

const result = html.replace(/<(p|li)(\s[^>]*)?>([\s\S]*?)<\/\1>/g, (all, tag, attrs = '', body) => {
  if (/class="[^"]*\b(lead|scope)\b/.test(attrs)) return all;
  return `<${tag}${attrs}>${hyphenateHtml(body, lang)}</${tag}>`;
});
writeFileSync(out, result);
