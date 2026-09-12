#!/usr/bin/env node
/* Regenerates sitemap.xml from data/franchises.json.
   Run after adding a franchise:  node scripts/gen-sitemap.mjs  */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://timelines.hackatoa.com';
const today = new Date().toISOString().slice(0, 10);

const reg = JSON.parse(readFileSync(join(root, 'data/franchises.json'), 'utf8'));
const ids = (reg.order || []).filter((id) => !id.startsWith('_')); // skip demo/template

const urls = [
  { loc: `${BASE}/`, priority: '1.0', changefreq: 'weekly' },
  ...ids.map((id) => ({ loc: `${BASE}/franchise.html?f=${id}`, priority: '0.8', changefreq: 'weekly' })),
];

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) =>
    `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n` +
    `    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  ).join('\n') +
  `\n</urlset>\n`;

writeFileSync(join(root, 'sitemap.xml'), xml);
console.log(`sitemap.xml written with ${urls.length} URLs`);
