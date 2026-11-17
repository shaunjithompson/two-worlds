/* Two Worlds — photo essay behaviour (armenia-2015, georgia-2015, …).
   The stops are already in the HTML (written by tools/build.py from content/journeys/<slug>.json),
   so the page reads fine without this file. This only adds: reveal on scroll, carousels,
   the floating stop guide, map ↔ stop linking, the feedback form and the reading bar.
   Carousel keys: ←/→ turn the carousel you've clicked into, otherwise the one most on screen
   (at least 40% visible); with none in view the keys scroll the page as usual. Every essay
   gets this, because every essay loads this file (tools/check.py makes sure).
   Page settings come from <body data-native-lang="ka" data-mini="x y w h" data-feedback-subject="…">. */
(function () {
  const cfg = document.body.dataset;
  const lang = cfg.nativeLang || '';
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---- reveal on scroll ----
  document.documentElement.classList.add('js');
  const reveals = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || reduce()) reveals.forEach(el => el.classList.add('in'));
  else {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => io.observe(el));
  }

  // ---- carousels ----
  const carousels = [];
  document.querySelectorAll('.carousel').forEach(c => {
    const t = c.querySelector('.track'), figs = [...t.children], cnt = c.querySelector('.count');
    const prev = c.querySelector('.prev'), next = c.querySelector('.next');
    const idx = () => { let best = 0, d = 1e9; figs.forEach((f, i) => { const v = Math.abs(f.offsetLeft - t.offsetLeft - t.scrollLeft); if (v < d) { d = v; best = i; } }); return best; };
    const upd = () => { const i = idx(); cnt.textContent = (i + 1) + ' / ' + figs.length; prev.disabled = t.scrollLeft < 4; next.disabled = t.scrollLeft + t.clientWidth >= t.scrollWidth - 4; };
    const go = d => { const i = Math.max(0, Math.min(figs.length - 1, idx() + d)); t.scrollTo({ left: figs[i].offsetLeft - t.offsetLeft, behavior: reduce() ? 'auto' : 'smooth' }); };
    c.querySelector('.c-ctrl').hidden = false;
    prev.addEventListener('click', () => go(-1)); next.addEventListener('click', () => go(1));
    t.addEventListener('scroll', upd, { passive: true });
    carousels.push({ t, go });
    upd();
  });
  // ←/→ anywhere on the page: the focused carousel, else the one with most of itself on screen
  const onScreen = () => {
    const f = carousels.find(k => k.t.contains(document.activeElement));
    if (f) return f;
    let best = null, most = 0.4;
    carousels.forEach(k => { const r = k.t.getBoundingClientRect(), v = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      if (r.height && v / r.height > most) { most = v / r.height; best = k; } });
    return best;
  };
  addEventListener('keydown', e => {
    if ((e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const el = document.activeElement;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    const k = onScreen();
    if (k) { e.preventDefault(); k.go(e.key === 'ArrowRight' ? 1 : -1); }
  });

  // ---- stop guide: previous / mini map / place (English, then local name) / next / top ----
  const plates = [...document.querySelectorAll('#diary .plate')];
  if (plates.length) {
    const mapDots = [...document.querySelectorAll('.stopdot')];
    const box = (cfg.mini || '0 0 100 100').split(/\s+/).map(Number);
    const at = el => { const x = parseFloat(el.style.left), y = parseFloat(el.style.top);
      return 'left:' + ((x - box[0]) / box[2] * 100).toFixed(2) + '%;top:' + ((y - box[1]) / box[3] * 100).toFixed(2) + '%'; };
    // The mini map redraws the route and borders in its own 0–100 box (no zoomed viewBox, no
    // non-scaling strokes), which Safari renders reliably.
    const fit = d => (d || '').replace(/(-?[\d.]+)[ ,](-?[\d.]+)/g, (m, x, y) =>
      ((x - box[0]) / box[2] * 100).toFixed(2) + ' ' + ((y - box[1]) / box[3] * 100).toFixed(2));
    const routeEl = document.getElementById('route-line'), bordersEl = document.getElementById('borders');
    const routeD = fit(routeEl && routeEl.getAttribute('d')), bordersD = fit(bordersEl && bordersEl.getAttribute('d'));
    const rail = document.createElement('nav');
    rail.className = 'rail'; rail.setAttribute('aria-label', 'Stops on this journey');
    rail.innerHTML = '<button type="button" class="nb prev" aria-label="Previous stop">↑</button>' +
      '<span class="mini">' +
      '<svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none"><g fill="none" stroke-linejoin="round" stroke-linecap="round">' +
      '<path d="' + bordersD + '" stroke="rgba(241,238,231,.18)" stroke-width="1.6"/>' +
      '<path d="' + routeD + '" stroke="#E8674A" stroke-opacity=".85" stroke-width="3.2"/></g></svg>' +
      plates.map(p => { const d = mapDots.find(m => m.dataset.stop === p.dataset.stop); return d ? '<a href="#' + p.id + '" data-stop="' + p.dataset.stop + '"' + (d.classList.contains('capital') ? ' class="cap"' : '') + ' aria-label="' + esc(p.dataset.name) + '" style="' + at(d) + '"><i></i></a>' : ''; }).join('') +
      '</span><span class="now" aria-live="polite"><b></b><small' + (lang ? ' lang="' + lang + '"' : '') + '></small></span>' +
      '<button type="button" class="nb next" aria-label="Next stop">↓</button>' +
      '<button type="button" class="top-btn" aria-label="Back to the top of the page">Top <span aria-hidden="true">↑</span></button>';
    document.body.appendChild(rail);
    const nowEn = rail.querySelector('.now b'), nowLocal = rail.querySelector('.now small'), steps = [...rail.querySelectorAll('.mini a')];
    const prevB = rail.querySelector('.prev'), nextB = rail.querySelector('.next');
    let current = '';
    const setActive = id => {
      if (id === current) return; current = id;
      mapDots.forEach(d => d.classList.toggle('on', d.dataset.stop === id));
      steps.forEach(a => { const on = a.dataset.stop === id; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current'); });
      const p = plates.find(x => x.dataset.stop === id), i = plates.indexOf(p);
      nowEn.textContent = p ? p.dataset.name : ''; nowLocal.textContent = p ? p.dataset.native : '';
      prevB.disabled = i <= 0; nextB.disabled = i < 0 || i >= plates.length - 1;
    };
    // While a ↑/↓ press is scrolling, keep the guide on the stop being travelled to (the observer would
    // otherwise flick through every stop passed on the way), and show that stop's photos straight away.
    let lock = false, lockT = 0;
    const unlock = () => { lock = false; clearTimeout(lockT); };
    addEventListener('scrollend', unlock);
    const idxOf = () => Math.max(0, plates.findIndex(x => x.dataset.stop === current));
    const goTo = i => {
      const p = plates[Math.max(0, Math.min(plates.length - 1, i))]; if (!p) return;
      setActive(p.dataset.stop);
      p.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
      lock = true; clearTimeout(lockT); lockT = setTimeout(unlock, 1200);
      p.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth' });
    };
    prevB.addEventListener('click', () => goTo(idxOf() - 1));
    nextB.addEventListener('click', () => goTo(idxOf() + 1));
    rail.querySelector('.top-btn').addEventListener('click', () => scrollTo({ top: 0, behavior: reduce() ? 'auto' : 'smooth' }));
    // which stop is in the middle of the screen
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !lock) setActive(e.target.dataset.stop); }), { rootMargin: '-45% 0px -50% 0px' });
    plates.forEach(p => io.observe(p));
    // show the guide only while reading the stops
    const first = plates[0], last = plates[plates.length - 1];
    const vis = () => rail.classList.toggle('show', first.getBoundingClientRect().top < innerHeight * 0.6 && last.getBoundingClientRect().bottom > innerHeight * 0.3);
    addEventListener('scroll', vis, { passive: true }); vis();
    // from a stop back to the map: light that stop's dot
    document.querySelectorAll('.to-map').forEach(a => a.addEventListener('click', () => setActive(a.dataset.stop)));
  }

  // ---- feedback form: posts to data-endpoint (e.g. Formspree) when set; otherwise opens an email draft ----
  const fb = document.getElementById('fb-form');
  if (fb) fb.addEventListener('submit', e => {
    e.preventDefault();
    const st = document.getElementById('fb-status'), data = new FormData(fb);
    const endpoint = fb.dataset.endpoint, email = fb.dataset.email;
    if (!data.get('message') && !data.get('rating')) { st.textContent = 'Pick a reaction or write a line first.'; return; }
    if (endpoint) {
      st.textContent = 'Sending…';
      fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then(r => { if (!r.ok) throw 0; fb.reset(); st.textContent = 'Thank you, it reached me.'; })
        .catch(() => { st.textContent = 'That did not send. Please try again in a moment.'; });
    } else if (email) {
      const body = 'Reaction: ' + (data.get('rating') || '-') + '\n\n' + (data.get('message') || '') + '\n\nReply to: ' + (data.get('email') || '-');
      location.href = 'mailto:' + email + '?subject=' + encodeURIComponent('Feedback: ' + (cfg.feedbackSubject || document.title)) + '&body=' + encodeURIComponent(body);
      st.textContent = 'Your email app should open with the message ready to send.';
    } else {
      st.textContent = 'Thank you. Feedback isn’t switched on yet, so this hasn’t been sent.';
    }
  });

  // ---- always open the essay at the top ----
  // In-page links scroll without writing a #hash, so a stale #stop-… can't send the next visit to the bottom.
  try { history.scrollRestoration = 'manual'; } catch (e) {}
  if (location.hash && location.hash !== '#route' && location.hash !== '#content') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
  // The site viewer can carry the previous page's scroll position over, and photos loading can shift it.
  // Until the reader scrolls or taps themselves, hold the page at the top.
  let held = true;
  const release = () => { held = false; };
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(t => addEventListener(t, release, { once: true, passive: true }));
  const pin = () => { if (held && scrollY !== 0) scrollTo(0, 0); };
  addEventListener('scroll', pin, { passive: true });
  addEventListener('load', pin); addEventListener('pageshow', pin);
  setTimeout(() => { pin(); held = false; removeEventListener('scroll', pin); }, 3000);
  pin();
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1), t = document.getElementById(id);
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth' });
    if (id === 'content') { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  });

  // ---- reading progress ----
  const bar = document.getElementById('progress');
  if (bar) {
    const onScroll = () => { const h = document.documentElement.scrollHeight - innerHeight; bar.style.transform = 'scaleX(' + (h > 0 ? scrollY / h : 0) + ')'; };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }
})();
