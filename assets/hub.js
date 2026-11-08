/* MovieTimelines — home hub (index.html). Requires core.js (MT). */
(function () {
  const mineWrap = document.getElementById('mine');
  const commWrap = document.getElementById('community');
  const search = document.getElementById('search');
  const registry = [];   // {meta, data, items(lowername[])}
  // statsFor() re-parses localStorage + re-walks every era/item (and, for long-running
  // shows, filters a 1000+ entry episode-id array) on every call. render() is wired to
  // the search box's 'input' event, so without caching this full recompute ran for every
  // visible franchise card on every keystroke. Progress data only changes via franchise.html
  // (a separate page load) or a cloud-sync adoption (which calls window.MTSyncReload), so
  // it's safe to cache per franchise id and only clear on sync.
  const statsCache = new Map();

  MT.registry()
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
        const items = MT.flatten(data);
        const names = items.map((it) => it.name.toLowerCase());
        const origNames = items.map((it) => it.name);
        return { data, names, origNames };
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
    if (statsCache.has(data.id)) return statsCache.get(data.id);
    const K = MT.keys(data.id);
    const done = MT.loadSet(K.done);
    const skip = MT.loadSet(K.skip);
    const filters = MT.loadObj(K.filters, MT.defaultFilters(data));
    const st = MT.stats(data, done, skip, filters);
    statsCache.set(data.id, st);
    return st;
  }

  // render() runs on every search keystroke and used to rebuild every visible card from an
  // innerHTML string (36 cards today). A card's content only depends on its franchise's
  // stats + saved state, which are already cached until a cloud-sync reload, so build each
  // card once and reuse the element; only the per-query "matches:" hint line changes.
  function card(entry) {
    if (!entry._card) entry._card = buildCard(entry);
    setHint(entry);
    return entry._card;
  }

  function setHint(entry) {
    const h = entry._matchHint || '';
    if (h === (entry._hintShown || '')) return;
    entry._hintShown = h;
    if (!h) { if (entry._hintEl) entry._hintEl.remove(); return; }
    if (!entry._hintEl) { entry._hintEl = document.createElement('div'); entry._hintEl.className = 'stats author'; }
    entry._hintEl.textContent = 'matches: ' + h;
    entry._card.querySelector('.body').appendChild(entry._hintEl);
  }

  function buildCard(entry) {
    const d = entry.data;
    const st = statsFor(d);
    // The save button is a sibling of the card link, not a child: a <button> inside an <a>
    // is invalid nested-interactive content and leaked "Save … to profile" into the link's name.
    const w = document.createElement('div');
    w.className = 'card-wrap';
    w.style.setProperty('--card-accent', MT.safeColor(d.accent) || 'var(--accent)');
    const a = document.createElement('a');
    a.className = 'card';
    a.href = MT.href(`franchise.html?f=${encodeURIComponent(d.id)}`);
    const tagCls = d.community ? 'community' : 'mine';
    const tagTxt = d.community ? 'Community' : (d.author || 'Mine');
    const saved = MT.isSaved(d.id);
    a.innerHTML =
      `<div class="poster" aria-hidden="true">${esc(d.emoji || '\u{1F3AC}')}</div>`
      + `<div class="body">`
      + `<div class="title-row"><h3>${esc(d.title)}</h3><span class="tag ${tagCls}">${esc(tagTxt)}</span></div>`
      + `<p class="tagline">${esc(d.tagline || '')}</p>`
      + `<div class="stats">`
      + `<span class="mini-bar"><i style="width:${st.pct}%"></i></span>`
      + `<span class="pctnum">${st.pct}%</span>`
      + `</div>`
      + `<div class="stats"><span>${st.doneItems}/${st.totItems} titles</span><span>&middot;</span><span>≈${MT.fmtH(st.leftMin)} left</span></div>`
      + `</div>`;
    const sb = document.createElement('button');
    sb.type = 'button'; sb.className = 'savebtn' + (saved ? ' on' : '');
    sb.setAttribute('aria-label', `Save ${d.title} to profile`);
    sb.setAttribute('aria-pressed', saved); sb.title = 'Save to your profile';
    sb.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>';
    sb.addEventListener('click', () => {
      const on = MT.toggleSaved(d.id);
      sb.classList.toggle('on', on); sb.setAttribute('aria-pressed', on);
    });
    w.append(a, sb);
    return w;
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
          // show original-case hint (already cached, no re-flatten needed)
          const idx = e.names.indexOf(hit);
          e._matchHint = idx >= 0 ? e.origNames[idx] : '';
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
    announce(q, shown.length);
  }

  // Screen-reader-only live region: typing in the search box re-renders the grid
  // silently, so announce the result count (debounced so it doesn't chatter per keystroke).
  const status = document.createElement('p');
  status.className = 'sr-only'; status.setAttribute('role', 'status');
  search.closest('.searchbar').appendChild(status);
  let announceTimer = 0;
  function announce(q, n) {
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      status.textContent = q ? (n ? `${n} franchise${n === 1 ? '' : 's'} found` : 'No franchises found') : '';
    }, 500);
  }

  function paint(wrap, list, countId) {
    const c = document.getElementById(countId);
    if (c) c.textContent = list.length;
    if (!list.length) { wrap.innerHTML = '<p class="empty">No matches.</p>'; return; }
    wrap.replaceChildren(...list.map(card));
  }

  // sync layer refreshes cards after cloud data is adopted — progress & saved list
  // may have changed, so drop the cached stats and saved set before repainting.
  window.MTSyncReload = () => { statsCache.clear(); registry.forEach((e) => { e._card = e._hintEl = null; e._hintShown = ''; }); if (typeof MT._invalidateSavedCache === 'function') MT._invalidateSavedCache(); render(); };

  search.addEventListener('input', render);
  // "/" focuses search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== search) { e.preventDefault(); search.focus(); }
  });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
})();
