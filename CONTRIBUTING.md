# Adding a franchise

A franchise is **one JSON file** in [`data/`](data/) plus **one line** in [`data/franchises.json`](data/franchises.json). No code changes needed.

The quickest start: copy [`data/_demo.json`](data/_demo.json) (rendered live at [`/franchise.html?f=_demo`](https://timelines.hackatoa.com/franchise.html?f=_demo)) and edit it.

## 1. Create `data/<your-id>.json`

Use a lowercase, hyphenated `id` that matches the filename (e.g. `back-to-the-future.json` → `"id": "back-to-the-future"`).

```jsonc
{
  "id": "back-to-the-future",
  "title": "Back to the Future",
  "tagline": "One short line shown on the card",
  "author": "your-name",          // shown on the card
  "community": true,              // ALWAYS true for submissions that aren't the site owner's
  "accent": "#f5b942",            // theme colour (hex)
  "accentInk": "#161200",         // text colour on top of the accent (optional)
  "emoji": "🚗",                  // shown as the poster + tab icon
  "background": "drift",          // optional: starfield | rain | embers | drift  (omit for none)
  "datesLabel": "Optional note about the dates you use",

  "tiers": [                      // optional — for filterable groups (extras, non-canon, spin-offs)
    { "id": "extras", "label": "Extras", "default": false, "note": "hover tooltip" }
  ],

  "eras": [
    {
      "title": "Era name",
      "span": "1985 – 1990",      // optional
      "note": "Optional HTML note under the era heading",
      "tier": "extras",           // optional — puts the WHOLE era on a tier
      "items": [
        { "id": "bttf1", "name": "Back to the Future", "date": "1985", "kind": "Film", "film": true, "runtime": 116 },
        { "id": "series1", "name": "The Animated Series", "date": "1991", "kind": "Series", "seasons": [13, 13], "epAvg": 22, "tier": "extras" },
        { "id": "spec1", "name": "A Special", "date": "1990", "kind": "Special", "special": true, "runtime": 48 }
      ]
    }
  ]
}
```

### Item fields

| Field | Applies to | Meaning |
|-------|-----------|---------|
| `id` | all | **unique within this file**, lowercase/hyphen/digits |
| `name` | all | display title |
| `date` | all | short in-universe date/label (free text) |
| `kind` | all | small tag, e.g. `Film`, `Series`, `Special`, `TV Movie` |
| `film` | films | `true` → bold styling |
| `special` | specials | `true` → accent-tinted tag |
| `runtime` | films/specials | minutes (integer) — powers watch-time |
| `seasons` | series | array of episode counts per season, e.g. `[8, 10]` |
| `epAvg` | series | average minutes per episode — powers watch-time |
| `tier` | any | put this one entry on a tier id (else it's core/always-shown) |
| `note` | any | small HTML callout under the row |
| `approx` | any | `true` → shows a `±` badge for uncertain placement/counts |

**Order matters:** list eras and items in the order you want them watched (in-universe timeline order).

## 2. Register it

Add your `id` to the `order` array in [`data/franchises.json`](data/franchises.json):

```json
{ "order": ["star-wars", "mcu", "…", "back-to-the-future"] }
```

Then regenerate the sitemap so search engines pick it up:

```bash
node scripts/gen-sitemap.mjs
```

## 3. Test locally

`fetch` needs a real web server (not `file://`):

```bash
cd movietimelines
python3 -m http.server 8080
# open http://localhost:8080  and  http://localhost:8080/franchise.html?f=back-to-the-future
```

## 4. Open a pull request

- Keep `"community": true` unless you're the repo owner.
- Please cite sources for episode counts/runtimes in the PR description.
- Backgrounds are limited to the named effects above (`starfield`, `rain`, `embers`, `drift`) — this keeps community submissions safe (no arbitrary code). Want a new effect? Open an issue.

## Accuracy notes

- **Times are approximate** by design — series time = `Σ seasons × epAvg`.
- Mark genuinely uncertain placements/counts with `"approx": true`.
- Use a `tier` for anything non-canon or optional so people can filter it out.

Thanks for contributing! ☕ https://buymeacoffee.com/hackatoa
