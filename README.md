# Two Worlds

Personal site for Shaun Ji-Thompson: music for wind orchestra, journeys made overland, and writing.

Plain HTML, CSS and JavaScript. No build step and no dependencies.

## Pages

| File | Page |
|---|---|
| `index.html` | Home, with the Music / Travel switch and the interactive dot map |
| `beyond-the-darial-pass.html` | Work page |
| `morocco-to-the-gambia.html` | Journey page |

`css/home.css` and `js/home.js` belong to the home page. The other two pages carry their styles inline, as exported from the design.

## Preview locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Publish with GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repository, open Settings, then Pages.
3. Under "Build and deployment", choose "Deploy from a branch", pick `main` and `/ (root)`, and save.

## Still to fill in

- Everything in `[BRACKETS]`: dates, years, durations, venue, contact details, essay titles.
- Images in `assets/` are generated placeholders. Replace them with real photographs, keeping the file names or updating the paths.
- The email forms do not send anywhere yet.
- Places on the map live in the `PLACES` list at the top of `js/home.js`. The comment there shows how to work out a new pin's position.
- The routes drawn on the map are sketches, not exact routes.
