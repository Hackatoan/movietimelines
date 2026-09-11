/* MovieTimelines — tracker engine (franchise.html). Requires core.js (MT). */
(function () {
  const qs = new URLSearchParams(location.search);
  const fid = (qs.get('f') || '').replace(/[^a-z0-9-]/gi, '');
  const app = document.getElementById('app');

  const CHECK = '<svg viewBox="0 0 24 24"><polyline points="4,12 10,18 20,6"/></svg>';
  const CHEV = '<svg viewBox="0 0 24 24"><polyline points="6,9 12,15 18,9"/></svg>';
  const XICON = '<svg viewBox="0 0 24 24"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>';

  if (!fid) { showError('No franchise selected.', 'Go back to the home page and pick one.'); return; }

  fetch(`data/${fid}.json`, { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => boot(data))
    .catch(() => showError('Couldn’t load this franchise.', `No data file for “${fid}”.`));

  function showError(title, msg) {
    app.innerHTML = `<div class="errbox"><p><b>${title}</b></p><p>${msg}</p><p><a class="btn ghost" href="index.html">← All franchises</a></p></div>`;
  }

  function boot(data) {
    // theme
    const root = document.documentElement.style;
    if (data.accent) {
      root.setProperty('--accent', data.accent);
      root.setProperty('--accent-ink', data.accentInk || '#0b0b0e');
      root.setProperty('--accent-soft', `color-mix(in srgb, ${data.accent} 14%, transparent)`);
      root.setProperty('--accent-line', `color-mix(in srgb, ${data.accent} 45%, transparent)`);
    }
    if (data.background && window.MTBackgrounds) window.MTBackgrounds.apply(data.background, data.accent);
    document.title = `${data.title} — Watch Order`;

    const K = MT.keys(fid);
    let done = MT.loadSet(K.done);
    let skip = MT.loadSet(K.skip);
    let filters = MT.loadObj(K.filters, MT.defaultFilters(data));

    const items = MT.flatten(data);
    const BY_ID = {}; items.forEach((it) => (BY_ID[it.id] = it));

    // ---- shell ----
    app.innerHTML = `
      <header class="f-hero">
        <div class="f-toprow"><a class="back" href="index.html">&larr; All franchises</a><span id="authbox" class="authbox"></span></div>
        <div class="f-title">
          <span class="emoji">${data.emoji || '\u{1F3AC}'}</span>
          <div>
            <h1>${esc(data.title)}${data.community ? '<span class="f-badge">Community</span>' : ''}</h1>
            <p class="sub">${esc(data.tagline || '')}${data.author ? ' &middot; by ' + esc(data.author) : ''}</p>
          </div>
        </div>
      </header>
      <div class="dock">
        <div class="dock-top">
          <span class="dock-label">Progress</span>
          <span class="dock-count"><b id="pct">0%</b> &middot; <span id="ndone">0</span>/<span id="ntotal">0</span> watched</span>
        </div>
        <div class="bar"><i id="fill"></i></div>
        <div class="timerow">
          <span class="t"><b id="twat">0h</b><span class="lab">watched</span></span>
          <span class="t"><b id="tleft">0h</b><span class="lab">left</span></span>
          <span class="t"><b id="ttot">0h</b><span class="lab">total</span></span>
        </div>
        <div class="dock-actions">
          <div class="filters" id="filters">${(data.tiers && data.tiers.length) ? '<span class="flabel">Include</span>' : ''}</div>
          <button class="reset" id="reset" type="button">Reset progress</button>
        </div>
      </div>
      <main id="list"></main>
      <footer class="site" id="ffoot"></footer>`;

    const list = document.getElementById('list');

    data.eras.forEach((group) => {
      const sec = document.createElement('section');
      sec.className = 'era';
      sec.dataset.era = group.items.map((i) => i.id).join(',');
      const ids = group.items.map((i) => i.id).join(',');
      sec.innerHTML = `<div class="era-head"><h2>${esc(group.title)}</h2><span class="rule"></span><span class="tally" data-tally="${ids}"></span></div>`
        + (group.span ? `<p class="era-span">${esc(group.span)}</p>` : '')
        + (group.note ? `<p class="era-note">${group.note}</p>` : '');

      const ul = document.createElement('ul'); ul.className = 'rows';
      group.items.forEach((it) => ul.appendChild(buildRow(it)));
      sec.appendChild(ul);
      list.appendChild(sec);
    });

    // footer
    document.getElementById('ffoot').innerHTML =
      `${data.datesLabel ? esc(data.datesLabel) + ' &middot; ' : ''}<b>Bold</b> = film &middot; the &#8856; button marks something you’re <b>not going to watch</b> (dropped from the count &amp; time-left).`
      + `<div style="margin-top:8px">Times are approximate. <a href="index.html">All franchises</a> &middot; <a href="https://buymeacoffee.com/hackatoa" target="_blank" rel="noopener">Buy me a coffee</a></div>`;

    // ---- filter chips ----
    const fbar = document.getElementById('filters');
    (data.tiers || []).forEach((t) => {
      const count = items.filter((it) => it._tier === t.id).length;
      if (!count) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'fchip'; b.dataset.tier = t.id;
      b.title = t.note || '';
      b.innerHTML = `<span class="fdot"></span>${esc(t.label)} <span class="fn">${count}</span>`;
      b.addEventListener('click', () => { filters[t.id] = !filters[t.id]; MT.saveObj(K.filters, filters); pushSync(); render(); });
      fbar.appendChild(b);
    });

    function buildRow(it) {
      const li = document.createElement('li');
      li.className = 'item'; li.dataset.id = it.id;
      const series = MT.isSeries(it);
      const kindCls = it.special ? 'kind special' : 'kind';
      const rtLabel = series ? `≈${MT.fmtH(MT.itemTotalMin(it))}` : MT.fmtH(it.runtime || 0);

      const row = document.createElement('div');
      row.className = 'row' + (it.film ? ' film' : '') + (series ? ' series' : '');
      row.innerHTML =
        `<span class="box" role="checkbox" tabindex="0" aria-label="Mark ${esc(it.name)} watched">${CHECK}<span class="dash"></span></span>`
        + `<span class="meta"><span class="title-line">`
        + `<span class="name">${esc(it.name)}</span>`
        + `<span class="${kindCls}">${esc(it.kind || (series ? 'Series' : 'Film'))}</span>`
        + (series ? `<span class="eps-count" data-eps="${it.id}"></span>` : '')
        + `<span class="rt">${rtLabel}</span>`
        + (it.approx ? '<span class="approx" title="placement / count is approximate">±</span>' : '')
        + `</span>`
        + (it.note ? `<span class="subnote">${it.note}</span>` : '')
        + `</span>`
        + `<span class="date">${esc(it.date || '')}</span>`
        + `<button class="skipbtn" type="button" title="Not going to watch" aria-label="Mark ${esc(it.name)} as not watching">${XICON}</button>`
        + (series ? `<button class="chevron" type="button" aria-expanded="false" aria-label="Show episodes">${CHEV}</button>` : '');
      li.appendChild(row);

      row.querySelector('.box').addEventListener('click', (e) => { e.stopPropagation(); toggleMaster(it); });
      row.querySelector('.box').addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleMaster(it); } });
      row.querySelector('.skipbtn').addEventListener('click', (e) => { e.stopPropagation(); toggleSkip(it); });

      if (series) {
        const panel = document.createElement('div'); panel.className = 'eppanel';
        it.seasons.forEach((n, si) => {
          const s = document.createElement('div'); s.className = 'season';
          const lab = it.seasons.length > 1 ? `Season ${si + 1}` : 'Episodes';
          s.innerHTML = `<div class="season-label">${lab} <span class="season-n">${n} ep${n > 1 ? 's' : ''}</span></div>`;
          const grid = document.createElement('div'); grid.className = 'epgrid';
          for (let e = 1; e <= n; e++) {
            const id = `${it.id}-s${si + 1}e${e}`;
            const chip = document.createElement('button');
            chip.type = 'button'; chip.className = 'ep'; chip.dataset.id = id; chip.textContent = e;
            chip.setAttribute('aria-label', `${it.name} ${lab} episode ${e}`);
            chip.addEventListener('click', () => toggleEp(id));
            grid.appendChild(chip);
          }
          s.appendChild(grid); panel.appendChild(s);
        });
        li.appendChild(panel);
        const chev = row.querySelector('.chevron');
        const expand = () => { li.classList.toggle('open'); chev.setAttribute('aria-expanded', li.classList.contains('open')); };
        chev.addEventListener('click', (e) => { e.stopPropagation(); expand(); });
        row.addEventListener('click', expand);
      }
      return li;
    }

    function toggleMaster(it) {
      skip.delete(it.id);
      if (MT.isSeries(it)) {
        const ids = MT.epIds(it);
        if (MT.itemDone(it, done)) ids.forEach((id) => done.delete(id));
        else ids.forEach((id) => done.add(id));
      } else {
        if (done.has(it.id)) done.delete(it.id); else done.add(it.id);
      }
      persist(); render();
    }
    function toggleEp(id) { if (done.has(id)) done.delete(id); else done.add(id); persist(); render(); }
    function toggleSkip(it) {
      if (skip.has(it.id)) { skip.delete(it.id); }
      else {
        skip.add(it.id);
        if (MT.isSeries(it)) MT.epIds(it).forEach((id) => done.delete(id)); else done.delete(it.id);
      }
      persist(); render();
    }
    function pushSync() { if (window.MTSyncPush) window.MTSyncPush(fid); }
    function persist() { MT.saveSet(K.done, done); MT.saveSet(K.skip, skip); pushSync(); }
    // let the sync layer refresh the view after adopting cloud data
    window.MTSyncReload = function () {
      done = MT.loadSet(K.done); skip = MT.loadSet(K.skip);
      filters = MT.loadObj(K.filters, MT.defaultFilters(data));
      render();
    };

    document.getElementById('reset').addEventListener('click', () => {
      if (!confirm('Reset watched + skipped for ' + data.title + '? (Filters are kept.)')) return;
      done = new Set(); skip = new Set(); persist(); render();
    });

    const el = (id) => document.getElementById(id);
    function render() {
      const st = MT.stats(data, done, skip, filters);
      el('ntotal').textContent = st.totItems;
      el('ndone').textContent = st.doneItems;
      el('pct').textContent = st.pct + '%';
      el('fill').style.width = st.pct + '%';
      el('twat').textContent = MT.fmtH(st.watMin);
      el('tleft').textContent = MT.fmtH(st.leftMin);
      el('ttot').textContent = MT.fmtH(st.totMin);

      document.querySelectorAll('.item').forEach((li) => {
        const it = BY_ID[li.dataset.id];
        li.hidden = !MT.visible(it, filters);
        const row = li.querySelector('.row');
        const skipped = skip.has(it.id);
        const full = !skipped && MT.itemDone(it, done);
        const partial = !skipped && MT.isSeries(it) && !full && MT.epDone(it, done) > 0;
        row.classList.toggle('skip', skipped);
        row.classList.toggle('done', full);
        row.classList.toggle('partial', !!partial);
        li.querySelector('.box').setAttribute('aria-checked', partial ? 'mixed' : full);
      });
      document.querySelectorAll('.ep').forEach((c) => c.classList.toggle('done', done.has(c.dataset.id)));
      document.querySelectorAll('[data-eps]').forEach((eLbl) => {
        const it = BY_ID[eLbl.dataset.eps];
        eLbl.textContent = `${MT.epDone(it, done)} / ${MT.epTotal(it)} eps`;
      });
      document.querySelectorAll('[data-tally]').forEach((t) => {
        const its = t.dataset.tally.split(',').map((id) => BY_ID[id]).filter((it) => MT.visible(it, filters));
        const d = its.filter((it) => !skip.has(it.id) && MT.itemDone(it, done)).length;
        t.textContent = d + '/' + its.length;
        const sec = t.closest('section.era'); if (sec) sec.hidden = its.length === 0;
      });
      document.querySelectorAll('.fchip').forEach((ch) => {
        const on = !!filters[ch.dataset.tier];
        ch.classList.toggle('on', on); ch.setAttribute('aria-pressed', on);
      });
    }
    render();
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
})();
