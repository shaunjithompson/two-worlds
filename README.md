# Two Worlds

Personal site for Shaun Ji-Thompson: music for wind band, and journeys made overland.

Plain HTML, CSS and JavaScript on GitHub Pages. One small Python build script (`tools/build.py`) writes content into the pages; GitHub runs it for you.

## Pages

| File | Page |
|---|---|
| `index.html` | Home: Music / Travel switch, works list, interactive dot map, essays |
| `atlas.html` | Full-screen map |
| `georgia-2015.html`, `armenia-2015.html` | Photo essays |
| `a-la-cote-de-la-mer-de-gegham.html` | Score page |
| `beyond-the-darial-pass.html` | Work page (older layout, to simplify) |
| `morocco-to-the-gambia.html` | Upcoming journey (older layout, to simplify) |
| `404.html` | Not-found page |

## Styles and scripts

| File | Used by |
|---|---|
| `css/base.css` | Every page, loaded first. Colours, type scale, fonts, focus ring, skip link. **Change colours here only.** |
| `css/map.css` | The dot map, shared by the home Travel side and `atlas.html` |
| `css/home.css` | `index.html` |
| `css/atlas.css` | `atlas.html` page layout |
| `css/essay.css` | Every photo essay |
| `js/home.js`, `js/dots.js` | The dot map on home and atlas. One dot per country: the `PLACES` list at the top of `js/home.js`. `js/dots.js` is made by the build from the coastlines in `tools/land.json` |
| `js/essay.js` | Every photo essay: carousels, stop guide, map links, feedback form |

Design rules: black ground, paper `#F1EEE7`, Japanese indigo `#21364F`, oxide red. Newsreader for display, Inter Tight for everything else, IBM Plex Mono once per page (class `mono-keep`). The class `mono` is a small Inter Tight label, despite its name.

## Content

- **Journeys:** `content/journeys/<slug>.json`, edited in Pages CMS (pagescms.org, sign in with GitHub). Each stop and photo carries an ISO date; stops are sorted by date.
- **Photos:** `assets/*.jpg` at 2000 px, made with `tools/photo.py`. The build adds 800 and 1400 px WebP copies in `assets/sized/`.

## Build

```
python3 tools/build.py
```

It writes each essay's stops from its JSON into the HTML (so the essays work without JavaScript and search engines can read them), makes the smaller photo sizes, adds width/height/srcset to every image, and writes `sitemap.xml`. It is safe to run any number of times.

`.github/workflows/build.yml` runs it on every push to `main` that touches content, photos or pages, and commits the result. So an edit in Pages CMS reaches the page by itself a minute or so later.

**A new essay:** copy `georgia-2015.html` to `<slug>.html`, set the title, map and `data-native-lang` / `data-mini` on `<body>`, add `content/journeys/<slug>.json` and a matching block in `.pages.yml`, add the page to `PAGES` in `tools/build.py`, then build.

## Preview locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000.
