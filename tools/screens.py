"""Two Worlds screenshots — every page at phone and desktop width, for comparing a pull request with main.

    python3 tools/screens.py <site folder> <output folder>

Needs Playwright (pip install playwright; playwright install chromium). Set CHROME=/path/to/chrome to use an
installed Chrome instead. Motion is turned off (prefers-reduced-motion) so the map ring and photo carousels
don't make two runs differ. GitHub runs this on every pull request: .github/workflows/checks.yml.
"""
import functools, http.server, os, sys, threading
from playwright.sync_api import sync_playwright

SIZES = {'phone': (390, 844), 'desktop': (1280, 900)}
PAGES = [('home-music', 'index.html#music'), ('home-travel', 'index.html#travel'), ('atlas', 'atlas.html')]


def pages(site):
    extra = sorted(f for f in os.listdir(site) if f.endswith('.html') and f not in ('index.html', 'atlas.html'))
    return PAGES + [(f[:-5], f) for f in extra]

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

def serve(site):
    handler = functools.partial(Quiet, directory=site)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

def main(site, out):
    os.makedirs(out, exist_ok=True)
    srv = serve(site); base = f'http://127.0.0.1:{srv.server_address[1]}/'
    with sync_playwright() as pw:
        kw = {'executable_path': os.environ['CHROME'], 'args': ['--no-sandbox']} if os.environ.get('CHROME') else {}
        browser = pw.chromium.launch(**kw)
        for size, (w, h) in SIZES.items():
            ctx = browser.new_context(viewport={'width': w, 'height': h}, reduced_motion='reduce',
                                      is_mobile=size == 'phone', has_touch=size == 'phone')
            page = ctx.new_page()
            for name, path in pages(site):
                page.goto(base + path, wait_until='networkidle')
                # Load every photo now (not lazily) and wait for all of them before the shot.
                page.evaluate('''async () => {
                  document.querySelectorAll('img[loading="lazy"]').forEach(i => { i.loading = 'eager'; });
                  await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 8000); })));
                }''')
                page.wait_for_load_state('networkidle')
                # Freeze anything still moving (slow photo zooms, fades) so two runs of the same page match.
                page.add_style_tag(content='*, *::before, *::after { animation: none !important; transition: none !important; }')
                page.wait_for_timeout(600)
                if path.endswith('#travel'):
                    page.locator('#map').scroll_into_view_if_needed(); page.wait_for_timeout(400)
                page.screenshot(path=os.path.join(out, f'{name}--{size}.png'), full_page=not path.endswith('#travel'))
                print('shot', name, size)
            ctx.close()
        browser.close()
    srv.shutdown()

if __name__ == '__main__':
    main(*sys.argv[1:3])
