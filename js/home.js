/* Two Worlds — the dot map on the home Travel side and the atlas. No dependencies.
   The world's coastlines live in js/land.js, which must load first.
   The Music / Travel switch and the home page's deep links are handled by the inline script in index.html. */
(function () {
  'use strict';

  // One dot per country, by longitude and latitude in decimal degrees (west and south are negative).
  // kinds: 'music' = a piece is about this country · 'been' = a photo essay · 'next' = an upcoming journey.
  // essay = the photo essay; score = the score page (or the works row on the home page when there's no page yet).
  var PLACES = [
    { id: 'armenia', name: 'Armenia', label: 'Travelled August 2015 · Photo essay',
      imgs: ['assets/sevan-sunset.jpg', 'assets/kapan-01.jpg', 'assets/goris-02.jpg', 'assets/sevanavank.jpg', 'assets/yer-07.jpg'], lon: 45.0, lat: 40.2, kinds: ['been', 'music'],
      essay: 'armenia-2015.html', music: 'À la côte de la mer de Gegham', score: 'a-la-cote-de-la-mer-de-gegham.html' },
    { id: 'georgia', name: 'Georgia', label: 'Travelled August 2015 · Photo essay',
      imgs: ['assets/tbilisi-cover.jpg', 'assets/tbilisi-06.jpg', 'assets/gori-02.jpg', 'assets/batumi-02.jpg', 'assets/gorge.jpg'], lon: 43.6, lat: 42.1, kinds: ['been', 'music'],
      essay: 'georgia-2015.html', music: 'Overture “Beyond the Darial Pass”', score: 'beyond-the-darial-pass.html' },
    { id: 'journey', name: 'Morocco to The Gambia', label: 'Next journey · Departs 2026',
      imgs: ['assets/dunes.jpg'], lon: -7.59, lat: 33.57, kinds: ['next'], essay: 'morocco-to-the-gambia.html', essayText: 'About the journey' },
    { id: 'portugal', name: 'Portugal', label: 'Travelled December 2015 · Photo essay',
      imgs: ['assets/portugal-cover.jpg', 'assets/porto-03.jpg', 'assets/aveiro-04.jpg', 'assets/lisbon-03.jpg', 'assets/roca-02.jpg'], lon: -8.2, lat: 39.6, kinds: ['been', 'music'],
      essay: 'portugal-2015.html', music: 'O Mar Novo: «As Vagas de Nazaré»', score: 'index.html#row-marNovo' },
    { id: 'poland', name: 'Poland', label: 'Music · Flute and wind band · 2025',
      imgs: ['assets/plain.jpg'], lon: 19.4, lat: 52.0, kinds: ['music'], music: 'Koncert „Elegia Kościuszki”', score: 'index.html#row-kosciuszko' },
    { id: 'norway', name: 'Norway', label: 'Music · Wind band · 2025',
      imgs: ['assets/coast.jpg'], lon: 8.5, lat: 61.0, kinds: ['music'], music: 'Forløp (Forløb)', score: 'index.html#row-forlop' }
  ];
  // Older links named a place inside a country: send them to the country.
  var ALIAS = { sevan: 'armenia', darial: 'georgia', nazare: 'portugal', lisbon: 'portugal', krakow: 'poland', hardanger: 'norway' };
  // The upcoming journey as lon, lat pairs: Casablanca down the coast to The Gambia. Drawn faintly so the essays lead.
  var ROUTE_NEXT = [-7.59, 33.57, -9.6, 30.4, -14.5, 26.13, -16, 18.1, -17.4, 14.7, -16.6, 13.45];

  // The whole world, 180°W–180°E and 84°N–58°S, in map units (U per degree).
  var U = 26 / 3, LON0 = -180, LAT0 = 84, LAT1 = -58;
  var MAP_W = 360 * U, MAP_H = (LAT0 - LAT1) * U;
  function project(lon, lat) { return { x: (lon - LON0) * U, y: (LAT0 - lat) * U }; }
  // Colours on the dark stage: resting dots, pointer glow (oxide) and the one-off ring (pale indigo).
  var DOT = [62, 66, 71], GLOW = [232, 103, 74], RING = [143, 166, 194];
  var PULSE_MS = 2200, PULSE_R = 300;
  var ICON_EXPAND = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  var ICON_COLLAPSE = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

  var map = document.getElementById('map');
  if (!map) return;
  var canvas = map.querySelector('canvas');
  var layer = document.getElementById('map-layer');
  var wholeBtn = document.getElementById('zoom-whole');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var place = 'portugal';                 // the selected place: the latest photo essay
  var view = { s: 1, tx: 0, ty: 0 }, anim = null;
  var mouse = null, pulseT = -1e9, hot = null;
  var pts = {}, drag = null, pinch = null;
  var beforeWhole = null, wholeShown = null;
  var focusId = null;                     // a place to open the map on (from a #place- link), else the home view
  var sized = false, onScreen = true, frame = 0;

  function byId(id) { id = ALIAS[id] || id; for (var i = 0; i < PLACES.length; i++) if (PLACES[i].id === id) return PLACES[i]; return null; }
  function mapPoint(p) { return project(p.lon, p.lat); }
  // Previews are 240 px wide: use the 800 px WebP the build makes, not the 2000 px JPG.
  function small(src) { return src.replace(/^assets\/([^/]+)\.jpg$/, 'assets/sized/$1-800.webp'); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---- pins ----
  PLACES.forEach(function (p) {
    var pin = document.createElement('button');
    pin.type = 'button'; pin.className = 'pin' + p.kinds.map(function (k) { return ' k-' + k; }).join(''); pin.dataset.place = p.id;
    pin.setAttribute('aria-label', p.name + ' (' + p.kinds.map(function (k) { return { music: 'music', been: 'travel', next: 'upcoming' }[k]; }).join(', ') + ')');
    pin.setAttribute('aria-pressed', 'false');
    var pt = mapPoint(p); pin.dataset.x = pt.x; pin.dataset.y = pt.y;
    pin.appendChild(document.createElement('i'));
    var label = document.createElement('span');
    label.className = 'pin-label'; label.setAttribute('aria-hidden', 'true');
    label.textContent = p.kinds.indexOf('next') >= 0 ? 'Up next: ' + p.name : p.name;
    label.dataset.x = pin.dataset.x; label.dataset.y = pin.dataset.y;
    layer.appendChild(pin); layer.appendChild(label);
  });

  function selectPlace(id, fly) {
    var p = byId(id); if (!p) return;
    place = p.id;
    layer.querySelectorAll('.pin').forEach(function (el) { el.setAttribute('aria-pressed', el.dataset.place === p.id ? 'true' : 'false'); });
    pulseT = performance.now(); // one soft ring from the chosen place, then it stops
    if (fly) { var o = mapPoint(p); flyTo(viewAround(o.x, o.y, Math.max(view.s, coverS() * 2.5))); }
    invalidate();
  }
  function openPlace(p) { location.href = p.essay || p.score; }

  // ---- buttons ----
  document.addEventListener('click', function (e) {
    var z = e.target.closest('[data-zoom]');
    if (z) {
      var n = +z.dataset.zoom;
      if (n) { flyTo(zoomTarget(map.clientWidth / 2, map.clientHeight / 2, view.s * (n > 0 ? 1.8 : 1 / 1.8))); return; }
      // Whole-map button is a toggle: out to the whole world, then back to where you were.
      if (isWhole()) { flyTo(beforeWhole ? clampView({ s: clampS(beforeWhole.s), tx: beforeWhole.tx, ty: beforeWhole.ty }) : homeView()); beforeWhole = null; }
      else { beforeWhole = { s: view.s, tx: view.tx, ty: view.ty }; flyTo(clampView({ s: minS(), tx: 0, ty: 0 })); }
      return;
    }
    var pin = e.target.closest('.pin');
    if (pin) openPlace(byId(pin.dataset.place)); // keyboard Enter / Space on a pin
  });
  // Double-clicking any zoom button returns the map to the zoom it opened at.
  document.addEventListener('dblclick', function (e) {
    if (!e.target.closest('[data-zoom]')) return;
    e.preventDefault(); beforeWhole = null; flyTo(homeView());
  });

  // ---- pan and zoom. view: screen = translate + map units * scale ----
  function minS() { return Math.min(map.clientWidth / MAP_W, map.clientHeight / MAP_H); }
  function coverS() { return Math.max(map.clientWidth / MAP_W, map.clientHeight / MAP_H); }
  function maxS() { return coverS() * 10; }
  function clampS(s) { return Math.max(minS(), Math.min(maxS(), s)); }
  function clampView(t) {
    var w = map.clientWidth, h = map.clientHeight, ww = MAP_W * t.s, wh = MAP_H * t.s;
    t.tx = ww <= w ? (w - ww) / 2 : Math.min(0, Math.max(w - ww, t.tx));
    t.ty = wh <= h ? (h - wh) / 2 : Math.min(0, Math.max(h - wh, t.ty));
    return t;
  }
  function viewAround(X, Y, s) { s = clampS(s); return clampView({ s: s, tx: map.clientWidth / 2 - X * s, ty: map.clientHeight / 2 - Y * s }); }
  function zoomTarget(px, py, s) { s = clampS(s); var X = (px - view.tx) / view.s, Y = (py - view.ty) / view.s; return clampView({ s: s, tx: px - X * s, ty: py - Y * s }); }
  function sx(X) { return view.tx + X * view.s; }
  function sy(Y) { return view.ty + Y * view.s; }
  function isWhole() { return view.s <= minS() * 1.02; }
  function homeView() { var c = project(25, 28); return viewAround(c.x, c.y, coverS() * 1.7); }
  function layout() {
    var whole = isWhole();
    if (whole !== wholeShown && wholeBtn) {
      wholeShown = whole;
      wholeBtn.innerHTML = whole ? ICON_COLLAPSE : ICON_EXPAND;
      wholeBtn.setAttribute('aria-label', whole ? 'Zoom back in' : 'Show the whole map');
      wholeBtn.setAttribute('aria-pressed', whole ? 'true' : 'false');
    }
    layer.querySelectorAll('[data-x]').forEach(function (el) { el.style.left = sx(+el.dataset.x) + 'px'; el.style.top = sy(+el.dataset.y) + 'px'; });
  }
  function setView(t) { view = t; layout(); invalidate(); }
  function flyTo(t) { if (reduce) { anim = null; setView(t); } else { anim = { a: view, b: t, t0: performance.now(), dur: 650 }; invalidate(); } }

  // Only the place dots are clickable: the nearest one within a generous radius wins.
  function pinNear(px, py, radius) {
    var best = null, bd = radius;
    PLACES.forEach(function (p) { var o = mapPoint(p), d = Math.hypot(sx(o.x) - px, sy(o.y) - py); if (d < bd) { bd = d; best = p; } });
    return best;
  }

  // ---- preview: a small rolling photo carousel beside the dot, with links to the essay and the score ----
  var peek = document.createElement('div'), peekTimer = null, peekI = 0;
  peek.className = 'peek';
  layer.appendChild(peek);
  function links(p) {
    var a = [];
    if (p.essay) a.push('<a href="' + esc(p.essay) + '">' + esc(p.essayText || 'Photo essay') + ' →</a>');
    if (p.score) a.push('<a href="' + esc(p.score) + '">Score: <i>' + esc(p.music) + '</i> →</a>');
    return a.join('');
  }
  function showPeek(p) {
    clearInterval(peekTimer); peekTimer = null;
    if (!p) { peek.classList.remove('show'); return; }
    var list = p.imgs, o = mapPoint(p);
    peek.dataset.x = o.x; peek.dataset.y = o.y;
    peek.style.left = sx(o.x) + 'px'; peek.style.top = sy(o.y) + 'px';
    peek.classList.toggle('left', sx(o.x) > map.clientWidth - 280);
    peek.classList.toggle('below', sy(o.y) < 200);
    // Only the first photo loads now; each next one loads just before it is shown.
    peek.innerHTML = '<div class="peek-imgs" aria-hidden="true">' + list.map(function (src, i) { return '<img ' + (i ? 'data-src' : 'src') + '="' + small(src) + '" alt=""' + (i ? '' : ' class="on"') + '>'; }).join('') + '</div>' +
      (list.length > 1 ? '<div class="peek-dots" aria-hidden="true">' + list.map(function (_, i) { return '<i' + (i ? '' : ' class="on"') + '></i>'; }).join('') + '</div>' : '') +
      '<div class="peek-txt"><b>' + esc(p.name) + '</b><span>' + esc(p.label) + '</span><em>' + links(p) + '</em></div>';
    peek.classList.add('show'); peekI = 0;
    var ims = peek.querySelectorAll('.peek-imgs img'), ds = peek.querySelectorAll('.peek-dots i');
    function load(i) { var im = ims[i]; if (im && im.dataset.src) { im.src = im.dataset.src; im.removeAttribute('data-src'); } }
    if (list.length > 1 && !reduce) {
      load(1);
      peekTimer = setInterval(function () {
        ims[peekI].classList.remove('on'); ds[peekI].classList.remove('on');
        peekI = (peekI + 1) % ims.length; load(peekI); load((peekI + 1) % ims.length);
        ims[peekI].classList.add('on'); ds[peekI].classList.add('on');
      }, 1300);
    }
  }
  function setHot(p) {
    if (hot === p) return; hot = p; showPeek(p);
    layer.querySelectorAll('.pin').forEach(function (el) { el.classList.toggle('hot', !!p && el.dataset.place === p.id); });
    map.classList.toggle('over-pin', !!p);
  }
  // Moving from one dot's preview towards its links can pass near another dot: wait a moment before switching,
  // and stay put once the pointer reaches the preview.
  var hoverTimer = null;
  function hover(p) {
    clearTimeout(hoverTimer); hoverTimer = null;
    if (p === hot) return;
    if (!hot) setHot(p); else hoverTimer = setTimeout(function () { setHot(p); }, 250);
  }
  function local(e) { var r = map.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function inPeek(e) { return e.target.closest && e.target.closest('.peek'); }

  map.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.zoom') || inPeek(e) || e.button > 0) return;
    var q = local(e); pts[e.pointerId] = q; anim = null;
    try { map.setPointerCapture(e.pointerId); } catch (err) {}
    var ids = Object.keys(pts);
    if (ids.length === 1) drag = { x: q.x, y: q.y, tx: view.tx, ty: view.ty, moved: false, touch: e.pointerType !== 'mouse' };
    else if (ids.length === 2) {
      var a = pts[ids[0]], b = pts[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: view.s, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, tx: view.tx, ty: view.ty };
      if (drag) drag.moved = true;
    }
  });
  map.addEventListener('pointermove', function (e) {
    var q = local(e);
    if (e.pointerType === 'mouse') { mouse = q; invalidate(); }
    if (pts[e.pointerId]) pts[e.pointerId] = q;
    var ids = Object.keys(pts);
    if (pinch && ids.length >= 2) {
      // Zoom around the starting midpoint, then follow the midpoint as it moves: pinch and pan together.
      var a = pts[ids[0]], b = pts[ids[1]], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var s = clampS(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d);
      var X = (pinch.mx - pinch.tx) / pinch.s, Y = (pinch.my - pinch.ty) / pinch.s;
      setView(clampView({ s: s, tx: mx - X * s, ty: my - Y * s }));
      return;
    }
    if (drag) {
      var dx = q.x - drag.x, dy = q.y - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 6) { drag.moved = true; map.classList.add('dragging'); setHot(null); }
      if (drag.moved) setView(clampView({ s: view.s, tx: drag.tx + dx, ty: drag.ty + dy }));
      return;
    }
    if (e.pointerType === 'mouse') hover(inPeek(e) ? hot : pinNear(q.x, q.y, 40));
  });
  function endPointer(e) {
    if (drag && !drag.moved && e.type === 'pointerup') {
      var q = local(e), p = pinNear(q.x, q.y, drag.touch ? 56 : 40);
      if (p) openPlace(p);
    }
    delete pts[e.pointerId];
    var left = Object.keys(pts);
    if (left.length < 2) pinch = null;
    // Two fingers down to one: carry on panning from where the pinch left the map, not from where it started.
    if (left.length === 1) { var r = pts[left[0]]; drag = { x: r.x, y: r.y, tx: view.tx, ty: view.ty, moved: true, touch: true }; }
    if (!left.length) { drag = null; map.classList.remove('dragging'); }
  }
  map.addEventListener('pointerup', endPointer);
  map.addEventListener('pointercancel', endPointer);
  map.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !drag) { clearTimeout(hoverTimer); mouse = null; setHot(null); invalidate(); } });
  // Trackpad pinch (and ctrl/cmd + scroll) zooms; plain scrolling still scrolls the page.
  map.addEventListener('wheel', function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault(); anim = null;
    var q = local(e), dy = Math.max(-60, Math.min(60, e.deltaY));
    setView(zoomTarget(q.x, q.y, view.s * Math.exp(-dy * 0.01)));
  }, { passive: false });

  // ---- the dot field: one dot every 1.25 degrees wherever js/land.js says there is land ----
  function buildDots() {
    var LAND = window.TW_LAND || {}, WATER = window.TW_WATER || {};
    function shapes(set) {
      return Object.keys(set).map(function (k) {
        var p = set[k], b = [180, 90, -180, -90];
        for (var i = 0; i < p.length; i += 2) { b[0] = Math.min(b[0], p[i]); b[1] = Math.min(b[1], p[i + 1]); b[2] = Math.max(b[2], p[i]); b[3] = Math.max(b[3], p[i + 1]); }
        return { p: p, b: b };
      });
    }
    function inside(x, y, p) {
      var c = false, n = p.length / 2;
      for (var i = 0; i < n; i++) {
        var j = (i + 1) % n, x1 = p[2 * i], y1 = p[2 * i + 1], x2 = p[2 * j], y2 = p[2 * j + 1];
        if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) c = !c;
      }
      return c;
    }
    function hit(list, x, y) {
      for (var q = 0; q < list.length; q++) { var s = list[q]; if (x >= s.b[0] && x <= s.b[2] && y >= s.b[1] && y <= s.b[3] && inside(x, y, s.p)) return true; }
      return false;
    }
    var land = shapes(LAND), water = shapes(WATER);
    var out = [], step = 1.25, row = 0;
    for (var lat = LAT0 - step / 2; lat > LAT1; lat -= step, row++) {
      for (var lon = LON0 + step / 2 + (row % 2 ? step / 2 : 0); lon < 180; lon += step) {
        if (hit(land, lon, lat) && !hit(water, lon, lat)) { var pt = project(lon, lat); out.push(pt.x, pt.y); }
      }
    }
    return out;
  }
  var dots = buildDots();

  // ---- drawing: only when something changed (a pan, a zoom, the pointer glow, the one-off ring) ----
  function invalidate() { if (!frame && onScreen) frame = requestAnimationFrame(draw); }
  function rx(lon) { return sx((lon - LON0) * U); }
  function ry(lat) { return sy((LAT0 - lat) * U); }
  function draw(now) {
    frame = 0;
    var w = map.clientWidth, h = map.clientHeight;
    if (!w || !h) { sized = false; return; } // hidden (the Music side); the ResizeObserver wakes us when it shows
    if (!sized) {
      sized = true;
      if (focusId) { var fo = mapPoint(byId(focusId)); view = viewAround(fo.x, fo.y, coverS() * 2.5); } else view = homeView();
      anim = null; layout(); pulseT = now;
    }
    var more = false;
    if (anim) {
      var t = Math.min(1, (now - anim.t0) / anim.dur), e = 1 - Math.pow(1 - t, 3);
      view = { s: anim.a.s + (anim.b.s - anim.a.s) * e, tx: anim.a.tx + (anim.b.tx - anim.a.tx) * e, ty: anim.a.ty + (anim.b.ty - anim.a.ty) * e };
      if (t >= 1) anim = null; else more = true;
      layout();
    }
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    var g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cw, ch);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var r = 2.7 * Math.pow(view.s, 0.6), sel = place && byId(place), o = sel ? mapPoint(sel) : { x: -1e9, y: -1e9 }, ox = sx(o.x), oy = sy(o.y);
    var pAge = (now - pulseT) / PULSE_MS;
    var R = (reduce || !sel || pAge < 0 || pAge >= 1) ? -1 : pAge * PULSE_R;
    if (R >= 0) more = true;
    var lit = [];
    g.fillStyle = 'rgb(' + DOT.join(',') + ')'; g.beginPath();
    for (var i = 0; i < dots.length; i += 2) {
      var x = sx(dots[i]), y = sy(dots[i + 1]), a = 0, b = 0, d, v;
      if (x < -r || y < -r || x > w + r || y > h + r) continue;
      if (mouse && !drag) { d = Math.hypot(x - mouse.x, y - mouse.y); if (d < 90) { v = 1 - d / 90; a = 0.55 * v * v; } }
      if (R >= 0) { d = Math.hypot(x - ox, y - oy); v = 1 - Math.abs(d - R) / 18; if (v > 0) b = 0.4 * v * (1 - pAge) * (1 - pAge); }
      var f = Math.max(a, b);
      if (f < 0.03) { g.moveTo(x + r, y); g.arc(x, y, r, 0, 6.2832); } else lit.push(x, y, f, a >= b ? 1 : 0);
    }
    g.fill();
    for (var k = 0; k < lit.length; k += 4) {
      var f2 = lit[k + 2], T = lit[k + 3] ? GLOW : RING;
      g.fillStyle = 'rgb(' + Math.round(DOT[0] + (T[0] - DOT[0]) * f2) + ',' + Math.round(DOT[1] + (T[1] - DOT[1]) * f2) + ',' + Math.round(DOT[2] + (T[2] - DOT[2]) * f2) + ')';
      g.beginPath(); g.arc(lit[k], lit[k + 1], r * (1 + 0.8 * f2), 0, 6.2832); g.fill();
    }
    var N = ROUTE_NEXT;
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.strokeStyle = 'rgba(232,103,74,0.45)'; g.lineWidth = 1.25; g.setLineDash([2, 5]); g.lineDashOffset = 0;
    g.beginPath(); g.moveTo(rx(N[0]), ry(N[1]));
    for (var m = 2; m < N.length; m += 2) g.lineTo(rx(N[m]), ry(N[m + 1]));
    g.stroke(); g.setLineDash([]);
    if (more) invalidate();
  }

  // Redraw when the map changes size (window resize, or the Travel side being shown) and only while it's on screen.
  if (window.ResizeObserver) new ResizeObserver(function () { if (sized) view = clampView({ s: clampS(view.s), tx: view.tx, ty: view.ty }); layout(); invalidate(); }).observe(map);
  else window.addEventListener('resize', function () { invalidate(); });
  if (window.IntersectionObserver) new IntersectionObserver(function (es) { onScreen = es[es.length - 1].isIntersecting; invalidate(); }).observe(map);

  // Used by index.html (#place-<id> links) and below for the atlas.
  window.twMap = { select: function (id) { var p = byId(id); if (!p) return; focusId = p.id; selectPlace(p.id, sized); } };
  // The atlas: #place-<id> opens the map on that country.
  function fromHash() { var h = (location.hash || '').slice(1); if (h.indexOf('place-') === 0) window.twMap.select(h.slice(6)); }
  selectPlace(place, false);
  if (document.body.classList.contains('atlas-page')) { fromHash(); window.addEventListener('hashchange', fromHash); }
  invalidate();
})();
