"""Two Worlds checks — run after tools/build.py. GitHub runs both on every pull request.

    python3 tools/check.py

Errors (the check fails):
  - content: a journey, work or place is missing a field, has a malformed date, or names an id that doesn't exist
  - photos and pages named in content that don't exist
  - every link and image on every page: the file exists, and #anchors exist on the page they point to
Warnings (printed, the check still passes):
  - photos, and stops, with no date (the chronological rule: flag anything that can't be dated)
"""
import json, os, re, sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
p = lambda *a: os.path.join(ROOT, *a)
errors, warnings = [], []
err = errors.append
warn = warnings.append
DATE = re.compile(r'^\d{4}(-\d{2}(-\d{2})?)?$')
# Anchors made by the home page's script rather than written in the HTML.
SCRIPTED = {'index.html': {'music', 'travel', 'back', 'top'}}


def need(obj, where, *keys):
    for k in keys:
        if not obj.get(k):
            err(f'{where}: missing "{k}"')

def exists(path, where):
    if path and not os.path.exists(p(path.lstrip('/'))):
        err(f'{where}: {path} does not exist')


# ---------- content ----------
def check_content():
    places = {pl['id']: pl for pl in json.load(open(p('content', 'places.json'), encoding='utf-8'))['places']}
    for pid, pl in places.items():
        need(pl, f'places/{pid}', 'name', 'lon', 'lat')
        for ph in pl.get('photos', []):
            exists(ph, f'places/{pid} photo')
        if pl.get('next'):
            exists(pl['next'].get('url'), f'places/{pid} next.url')
    works = {}
    for f in sorted(os.listdir(p('content', 'works'))):
        if not f.endswith('.json'):
            continue
        w = json.load(open(p('content', 'works', f), encoding='utf-8')); where = f'works/{f}'
        need(w, where, 'id', 'title', 'year', 'forces', 'about', 'row', 'places')
        if w.get('id') != f[:-5]:
            err(f'{where}: id "{w.get("id")}" should match the file name')
        if not re.fullmatch(r'\d{4}', str(w.get('year', ''))):
            err(f'{where}: year should be YYYY')
        for pid in w.get('places', []):
            if pid not in places:
                err(f'{where}: place "{pid}" is not in content/places.json')
        if w.get('image'):
            exists(w['image'], where)
        works[w['id']] = w
    for f in sorted(os.listdir(p('content', 'journeys'))):
        if not f.endswith('.json'):
            continue
        j = json.load(open(p('content', 'journeys', f), encoding='utf-8')); where = f'journeys/{f}'
        need(j, where, 'title', 'date', 'place', 'stops')
        for k in ('date', 'published'):
            if j.get(k) and not DATE.match(j[k]):
                err(f'{where}: {k} "{j[k]}" is not YYYY-MM or YYYY-MM-DD')
        if j.get('place') and j['place'] not in places:
            err(f'{where}: place "{j["place"]}" is not in content/places.json')
        m = j.get('music')
        if m and m.get('work') not in works:
            err(f'{where}: music.work "{m.get("work")}" is not in content/works/')
        exists((j.get('cover') or {}).get('src'), f'{where} cover')
        for i, st in enumerate(j.get('stops') or [], 1):
            sw = f'{where} stop {i} ({st.get("place", "?")})'
            dated = [ph for ph in st.get('photos') or [] if ph.get('date')]
            if not st.get('date') and not dated:
                warn(f'{sw}: no date on the stop or its photos, so it can\'t be placed in order')
            elif st.get('date') and not DATE.match(st['date']):
                err(f'{sw}: date "{st["date"]}" is not YYYY-MM or YYYY-MM-DD')
            for ph in st.get('photos') or []:
                exists(ph.get('src'), sw)
                if not ph.get('date'):
                    warn(f'{sw}: photo {ph.get("src")} has no date')
                elif not DATE.match(ph['date']):
                    err(f'{sw}: photo date "{ph["date"]}" is not YYYY-MM-DD')
    return places


# ---------- links ----------
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids, self.refs = set(), []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'):
            self.ids.add(a['id'])
        if tag == 'a' and a.get('name'):
            self.ids.add(a['name'])
        for k in ('href', 'src', 'poster'):
            if a.get(k):
                self.refs.append((tag, a[k]))
        if a.get('srcset'):
            self.refs += [(tag, part.strip().split()[0]) for part in a['srcset'].split(',') if part.strip()]

def check_links(places):
    pages = {}
    for f in sorted(os.listdir(ROOT)):
        if f.endswith('.html'):
            pg = Page(); pg.feed(open(p(f), encoding='utf-8').read()); pages[f] = pg
    for f, pg in pages.items():
        for tag, ref in pg.refs:
            if re.match(r'^(https?:|mailto:|tel:|data:|//)', ref):
                continue
            path, _, anchor = ref.partition('#')
            if path.startswith('/two-worlds/'):  # absolute links (404.html) on GitHub Pages
                path = path[len('/two-worlds/'):] or 'index.html'
            target = path or f
            if path and not os.path.exists(p(path)):
                err(f'{f}: <{tag}> {ref} — {path} does not exist'); continue
            if not anchor or not target.endswith('.html'):
                continue
            if anchor.startswith('place-'):
                if anchor[6:] not in places and anchor[6:] not in ('sevan', 'darial', 'nazare', 'lisbon', 'krakow', 'hardanger'):
                    err(f'{f}: {ref} — no place "{anchor[6:]}"')
            elif anchor not in pages.get(target, Page()).ids and anchor not in SCRIPTED.get(target, set()):
                err(f'{f}: {ref} — no id="{anchor}" on {target}')


if __name__ == '__main__':
    places = check_content()
    check_links(places)
    for w in warnings:
        print('warning:', w)
    for e in errors:
        print('ERROR:', e)
    print(f'{len(errors)} errors, {len(warnings)} warnings')
    sys.exit(1 if errors else 0)
