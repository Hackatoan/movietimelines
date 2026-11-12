#!/usr/bin/env node
/* Pre-renders one crawlable page per franchise at /<id>/index.html from franchise.html +
   data/<id>.json. The tracker still boots client-side (engine.js reads #app[data-fid]);
   this just means Googlebot gets a real title, description, canonical, watch-order list
   and FAQ in the raw HTML instead of an empty "Loading…" shell behind ?f=<id>.
   Run after adding/editing a franchise:  node scripts/gen-franchise-pages.mjs  */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://timelines.hackatoa.com';

globalThis.window = globalThis;
await import('../assets/core.js');
const MT = globalThis.MT;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ldSafe = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

const tpl = readFileSync(join(root, 'franchise.html'), 'utf8');
const reg = JSON.parse(readFileSync(join(root, 'data/franchises.json'), 'utf8'));
const ids = (reg.order || []).filter((id) => !id.startsWith('_'));

for (const id of ids) {
  const data = JSON.parse(readFileSync(join(root, `data/${id}.json`), 'utf8'));
  const items = MT.flatten(data);
  const seo = MT.seoInfo(data, items);
  const url = `${BASE}/${id}/`;
  const tierLabel = Object.fromEntries((data.tiers || []).map((t) => [t.id, t.label]));
  const core = items.filter((i) => i._tier === 'core');

  const meta = (it) => {
    const bits = [it.date, it.kind];
    if (MT.isSeries(it)) bits.push(`${MT.epTotal(it)} episodes`);
    else if (it.runtime) bits.push(MT.fmtH(it.runtime));
    if (it._tier !== 'core' && tierLabel[it._tier]) bits.push(`optional: ${tierLabel[it._tier]}`);
    return bits.filter(Boolean).map(esc).join(' · ');
  };
  const eras = (data.eras || []).map((era) => `
      <h3>${esc(era.title)}${era.span ? ` <small>(${esc(era.span)})</small>` : ''}</h3>
      <ol>${(era.items || []).map((it) => `<li><b>${esc(it.name)}</b> — ${meta(it)}</li>`).join('')}</ol>`).join('');

  const faq = [
    [`What order should I watch ${data.title} in?`,
      `In in-universe timeline order: ${core.slice(0, 6).map((i) => i.name).join(', ')}${core.length > 6 ? ', and so on' : ''}. The full list above is in story order${data.datesLabel ? ` (${data.datesLabel.toLowerCase()})` : ''}.`],
    [`How many ${data.title} movies and shows are there?`,
      `${seo.films} film${seo.films === 1 ? '' : 's'} and ${seo.series} series in the main timeline and optional extras combined (${items.length} entries in total).`],
    [`How long does it take to watch all of ${data.title}?`,
      `About ${seo.hrs} hours back to back, counting every film's runtime and every episode at its average length.`],
  ];
  if (data.tiers && data.tiers.length) {
    faq.push([`Do I need to watch everything?`,
      `No. The core entries are the main story; ${data.tiers.map((t) => `${t.label}${t.note ? ` (${t.note})` : ''}`).join('; ')} are optional and can be toggled on in the tracker.`]);
  }

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'MovieTimelines', item: BASE + '/' },
        { '@type': 'ListItem', position: 2, name: data.title, item: url },
      ] },
      { '@type': 'ItemList', name: `${data.title} watch order`, description: seo.desc, numberOfItems: items.length,
        itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name })) },
      { '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  };

  const staticApp = `<div class="seo-static">
    <h1>${esc(seo.h1)}</h1>
    ${data.tagline ? `<p>${esc(data.tagline)}</p>` : ''}
    <p>${esc(seo.desc)}</p>
    <h2>${esc(data.title)} in timeline order</h2>${eras}
  </div>`;
  const about = `<section class="seo-about" aria-labelledby="faq-h">
    <h2 id="faq-h">${esc(data.title)} watch order — FAQ</h2>
    ${faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n    ')}
    <p><a href="/">All franchise timelines</a></p>
  </section>`;

  let html = tpl
    .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="/">')
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(seo.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(seo.desc)}">`)
    .replace('<!-- Social defaults (engine.js sets per-franchise title/description/canonical) -->', [
      `<link rel="canonical" href="${url}">`,
      `<meta name="robots" content="index,follow,max-image-preview:large">`,
      `<meta property="og:title" content="${esc(seo.ogTitle)}">`,
      `<meta property="og:description" content="${esc(seo.desc)}">`,
      `<meta property="og:url" content="${url}">`,
      `<meta name="twitter:title" content="${esc(seo.ogTitle)}">`,
      `<meta name="twitter:description" content="${esc(seo.desc)}">`,
      `<script type="application/ld+json" id="ld-franchise">${ldSafe(ld)}</script>`,
    ].join('\n'))
    // Localized trackers stay on /<loc>/franchise.html?f=; this page is the English canonical.
    .replace(/\n\s*<!-- i18n:hreflang:start -->[\s\S]*?<!-- i18n:hreflang:end -->/, '')
    .replace(/(<a href="\/[a-z-]*\/?franchise\.html)(" hreflang)/g, `$1?f=${id}$2`)
    .replace('<script src="assets/legacy-redirect.js"></script>\n', '')
    .replace('<div id="app"><div class="loading">Loading…</div></div>', `<div id="app" data-fid="${esc(id)}">${staticApp}</div>\n  ${about}`);
  html = html.replace(/<a href="\/franchise\.html\?f=[^"]*"( hreflang="en")/, `<a href="/${id}/"$1`);

  mkdirSync(join(root, id), { recursive: true });
  writeFileSync(join(root, id, 'index.html'), html);
}
console.log(`wrote ${ids.length} franchise pages`);
