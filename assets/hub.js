/* MovieTimelines — home hub (index.html). Requires core.js (MT). */
(function () {
  const mineWrap = document.getElementById('mine');
  const commWrap = document.getElementById('community');
  const search = document.getElementById('search');
  const registry = [];   // {meta, data, items(lowername[])}

  fetch('data/franchises.json', { cache: 'no-cache' })
    .then((r) => r.json())
    .then((reg) => Promise.all((reg.order || []).map(loadOne)))
    .then((entries) => {
      entries.filter(Boolean).forEach((e) => registry.push(e));   // preserve registry order
      applyQueryParam();
      injectItemListLD();
      render();
    })
    .catch(() => { mineWrap.innerHTML = '<p class="empty">Couldn’t load the franchise list.</p>'; });

  function loadOne(id) {
    return fetch(`data/${id}.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return null;
        data.id = data.id || id;
        const names = MT.flatten(data).map((it) => it.name.toLowerCase());
        return { data, names };
      })
      .catch(() => null);
  }

  function applyQueryParam() {
    try {
      const q = new URLSearchParams(location.search).get('q');
      if (q) search.value = q;
    } catch (e) {}
  }

  function injectItemListLD() {
    const base = 'https://timelines.hackatoa.com';
    const list = registry.filter((e) => !String(e.data.id).startsWith('_'));
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Franchises on MovieTimelines',
      numberOfItems: list.length,
      itemListElement: list.map((e, i) => ({
        '@type': 'ListItem', position: i + 1, name: e.data.title,
        url: `${base}/franchise.html?f=${e.data.id}`,
      })),
    };
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
  }

  function statsFor(data) {
    const K = MT.keys(data.id);
    const done = MT.loadSet(K.done);
    const skip = MT.loadSet(K.skip);
    const filters = MT.loadObj(K.filters, MT.defaultFilters(data));
    return MT.stats(data, done, skip, filters);
  }

  function card(entry) {
    const d = entry.data;
    const st = statsFor(d);
    const a = document.createElement('a');
    a.className = 'card';
    a.href = `franchise.html?f=${encodeURIComponent(d.id)}`;
    a.style.setProperty('--card-accent', d.accent || 'var(--accent)');
    const tagCls = d.community ? 'community' : 'mine';
    const tagTxt = d.community ? 'Community' : (d.author || 'Mine');
    a.innerHTML =
      `<div class="poster">${d.emoji || '\u{1F3AC}'}</div>`
      + `<div class="body">`
      + `<div class="title-row"><h3>${esc(d.title)}</h3><span class="tag ${tagCls}">${esc(tagTxt)}</span></div>`
      + `<p class="tagline">${esc(d.tagline || '')}</p>`
      + `<div class="stats">`
      + `<span class="mini-bar"><i style="width:${st.pct}%"></i></span>`
      + `<span class="pctnum">${st.pct}%</span>`
      + `</div>`
      + `<div class="stats"><span>${st.doneItems}/${st.totItems} titles</span><span>&middot;</span><span>≈${MT.fmtH(st.leftMin)} left</span></div>`
      + (entry._matchHint ? `<div class="stats author">matches: ${esc(entry._matchHint)}</div>` : '')
      + `</div>`;
    return a;
  }

  function render() {
    const q = (search.value || '').trim().toLowerCase();
    let shown = registry.slice();

    shown.forEach((e) => { e._matchHint = ''; });
    if (q) {
      shown = shown.filter((e) => {
        const d = e.data;
        if ((d.title + ' ' + (d.tagline || '') + ' ' + (d.author || '')).toLowerCase().includes(q)) return true;
        const hit = e.names.find((n) => n.includes(q));
        if (hit) {
          // show original-case hint
          const orig = MT.flatten(d).map((i) => i.name).find((n) => n.toLowerCase() === hit);
          e._matchHint = orig || '';
          return true;
        }
        return false;
      });
    }

    // stable order: keep registry order (which follows franchises.json)
    const mine = shown.filter((e) => !e.data.community);
    const comm = shown.filter((e) => e.data.community);

    paint(mineWrap, mine, 'mineCount');
    paint(commWrap, comm, 'commCount');
    document.getElementById('commSection').hidden = comm.length === 0 && !!q ? true : false;
    if (!q) document.getElementById('commSection').hidden = registry.filter((e) => e.data.community).length === 0;
  }

  function paint(wrap, list, countId) {
    wrap.innerHTML = '';
    const c = document.getElementById(countId);
    if (c) c.textContent = list.length;
    if (!list.length) { wrap.innerHTML = '<p class="empty">No matches.</p>'; return; }
    list.forEach((e) => wrap.appendChild(card(e)));
  }

  // sync layer refreshes cards after cloud data is adopted
  window.MTSyncReload = render;

  search.addEventListener('input', render);
  // "/" focuses search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== search) { e.preventDefault(); search.focus(); }
  });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
})();
