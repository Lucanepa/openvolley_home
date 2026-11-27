// Hyphenation for the justified running text: the support page's answers and
// descriptions (support/build.mjs) and the guide PDFs (guides/src/
// hyphenate.mjs, printed by render.sh). Soft hyphens (U+00AD) go in at build
// time, in the page's language, with the TeX patterns of the "hyphen" package
// (Chrome's patterns too), so the result no longer depends on whether a
// browser or the PDF printer has hyphenation dictionaries. The CSS asks for
// "hyphens: manual": only these break points count.
//
// Left whole: button labels and other quoted text («…», “…”, „…“, "…"),
// addresses and links (a word with @, :// or a dot before a letter, or
// starting with / or #), anything with a digit, names with a capital inside
// (OpenVolley, eScoresheet), words in capitals (SVRZ, PDF) and words under
// six letters. A slash between two letters (Vereinsverantwortliche/r,
// Schreiber/in) gets a break opportunity after it, and each side is
// hyphenated on its own.

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PATTERNS = { de: 'hyphen/de-1996', en: 'hyphen/en-gb', fr: 'hyphen/fr', it: 'hyphen/it' };
const hyphenators = {};

function hyphenator(lang) {
  if (!PATTERNS[lang]) throw new Error(`no hyphenation patterns for "${lang}"`);
  hyphenators[lang] ||= require(PATTERNS[lang]).hyphenateSync;
  return hyphenators[lang];
}

const QUOTED = /«[^«»]*»|“[^“”]*”|„[^„“”]*[“”]|"[^"]*"/g;
const LEAVE = /[@#]|:\/\/|\.\p{L}|^\/|\d/u;
const SLASH = /(?<=\p{L})\/(?=\p{L})/u;

/**
 * Plain text with soft hyphens. `wbr` is what goes after a slash between
 * letters: '<wbr>' in HTML, or a marker the caller replaces after escaping.
 */
export function hyphenate(text, lang, { wbr = '<wbr>' } = {}) {
  const hyph = hyphenator(lang);
  const word = (w) => (w.length < 6 || /\p{Ll}\p{Lu}/u.test(w) || w === w.toUpperCase()
    ? w
    : hyph(w, { html: false, minWordLength: 6 }));
  const letters = (s) => s.replace(/\p{L}[\p{L}\p{M}]*/gu, word);
  const token = (tok) => {
    if (LEAVE.test(tok)) return tok;
    return SLASH.test(tok) ? tok.split(SLASH).map(letters).join(`/${wbr}`) : letters(tok);
  };
  const plain = (s) => s.split(/(\s+)/).map((tok, i) => (i % 2 ? tok : token(tok))).join('');
  // quoted text stays as it is
  let result = '';
  let last = 0;
  for (const m of text.matchAll(QUOTED)) {
    result += plain(text.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return result + plain(text.slice(last));
}

/**
 * An HTML fragment (the inside of one element): the text between the tags,
 * not the tags, nor the text of links (<a>) or code.
 */
export function hyphenateHtml(html, lang) {
  let skip = 0;
  return html.split(/(<[^>]*>)/).map((part, i) => {
    if (i % 2) {
      if (/^<(a|code)\b/i.test(part)) skip++;
      else if (/^<\/(a|code)>/i.test(part)) skip = Math.max(0, skip - 1);
      return part;
    }
    return skip ? part : hyphenate(part, lang);
  }).join('');
}
