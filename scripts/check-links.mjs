#!/usr/bin/env node
// Checks the links in the built site (dist/): every internal href/src must
// resolve to a file the way Cloudflare Pages serves it (/x -> x.html or
// x/index.html, or a rule in _redirects), and every #anchor must exist.
// With --external it also requests each external URL once.
//
//   npm run build && npm run check:links [-- --external]

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, posix } from 'node:path';

const DIST = 'dist';
const external = process.argv.includes('--external');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const redirects = new Map();
if (existsSync(join(DIST, '_redirects'))) {
  for (const line of readFileSync(join(DIST, '_redirects'), 'utf8').split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && !parts[0].startsWith('#')) redirects.set(parts[0], parts[1]);
  }
}

/** URL path -> file in dist, as Cloudflare Pages would serve it. */
function resolve(pathname) {
  if (redirects.has(pathname)) return resolve(redirects.get(pathname));
  const p = decodeURIComponent(pathname).replace(/^\//, '');
  const candidates = p === '' || p.endsWith('/') ? [join(DIST, p, 'index.html')] : [join(DIST, p), join(DIST, `${p}.html`), join(DIST, p, 'index.html')];
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) || null;
}

const ids = new Map();
const idsOf = (file) => {
  if (!ids.has(file)) ids.set(file, new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return ids.get(file);
};

const errors = [];
const externals = new Map();
const pages = walk(DIST).filter((f) => f.endsWith('.html'));

for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const pagePath = '/' + relative(DIST, file).split('\\').join('/');
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const ref = m[1].replace(/&amp;/g, '&');
    if (/^(mailto:|tel:|data:)/.test(ref)) continue;
    if (/^https?:\/\//.test(ref)) {
      if (!externals.has(ref)) externals.set(ref, file);
      continue;
    }
    const [path, hash] = ref.split('#');
    const target = path === '' ? file : resolve(path.startsWith('/') ? path : posix.join(posix.dirname(pagePath), path));
    if (!target) {
      errors.push(`${file}: broken link ${ref}`);
      continue;
    }
    if (hash && target.endsWith('.html') && !idsOf(target).has(hash)) errors.push(`${file}: missing anchor ${ref}`);
  }
}

if (external) {
  for (const [url, file] of externals) {
    try {
      const opts = { redirect: 'follow', headers: { 'user-agent': 'openvolley-link-check' } };
      let res = await fetch(url, { ...opts, method: 'HEAD' });
      if (res.status >= 400) res = await fetch(url, opts);
      if (res.status >= 400) errors.push(`${file}: ${url} -> HTTP ${res.status}`);
    } catch (e) {
      errors.push(`${file}: ${url} -> ${e.cause?.code || e.message}`);
    }
  }
}

console.log(`Checked ${pages.length} pages${external ? `, ${externals.size} external URLs` : ` (${externals.size} external URLs not requested; use --external)`}.`);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('All links resolve.');
