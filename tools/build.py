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
"""
import html, json, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://shaunjithompson.github.io/two-worlds/'
WIDTHS = (800, 1400)
PAGES = ['index.html', 'atlas.html', 'portugal-2015.html', 'georgia-2015.html', 'armenia-2015.html',
         'a-la-cote-de-la-mer-de-gegham.html', 'beyond-the-darial-pass.html', 'morocco-to-the-gambia.html']
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
          'September', 'October', 'November', 'December']

p = lambda *a: os.path.join(ROOT, *a)
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
    data = json.load(open(p('content', 'journeys', f'{slug}.json'), encoding='utf-8'))
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
        s = set_text(s, 'id="music-link"', m.get('title'))
        s = set_attr(s, 'music-link', 'href', m.get('url'))
        s = set_attr(s, 'music-btn', 'href', m.get('url'))
        s = set_text(s, 'id="music-blurb"', m.get('blurb'))
        s = set_text(s, 'id="music-year"', m.get('year'))
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


if __name__ == '__main__':
    print('photo sizes made:', make_sizes())
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
    print('done')
