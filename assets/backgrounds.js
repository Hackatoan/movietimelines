/* MovieTimelines — named background effects. Franchises opt in via data.background.
   Safe by design: only effects in this registry run; JSON picks one by name (no arbitrary code).
   Usage: MTBackgrounds.apply(spec, accent)  where spec is "starfield" or {type, color, density}. */
(function (global) {
  const REG = {};
  let raf = null, canvas = null, ctx = null, drawFn = null, W = 0, H = 0, DPR = 1;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'bgfx';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'fixed', inset: '0', zIndex: '0', pointerEvents: 'none' });
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext('2d');
  }
  function resize(build) {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.width = innerWidth * DPR;
    H = canvas.height = innerHeight * DPR;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    build();
  }

  // ---------- STARFIELD ----------
  REG.starfield = (opts, accent) => {
    let stars = [];
    const density = opts.density || 1;
    const build = () => {
      const n = Math.min(260, Math.floor((innerWidth * innerHeight / 7000) * density));
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.3 * DPR + 0.2,
        a: Math.random() * 0.6 + 0.15,
        tw: Math.random() * 0.02 + 0.004,
        p: Math.random() * Math.PI * 2,
        hot: Math.random() < 0.12,
      }));
    };
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        if (!reduce) s.p += s.tw;
        const a = reduce ? s.a : s.a + Math.sin(s.p) * 0.22;
        ctx.globalAlpha = Math.max(0, a);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.hot ? (accent || '#fff8d8') : (s.r > 1.05 * DPR ? '#eef1ff' : '#cfd6ff');
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    return { build, frame };
  };

  // ---------- RAIN (noir / neon) ----------
  REG.rain = (opts, accent) => {
    let drops = [];
    const col = opts.color || accent || '#7fa8d8';
    const build = () => {
      const n = Math.min(220, Math.floor((innerWidth / 6)));
      drops = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        len: (Math.random() * 14 + 8) * DPR,
        sp: (Math.random() * 6 + 5) * DPR,
        a: Math.random() * 0.25 + 0.06,
      }));
    };
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1 * DPR; ctx.strokeStyle = col;
      for (const d of drops) {
        ctx.globalAlpha = d.a;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x, d.y + d.len); ctx.stroke();
        if (!reduce) { d.y += d.sp; if (d.y > H) { d.y = -d.len; d.x = Math.random() * W; } }
      }
      ctx.globalAlpha = 1;
    };
    return { build, frame };
  };

  // ---------- EMBERS (rising particles) ----------
  REG.embers = (opts, accent) => {
    let parts = [];
    const col = opts.color || accent || '#f5b942';
    const build = () => {
      const n = Math.min(120, Math.floor(innerWidth * innerHeight / 16000));
      parts = Array.from({ length: n }, () => spawn());
    };
    const spawn = () => ({
      x: Math.random() * W, y: H + Math.random() * H,
      r: Math.random() * 1.6 * DPR + 0.4,
      sp: (Math.random() * 0.6 + 0.2) * DPR,
      dx: (Math.random() - 0.5) * 0.3 * DPR,
      a: Math.random() * 0.4 + 0.1,
    });
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        ctx.globalAlpha = p.a; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        if (!reduce) { p.y -= p.sp; p.x += p.dx; if (p.y < -10) Object.assign(p, spawn(), { y: H + 10 }); }
      }
      ctx.globalAlpha = 1;
    };
    return { build, frame };
  };

  // ---------- DRIFT (slow diagonal motes) ----------
  REG.drift = (opts, accent) => {
    let m = [];
    const col = opts.color || accent || '#8fa1c8';
    const build = () => {
      const n = Math.min(90, Math.floor(innerWidth * innerHeight / 20000));
      m = Array.from({ length: n }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 2 * DPR + 0.5,
        vx: (Math.random() - 0.5) * 0.25 * DPR, vy: (Math.random() - 0.5) * 0.25 * DPR,
        a: Math.random() * 0.18 + 0.04,
      }));
    };
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of m) {
        ctx.globalAlpha = p.a; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        if (!reduce) { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0; }
      }
      ctx.globalAlpha = 1;
    };
    return { build, frame };
  };

  const MTBackgrounds = {
    apply(spec, accent) {
      if (!spec) return;
      const s = typeof spec === 'string' ? { type: spec } : spec;
      const make = REG[s.type];
      if (!make) return;                 // unknown effect: no-op (safe)
      ensureCanvas();
      const eff = make(s, accent);
      const build = () => eff.build();
      resize(build);
      drawFn = eff.frame;
      window.addEventListener('resize', () => resize(build), { passive: true });
      if (raf) cancelAnimationFrame(raf);
      if (reduce) { drawFn(); }           // one static frame
      else { const loop = () => { drawFn(); raf = requestAnimationFrame(loop); }; loop(); }
    },
    available: () => Object.keys(REG),
  };
  global.MTBackgrounds = MTBackgrounds;
})(window);
