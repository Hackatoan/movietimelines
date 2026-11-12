/* Old English tracker URLs (franchise.html?f=<id>) moved to pre-rendered /<id>/ pages.
   GitHub Pages can't send a 301, so redirect client-side (Google treats this as a redirect).
   Localized /<loc>/franchise.html and underscore ids (demo/template) are left alone. */
(function () {
  if (location.pathname !== '/franchise.html') return;
  const f = (new URLSearchParams(location.search).get('f') || '').replace(/[^a-z0-9_-]/gi, '');
  if (f && !f.startsWith('_')) location.replace('/' + f + '/' + location.hash);
})();
