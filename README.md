# 🎬 MovieTimelines

Track your way through film & TV franchises in **in-universe timeline order** — every film and series, episode by episode, with watch-time tallies and progress saved right in your browser. No account, no server.

**Live:** https://timelines.hackatoa.com

## Features

- **Multiple franchises**, each on its own page — pick one from the home grid
- **Search** across franchises *and* their titles (e.g. typing “Mandalorian” surfaces Star Wars)
- **Episode dropdowns** for every series, with a master + per-episode + partial state
- **Watch-time tracking** — hours watched / left / total, per franchise (approximate)
- **“Not going to watch”** — drop an entry from your count and time-left with the ⊘ button
- **Filters** for optional tiers (e.g. *Legends*, *Marvel TV*, *Animated*) — hidden from list *and* count when off
- **Per-franchise theming** — accent colour + an animated background effect (starfield, rain, embers, drift)
- Progress + filters saved per-visitor via `localStorage`

## Included franchises

Star Wars · Marvel (MCU) · Jurassic Park · Pirates of the Caribbean · John Wick — plus a **Demo Saga** showing the data format.

## Add your own

Every franchise is a single JSON file in [`data/`](data/). See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full schema and a step-by-step guide, and open [`data/_demo.json`](data/_demo.json) as a worked example. Community submissions welcome via pull request — they’re shown under a **Community** heading and tagged accordingly.

Request a franchise you’d like added: [open an issue](https://github.com/Hackatoan/movietimelines/issues/new?labels=franchise-request&title=Franchise%20request%3A%20).

## How it’s built

Plain static HTML/CSS/JS — no build step, no framework.

```
index.html          # home hub (search + franchise grid)
franchise.html      # tracker engine (?f=<id>)
assets/
  core.js           # shared pure logic (stats, storage) — no DOM
  engine.js         # tracker UI
  hub.js            # home UI
  backgrounds.js    # named background effects
  styles.css        # design system (cinematic dark theme)
data/
  franchises.json   # ordered registry of franchise ids
  <id>.json         # one file per franchise
```

Runs anywhere that serves static files (it needs `fetch` for the JSON, so open it via a web server, not `file://`).

## Support

If this saved you a rewatch-planning headache: [☕ Buy me a coffee](https://buymeacoffee.com/hackatoa).

## License

MIT
