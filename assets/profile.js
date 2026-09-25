/* MovieTimelines — profile page. Requires core.js (MT). */
(function () {
  const registry = [];
  const strip = document.getElementById('statstrip');

  fetch('data/franchises.json', { cache: 'no-cache' })
    .then((r) => r.json())
    .then((reg) => Promise.all((reg.order || []).map(loadOne)))
    .then((entries) => { entries.filter(Boolean).forEach((e) => registry.push(e)); render(); })
    .catch(() => { strip.innerHTML = '<p class="empty">Couldn’t load your profile.</p>'; });

  function loadOne(id) {
    return fetch(`data/${id}.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!data) return null; data.id = data.id || id; return { data }; })
      .catch(() => null);
  }

  function statsFor(d) {
    const K = MT.keys(d.id);
    return MT.stats(d, MT.loadSet(K.done), MT.loadSet(K.skip), MT.loadObj(K.filters, MT.defaultFilters(d)));
  }

  function card(entry, opts) {
    const d = entry.data; const st = entry._st;
    const a = document.createElement('a');
    a.className = 'card'; a.href = `franchise.html?f=${encodeURIComponent(d.id)}`;
    a.style.setProperty('--card-accent', d.accent || 'var(--accent)');
    const saved = MT.isSaved(d.id);
    const rightMeta = opts.mode === 'saved'
      ? `<span>${st.totItems} titles</span><span>&middot;</span><span>≈${MT.fmtH(st.totMin)}</span>`
      : `<span>${st.doneItems}/${st.totItems}</span><span>&middot;</span><span>≈${MT.fmtH(st.leftMin)} left</span>`;
    a.innerHTML =
      `<div class="poster">${d.emoji || '\u{1F3AC}'}`
      + `<button class="savebtn${saved ? ' on' : ''}" type="button" aria-label="Save to profile" aria-pressed="${saved}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg></button></div>`
      + `<div class="body">`
      + `<div class="title-row"><h3>${esc(d.title)}</h3><span class="tag ${d.community ? 'community' : 'mine'}">${esc(d.community ? 'Community' : (d.author || 'Mine'))}</span></div>`
      + `<p class="tagline">${esc(d.tagline || '')}</p>`
      + (opts.mode !== 'saved' ? `<div class="stats"><span class="mini-bar"><i style="width:${st.pct}%"></i></span><span class="pctnum">${st.pct}%</span></div>` : '')
      + `<div class="stats">${rightMeta}</div>`
      + `</div>`;
    const sb = a.querySelector('.savebtn');
    sb.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      MT.toggleSaved(d.id); render();
    });
    return a;
  }

  function paint(id, list, countId, mode) {
    const wrap = document.getElementById(id);
    const sec = document.getElementById(id + 'Section');
    document.getElementById(countId).textContent = list.length;
    wrap.innerHTML = '';
    sec.hidden = list.length === 0;
    list.forEach((e) => wrap.appendChild(card(e, { mode })));
  }

  function render() {
    registry.forEach((e) => { e._st = statsFor(e.data); e._prog = MT.hasProgress(e.data); });

    const watching = registry.filter((e) => e._prog && e._st.pct < 100);
    const completed = registry.filter((e) => e._prog && e._st.totItems > 0 && e._st.pct === 100);
    const saved = registry.filter((e) => MT.isSaved(e.data.id) && !e._prog);

    // overall stats
    const doneTitles = registry.reduce((a, e) => a + e._st.doneItems, 0);
    const watchedMin = registry.reduce((a, e) => a + e._st.watMin, 0);
    strip.innerHTML = [
      tile(doneTitles, 'titles watched'),
      tile(MT.fmtH(watchedMin), 'time watched'),
      tile(watching.length, 'in progress'),
      tile(completed.length, 'completed'),
      tile(registry.filter((e) => MT.isSaved(e.data.id)).length, 'saved'),
    ].join('');

    paint('watching', watching, 'watchingCount', 'watching');
    paint('saved', saved, 'savedCount', 'saved');
    paint('completed', completed, 'completedCount', 'completed');

    document.getElementById('emptyState').hidden = !(watching.length === 0 && completed.length === 0 && saved.length === 0);
  }

  function tile(v, label) {
    return `<div class="stat-tile"><span class="stat-v">${esc(String(v))}</span><span class="stat-l">${esc(label)}</span></div>`;
  }

  // let the sync layer refresh after cloud data is adopted
  window.MTSyncReload = render;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
})();
