/* MovieTimelines — shared pure logic (no DOM). Used by engine.js and hub.js. */
(function (global) {
  const MT = {};

  MT.keys = (id) => ({
    done: `mt:${id}:done`,
    skip: `mt:${id}:skip`,
    filters: `mt:${id}:filters`,
  });

  MT.loadSet = (key) => {
    try { const r = localStorage.getItem(key); if (r) return new Set(JSON.parse(r)); } catch (e) {}
    return new Set();
  };
  MT.saveSet = (key, set) => { try { localStorage.setItem(key, JSON.stringify([...set])); } catch (e) {} };
  MT.loadObj = (key, def) => {
    try { const r = localStorage.getItem(key); if (r) return Object.assign({}, def, JSON.parse(r)); } catch (e) {}
    return Object.assign({}, def);
  };
  MT.saveObj = (key, o) => { try { localStorage.setItem(key, JSON.stringify(o)); } catch (e) {} };

  // Flatten eras -> items, resolving tier (item.tier > era.tier > 'core') and attaching era ref.
  MT.flatten = (data) => {
    const items = [];
    (data.eras || []).forEach((era) => {
      (era.items || []).forEach((it) => {
        it._tier = it.tier || era.tier || 'core';
        it._era = era;
        items.push(it);
      });
    });
    return items;
  };

  MT.isSeries = (it) => Array.isArray(it.seasons);
  MT.epIds = (it) => {
    const out = [];
    if (MT.isSeries(it)) it.seasons.forEach((n, si) => { for (let e = 1; e <= n; e++) out.push(`${it.id}-s${si + 1}e${e}`); });
    return out;
  };
  MT.epTotal = (it) => (MT.isSeries(it) ? it.seasons.reduce((a, b) => a + b, 0) : 0);
  MT.epDone = (it, done) => MT.epIds(it).filter((id) => done.has(id)).length;
  MT.itemDone = (it, done) => (MT.isSeries(it) ? (MT.epTotal(it) > 0 && MT.epDone(it, done) === MT.epTotal(it)) : done.has(it.id));

  // Runtime (minutes)
  MT.itemTotalMin = (it) => (MT.isSeries(it) ? MT.epTotal(it) * (it.epAvg || 0) : (it.runtime || 0));
  MT.itemWatchedMin = (it, done) => (MT.isSeries(it) ? MT.epDone(it, done) * (it.epAvg || 0) : (done.has(it.id) ? (it.runtime || 0) : 0));

  // Default tier filter state from data.tiers ([{id,label,default}])
  MT.defaultFilters = (data) => {
    const f = {};
    (data.tiers || []).forEach((t) => { f[t.id] = !!t.default; });
    return f;
  };
  MT.tierOn = (tier, filters) => (tier === 'core' ? true : !!filters[tier]);
  MT.visible = (it, filters) => MT.tierOn(it._tier, filters);

  // Aggregate stats over VISIBLE items; skipped items excluded from counts + "left".
  MT.stats = (data, done, skip, filters) => {
    const items = MT.flatten(data).filter((it) => MT.visible(it, filters));
    let totItems = 0, doneItems = 0, totMin = 0, watMin = 0, leftMin = 0;
    items.forEach((it) => {
      const skipped = skip.has(it.id);
      const tmin = MT.itemTotalMin(it);
      const wmin = MT.itemWatchedMin(it, done);
      watMin += wmin;                       // already-watched time always counts
      if (skipped) return;
      totItems++;
      totMin += tmin;
      if (MT.itemDone(it, done)) doneItems++;
      leftMin += Math.max(0, tmin - wmin);
    });
    return {
      totItems, doneItems,
      pct: totItems ? Math.round((doneItems / totItems) * 100) : 0,
      totMin, watMin, leftMin,
    };
  };

  // "≈12h 40m" / "3h" / "45m"
  MT.fmtH = (min) => {
    min = Math.round(min || 0);
    const h = Math.floor(min / 60), m = min % 60;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    return `${m}m`;
  };

  global.MT = MT;
})(window);
