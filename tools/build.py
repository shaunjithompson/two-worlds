"""Two Worlds build — run after changing photos or content/journeys/*.json.

    python3 tools/build.py

GitHub runs this automatically on every push to main (.github/workflows/build.yml),
so edits made in Pages CMS end up in the pages without anyone running it by hand.

What it does (all steps are safe to repeat):
  1. Photo sizes: for every assets/*.jpg, writes assets/sized/<name>-800.webp and -1400.webp.
  2. Essays: writes each journey's stops, dates, music card and before/after links from
     content/journeys/<slug>.json into <slug>.html, between <!-- diary:start --> and <!-- diary:end -->.
     The page is complete without JavaScript, and search engines can read it.
  3. Images on every page: adds width/height (no layout jump), srcset/sizes (phones get the
     small file), fetchpriority="high" on the first image, loading="lazy" after the third.
     Add data-keep to an <img> to leave it alone; data-sizes="…" to set its sizes.
  4. sitemap.xml, from the pages listed in PAGES.
  5. Map dots: js/dots.js, the land dots for the home and atlas map, from tools/land.json
     (so phones don't have to work them out on every visit).
  6. Score pages: one page per work with a "page" in content/works/<id>.json, from templates/work.html.
  7. Map places: js/places.js (the dots, previews and links) and a plain list of the same links inside
     the map on index.html and atlas.html (between <!-- places:start --> and <!-- places:end -->),
     all worked out from content/places.json, content/works/*.json and content/journeys/*.json.

Content is linked by id: a journey names its "place" and its "music": {"work": <id>}; a work lists its
"places". tools/check.py checks those links, dates and every link on the site.
"""
import html, json, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://shaunjithompson.github.io/two-worlds/'
WIDTHS = (800, 1400)
PAGES = ['index.html', 'atlas.html', 'portugal-2015.html', 'georgia-2015.html', 'armenia-2015.html',
         'iran-2015.html', 'turkmenistan-2015.html',
         'a-la-cote-de-la-mer-de-gegham.html', 'beyond-the-darial-pass.html', 'morocco-to-the-gambia.html']
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
          'September', 'October', 'November', 'December']

p = lambda *a: os.path.join(ROOT, *a)


# ---------- content ----------
def load(*a):
    with open(p(*a), encoding='utf-8') as f:
        return json.load(f)

def content():
    """Everything in content/, linked: places by id, works by id, journeys by slug."""
    places = {pl['id']: pl for pl in load('content', 'places.json')['places']}
    works = {}
    for f in sorted(os.listdir(p('content', 'works'))):
        if f.endswith('.json'):
            w = load('content', 'works', f); works[w['id']] = w
    journeys = {}
    for f in sorted(os.listdir(p('content', 'journeys'))):
        if f.endswith('.json'):
            j = load('content', 'journeys', f); j['slug'] = f[:-5]; journeys[j['slug']] = j
    return places, works, journeys

def work_url(w):
    """A work's own page, or its row in the works list on the home page until it has one."""
    return w['page'] if w.get('page') else f'index.html#{w["row"]}'
esc = lambda t: html.escape(str(t if t is not None else ''), quote=True)


# ---------- 1. photo sizes ----------
_dims = {}
def dims(src):
    if src not in _dims:
        with Image.open(p(src)) as im:
            _dims[src] = im.size
    return _dims[src]

def sized(src, w):
    stem = os.path.splitext(os.path.basename(src))[0]
    return f'assets/sized/{stem}-{w}.webp'

def make_sizes():
    os.makedirs(p('assets', 'sized'), exist_ok=True)
    made = 0
    for f in sorted(os.listdir(p('assets'))):
        if not f.lower().endswith('.jpg'):
            continue
        src = f'assets/{f}'
        with Image.open(p(src)) as im:
            im = im.convert('RGB')
            for w in WIDTHS:
                out = p(sized(src, w))
                if w >= im.width or (os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(p(src))):
                    continue
                im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(out, 'WEBP', quality=80, method=6)
                made += 1
    return made


# ---------- 2. essays ----------
def fmt(d):
    parts = str(d or '').split('-')
    y = parts[0] if parts else ''
    m = MONTHS[int(parts[1]) - 1] if len(parts) > 1 and parts[1] else ''
    day = str(int(parts[2])) + ' ' if len(parts) > 2 and parts[2] else ''
    return (day + m + ' ' + y).strip()

def span(a, b):
    y1, m1, d1 = a.split('-'); y2, m2, d2 = b.split('-')
    if y1 == y2 and m1 == m2:
        return f'{int(d1)}–{int(d2)} {MONTHS[int(m1) - 1]} {y1}'
    return f'{fmt(a)} – {fmt(b)}'

slugify = lambda t: re.sub(r'^-|-$', '', re.sub(r'[^a-z]+', '-', str(t or '').lower()))

def order(stops):
    """Sort by date. A month-only date ("2015-08") is neither before nor after a full date in that month: keep written order."""
    dates = lambda st: sorted(ph['date'] for ph in st.get('photos') or [] if ph and ph.get('date'))
    key = lambda st: st['date'] if st.get('date') and len(st['date']) >= 10 else ((dates(st) or [st.get('date') or ''])[0])
    items = list(enumerate(stops))
    import functools
    def cmp(a, b):
        x, y = key(a[1]), key(b[1])
        if not x or not y or x.startswith(y) or y.startswith(x):
            return a[0] - b[0]
        return -1 if x < y else 1
    out = [s for _, s in sorted(items, key=functools.cmp_to_key(cmp))]
    for st in out:
        ds = dates(st)
        st['_when'] = span(ds[0], ds[-1]) if len(ds) > 1 and ds[0] != ds[-1] else fmt(ds[0] if ds else st.get('date'))
    return out

def img(ph, lazy):
    return f'<img src="{esc(ph["src"].lstrip("/"))}" alt="{esc(ph.get("alt"))}"' + (' loading="lazy"' if lazy else '') + '>'

def diary(data, lang):
    singles = ['feature', 'offset', 'inset', 'offset flip']
    n = k = 0; last = ''; out = []
    for st in order(data.get('stops') or []):
        ph = [x for x in st.get('photos') or [] if x and x.get('src')]
        if not ph:
            continue  # stops without photos stay hidden
        n += 1
        cap = f'<p class="line"><span>{esc(st["caption"])}</span></p>' if st.get('caption') else ''
        def carousel(lst):
            return ('<div class="carousel reveal"><div class="track" tabindex="0" role="group" aria-label="' + esc(st['place']) + ' photos, scroll sideways">' +
                    ''.join('<figure>' + img(x, True) + '</figure>' for x in lst) + '</div>' +
                    '<div class="c-ctrl" hidden><span class="mono count">1 / ' + str(len(lst)) + '</span><span class="c-btns">'
                    '<button type="button" class="prev" aria-label="Previous photo">←</button>'
                    '<button type="button" class="next" aria-label="Next photo">→</button></span></div></div>')
        if len(ph) >= 3:  # lead photo large, then the rest as a pair (2) or a carousel (3+)
            lead = next((x for x in ph if x.get('lead')), ph[0]); rest = [x for x in ph if x is not lead]
            kind = 'lead'
            body = (f'<div class="photos lead-photo reveal">{img(lead, n > 1)}</div>{cap}' +
                    (f'<div class="photos rest pair-grid reveal">{"".join(img(x, True) for x in rest)}</div>' if len(rest) == 2
                     else f'<div class="rest">{carousel(rest)}</div>'))
        elif len(ph) == 2:
            kind = 'pair'
            body = f'<div class="photos reveal">{"".join(img(x, n > 1) for x in ph)}</div>{cap}'
        else:
            kind = singles[k % 4]
            if kind == last:
                k += 1; kind = singles[k % 4]
            k += 1
            pics = f'<div class="photos reveal">{"".join(img(x, n > 1) for x in ph)}</div>'
            body = f'<div class="body">{cap}{pics}</div>' if kind.startswith('offset') else pics + cap
        last = kind
        sid = slugify(st['place'])
        note = ''
        if st.get('note') and st['note'].get('paras'):
            note = ('<aside class="context wrap reveal"><p class="mono">Context</p><h3>' + esc(st['note'].get('title', '')) + '</h3>' +
                    ''.join(f'<p>{esc(t)}</p>' for t in st['note']['paras']) + '</aside>')
        native = f'<span class="native" lang="{lang}">{esc(st["native"])}</span>' if st.get('native') else ''
        head = (f'<header class="plate-head"><span class="num">{n:02d}</span><div class="place"><h2>{esc(st["place"])}</h2>'
                f'<a class="to-map mono" href="#route" data-stop="{sid}">Map ↑</a></div>{native}'
                f'<span class="meta mono"><span>{esc(st.get("country"))}</span><span>{esc(st["_when"])}</span></span></header>')
        out.append(f'{note}<section class="plate wrap {kind}" id="stop-{sid}" data-stop="{sid}" data-name="{esc(st["place"])}" '
                   f'data-native="{esc(st.get("native", ""))}">' + head + body + '</section>')
    return '\n'.join(out), n

def set_text(s, attr, value):
    """Replace the text of every element carrying attr (e.g. data-k="title" or id="stop-count")."""
    if value in (None, ''):
        return s
    return re.sub(r'(<(\w+)\b[^>]*\b' + re.escape(attr) + r'[^>]*>)[^<]*(</\2>)', lambda m: m.group(1) + esc(value) + m.group(3), s)

def set_attr(s, ident, name, value):
    if not value:
        return s
    def fix(m):
        tag = m.group(0)
        if re.search(r'\b' + name + r'="', tag):
            return re.sub(r'\b' + name + r'="[^"]*"', f'{name}="{esc(value)}"', tag)
        return tag[:-1] + f' {name}="{esc(value)}">'
    return re.sub(r'<\w+\b[^>]*\bid="' + ident + r'"[^>]*>', fix, s)

def build_essay(slug):
    path = p(f'{slug}.html')
    if not os.path.exists(path):
        return None
    data = JOURNEYS[slug]
    s = open(path, encoding='utf-8').read()
    lang = (re.search(r'data-native-lang="([^"]*)"', s) or [None, ''])[1]
    stops = order(data.get('stops') or [])
    for k in ('title', 'titleNative', 'subtitle', 'standfirst', 'leg'):
        s = set_text(s, f'data-k="{k}"', data.get(k))
    s = set_text(s, 'data-k="date"', fmt(data.get('date')))
    if data.get('published'):
        s = set_text(s, 'data-k="published"', fmt(data['published'][:7]))
    if (data.get('cover') or {}).get('src'):
        s = set_attr(s, 'cover', 'src', data['cover']['src'].lstrip('/'))
        s = set_attr(s, 'cover', 'alt', data['cover'].get('alt', ''))
    shown = [st for st in stops if any(ph and ph.get('src') for ph in st.get('photos') or [])]
    s = set_text(s, 'id="stop-count"', str(len(shown)))
    s = set_text(s, 'id="stop-list"', ' · '.join(st['place'] for st in shown))
    m = data.get('music')
    if m:
        w = WORKS[m['work']]
        s = set_text(s, 'id="music-link"', w['title'])
        s = set_attr(s, 'music-link', 'href', work_url(w))
        s = set_attr(s, 'music-btn', 'href', work_url(w))
        s = set_text(s, 'id="music-blurb"', m.get('blurb') or w.get('about'))
        s = set_text(s, 'id="music-year"', w['year'])
        cov = w.get('cover') or {}
        inner = (f'<a class="score-cover" href="{esc(work_url(w))}" tabindex="-1" aria-hidden="true">'
                 f'<img src="{esc(cov["src"])}" alt="" data-sizes="160px"></a>') if cov.get('src') else ''
        s = re.sub(r'(<!-- score-cover:start -->).*?(<!-- score-cover:end -->)', lambda mm: mm.group(1) + inner + mm.group(2), s, flags=re.S)
    for k, pre, post, word in (('before', '← ', '', 'Before'), ('after', '', ' →', 'After')):
        v = data.get(k)
        if not v:
            continue
        inner = f'<span class="mono">{word} · {esc(v.get("country"))}</span>' + (
            f'<a class="serif" href="{esc(v["url"])}">{pre}{esc(v.get("place"))}{post}</a>' if v.get('url')
            else f'<span class="serif">{esc(v.get("place"))} <span class="soon">· coming soon</span></span>')
        s = re.sub(r'(<div id="' + k + r'">).*?(</div>)', lambda mm: mm.group(1) + inner + mm.group(2), s, flags=re.S)
    html_, n = diary(data, lang)
    s = re.sub(r'(<!-- diary:start -->).*?(<!-- diary:end -->)', lambda mm: mm.group(1) + '\n' + html_ + '\n' + mm.group(2), s, flags=re.S)
    open(path, 'w', encoding='utf-8').write(s)
    return n


# ---------- 3. image attributes ----------
GEN = ('width', 'height', 'srcset', 'sizes', 'loading', 'fetchpriority', 'decoding')

def img_attrs(s):
    count = [0]
    def fix(m):
        tag = m.group(0)
        src = re.search(r'\bsrc="([^"]+)"', tag)
        if not src or not src.group(1).startswith('assets/') or not os.path.exists(p(src.group(1))) or 'data-keep' in tag:
            return tag
        src = src.group(1)
        sizes_given = re.search(r'\bdata-sizes="([^"]*)"', tag)
        for a in GEN:
            tag = re.sub(r'\s' + a + r'="[^"]*"', '', tag)
        count[0] += 1
        w, h = dims(src)
        extra = f' width="{w}" height="{h}"'
        if src.lower().endswith('.jpg'):
            set_ = [f'{sized(src, x)} {x}w' for x in WIDTHS if x < w and os.path.exists(p(sized(src, x)))]
            if set_:
                set_.append(f'{src} {w}w')
                extra += f' srcset="{", ".join(set_)}" sizes="{sizes_given.group(1) if sizes_given else "100vw"}"'
        # the first few images are at or near the top of the page: load them straight away
        extra += ' fetchpriority="high"' if count[0] == 1 else ('' if count[0] <= 3 else ' loading="lazy" decoding="async"')
        return re.sub(r'\s*/?>$', extra + '>', tag)
    return re.sub(r'<img\b[^>]*>', fix, s)


# ---------- 4. sitemap ----------
def sitemap():
    urls = ''.join(f'  <url><loc>{SITE}{"" if f == "index.html" else f}</loc></url>\n' for f in PAGES)
    open(p('sitemap.xml'), 'w').write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n')


# ---------- 5. map dots ----------
# Same grid as the map in js/home.js: a dot every 1.25 degrees from 84°N to 58°S, odd rows shifted half a step.
STEP, LAT0, LAT1 = 1.25, 84, -58

def dots():
    data = json.load(open(p('tools', 'land.json'), encoding='utf-8'))
    def shapes(group):
        out = []
        for pts in data[group].values():
            xs, ys = pts[0::2], pts[1::2]
            out.append((pts, min(xs), min(ys), max(xs), max(ys)))
        return out
    def inside(x, y, pts):
        c, n = False, len(pts) // 2
        for i in range(n):
            j = (i + 1) % n
            x1, y1, x2, y2 = pts[2 * i], pts[2 * i + 1], pts[2 * j], pts[2 * j + 1]
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                c = not c
        return c
    def hit(lst, x, y):
        return any(x0 <= x <= x1 and y0 <= y <= y1 and inside(x, y, pts) for pts, x0, y0, x1, y1 in lst)
    land, water = shapes('land'), shapes('water')
    rows, row, lat, total = [], 0, LAT0 - STEP / 2, 0
    while lat > LAT1:
        lon, i, runs, start = -180 + STEP / 2 + (STEP / 2 if row % 2 else 0), 0, [], None
        while lon < 180:
            on = hit(land, lon, lat) and not hit(water, lon, lat)
            if on and start is None:
                start = i
            if not on and start is not None:
                runs += [start, i - start]; start = None
            lon += STEP; i += 1
        if start is not None:
            runs += [start, i - start]
        if runs:
            rows.append([row] + runs); total += sum(runs[1::2])
        lat -= STEP; row += 1
    body = ',\n'.join(json.dumps(r, separators=(',', ':')) for r in rows)
    open(p('js', 'dots.js'), 'w').write(
        '/* Two Worlds — land dots for the map. Made by tools/build.py from tools/land.json; do not edit by hand.\n'
        '   Each row: [row number, start, count, start, count, ...]; row 0 is 84°N, a dot every 1.25°, odd rows shifted half a step. */\n'
        f'window.TW_DOTS = {{ step: {STEP}, lat0: {LAT0}, rows: [\n{body}\n] }};\n')
    return total


# ---------- 6. score pages ----------
def work_pages():
    from jinja2 import Environment, FileSystemLoader, select_autoescape
    env = Environment(loader=FileSystemLoader(p('templates')), autoescape=select_autoescape(['html']), keep_trailing_newline=True)
    tpl, made = env.get_template('work.html'), []
    for w in WORKS.values():
        if not w.get('page'):
            continue
        journeys = [{'url': f'{j["slug"]}.html', 'cover': j['cover']['src'].lstrip('/'), 'country': j['title'],
                     'year': j['date'][:4], 'title': f'{j["title"]}, {j["subtitle"]}'}
                    for j in sorted(JOURNEYS.values(), key=lambda j: j['date'])
                    if (j.get('music') or {}).get('work') == w['id'] and j.get('published')]
        desc = f'{w["title"]} ({w["year"]}), for {w["forces"].lower()}, by Shaun Ji-Thompson. {w["about"]}'
        ld = {'@context': 'https://schema.org', '@type': 'MusicComposition', 'name': w['title'],
              'composer': {'@type': 'Person', 'name': 'Shaun Ji-Thompson', 'url': SITE},
              'dateCreated': w['year'], 'description': w['about'], 'url': SITE + w['page']}
        if w.get('lang'):
            ld['inLanguage'] = w['lang']
        if w.get('image'):
            ld['image'] = SITE + w['image']
        if w.get('recording'):
            ld['recordedAs'] = {'@type': 'MusicRecording', 'url': w['recording']}
        price = ((w.get('score') or {}).get('price') or '').replace('$', '').replace('A', '').strip()
        if re.fullmatch(r'\d+(\.\d\d)?', price):  # only once a real price is filled in
            ld['offers'] = {'@type': 'Offer', 'price': price, 'priceCurrency': 'AUD', 'url': SITE + w['page']}
        out = tpl.render(w=w, site=SITE, desc=desc, journeys=journeys,
                         places=[PLACES[i] for i in w.get('places', []) if i in PLACES],
                         jsonld=json.dumps(ld, ensure_ascii=False).replace('</', '<\\/'))
        open(p(w['page']), 'w', encoding='utf-8').write(out)
        made.append(w['page'])
        if w['page'] not in PAGES:
            PAGES.append(w['page'])
    return made


# ---------- 7. map places ----------
def map_places():
    """One dot per place, with what to show on the map worked out from the journeys and works that name it."""
    out = []
    for pl in PLACES.values():
        js = sorted((j for j in JOURNEYS.values() if j.get('place') == pl['id'] and j.get('published')), key=lambda j: j['date'], reverse=True)
        ws = sorted((w for w in WORKS.values() if pl['id'] in w.get('places', [])), key=lambda w: w['year'], reverse=True)
        kinds = (['been'] if js else []) + (['music'] if ws else []) + (['next'] if pl.get('next') else [])
        d = {'id': pl['id'], 'name': pl['name'], 'lon': pl['lon'], 'lat': pl['lat'], 'kinds': kinds, 'imgs': pl.get('photos') or [],
             'when': js[0]['date'] if js else (pl['next']['departs'] if pl.get('next') else ws[0]['year'] if ws else '')}
        if js:
            d['label'] = f'Travelled {fmt(js[0]["date"])} · Photo essay'
            d['essay'] = f'{js[0]["slug"]}.html'
        elif pl.get('next'):
            d['label'] = f'Next journey · Departs {pl["next"]["departs"]}'
            d['essay'], d['essayText'] = pl['next']['url'], 'About the journey'
        elif ws:
            d['label'] = f'Music · {ws[0]["forces"]} · {ws[0]["year"]}'
        if ws:
            d['music'], d['score'] = ws[0]['title'], work_url(ws[0])
            d['scoreText'] = 'Score' if ws[0].get('page') else 'The music'
        out.append(d)
    return out

def places_js(places):
    route = next((pl['next'].get('route') for pl in PLACES.values() if pl.get('next')), [])
    open(p('js', 'places.js'), 'w', encoding='utf-8').write(
        '/* Two Worlds — places on the map. Made by tools/build.py from content/; do not edit by hand. */\n'
        'window.TW_PLACES = [\n' + ',\n'.join(json.dumps(d, ensure_ascii=False) for d in places) + '\n];\n'
        f'window.TW_ROUTE_NEXT = {json.dumps(route)};\n')

def place_index(places):
    """The same links as the map, as a plain list: for keyboards, screen readers, search engines and no-JavaScript."""
    rows = []
    for d in sorted(places, key=lambda d: ('next' in d['kinds'], d['when'])):
        links = []
        if d.get('essay'):
            links.append(f'<a href="{esc(d["essay"])}">{esc(d.get("essayText", "Photo essay"))}</a>')
        if d.get('score'):
            links.append(f'<a href="{esc(d["score"])}">{d["scoreText"]}: <i>{esc(d["music"])}</i></a>')
        rows.append(f'      <li><span class="pi-name">{esc(d["name"])}</span><span class="pi-when">{esc(d["label"])}</span>{"".join(links)}</li>')
    block = '<nav class="place-index" aria-label="Places on the map">\n    <ul>\n' + '\n'.join(rows) + '\n    </ul>\n  </nav>'
    for f in ('index.html', 'atlas.html'):
        s = open(p(f), encoding='utf-8').read()
        t = re.sub(r'(<!-- places:start -->).*?(<!-- places:end -->)', lambda m: m.group(1) + '\n  ' + block + '\n  ' + m.group(2), s, flags=re.S)
        if t != s:
            open(p(f), 'w', encoding='utf-8').write(t)


def cache_bust():
    """Stamp the generated map data's script tags with a short hash of their content (js/places.js?v=…),
    so browsers fetch the new file as soon as a place is added instead of keeping a cached copy."""
    import hashlib
    for page in ('index.html', 'atlas.html'):
        s = open(p(page), encoding='utf-8').read(); t = s
        for js in ('places.js', 'dots.js'):
            h = hashlib.sha1(open(p('js', js), 'rb').read()).hexdigest()[:8]
            t = re.sub(r'<script src="js/' + re.escape(js) + r'(\?v=[0-9a-f]*)?"></script>', f'<script src="js/{js}?v={h}"></script>', t)
        if t != s:
            open(p(page), 'w', encoding='utf-8').write(t)


PLACES, WORKS, JOURNEYS = content()

if __name__ == '__main__':
    print('photo sizes made:', make_sizes())
    print('score pages:', ', '.join(work_pages()))
    places = map_places(); places_js(places); place_index(places)
    print('map places:', len(places))
    for f in sorted(os.listdir(p('content', 'journeys'))):
        if f.endswith('.json'):
            print('essay', f[:-5], 'stops:', build_essay(f[:-5]))
    for f in sorted(os.listdir(ROOT)):
        if f.endswith('.html'):
            s = open(p(f), encoding='utf-8').read()
            t = img_attrs(s)
            if t != s:
                open(p(f), 'w', encoding='utf-8').write(t)
    sitemap()
    print('map dots:', dots())
    cache_bust()
    print('done')
