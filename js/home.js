/* Two Worlds — home page behaviour: the Music / Travel switch and the dot map. No dependencies.
   The world's coastlines live in js/land.js, which must load first. */
(function () {
  'use strict';

  // One dot per article, by longitude and latitude in decimal degrees (west and south are negative).
  // kinds: 'music' = a piece is about this place · 'been' = a travel article · 'next' = an upcoming journey.
  var PLACES = [
    { id: 'armenia', name: 'Armenia', label: 'TRAVELLED AUGUST 2015 · PHOTO ESSAY',
      text: 'Photos from Armenia in August 2015, looked at again ten years on.',
      img: 'assets/sevan-sunset.jpg', imgs: ['assets/sevan-sunset.jpg', 'assets/kapan-01.jpg', 'assets/goris-02.jpg', 'assets/sevanavank.jpg', 'assets/yer-07.jpg'], lon: 45.0, lat: 40.2, kinds: ['been', 'music'], music: 'À la côte de la mer de Gegham', musicRow: 'row-gegham', journey: 'armenia-2015.html', journeyText: 'Read the photo essay' },
    { id: 'georgia', name: 'Georgia', label: 'TRAVELLED AUGUST 2015 · PHOTO ESSAY',
      text: 'Photos from Georgia in August 2015, from Tbilisi to the Black Sea.',
      img: 'assets/tbilisi-cover.jpg', imgs: ['assets/tbilisi-cover.jpg', 'assets/tbilisi-06.jpg', 'assets/gori-02.jpg', 'assets/batumi-02.jpg', 'assets/batumi-01.jpg'], lon: 43.4, lat: 42.0, kinds: ['been'], music: '', musicRow: '', journey: 'georgia-2015.html', journeyText: 'Read the photo essay' },
    { id: 'journey', name: 'Morocco to The Gambia', label: 'NEXT JOURNEY · DEPARTS 2026',
      text: 'Seven weeks from Casablanca down the Atlantic edge of the Sahara, written from the road.',
      img: 'assets/dunes.jpg', lon: -7.59, lat: 33.57, kinds: ['next'], music: '', musicRow: '', journey: 'morocco-to-the-gambia.html' },
    { id: 'nazare', name: 'Nazaré', label: 'PORTUGAL · 39.60° N, 9.07° W',
      text: 'The great Atlantic winter waves that break off Nazaré.',
      img: 'assets/coast.jpg', lon: -9.07, lat: 39.6, kinds: ['music'], music: 'O Mar Novo: «As Vagas de Nazaré»', musicRow: 'row-marNovo', journey: false },
    { id: 'darial', name: 'The Darial Gorge', label: 'CAUCASUS · 42.74° N, 44.62° E',
      text: 'Dar-e Alān, the old gate through the Caucasus, painted by Aivazovsky in 1868.',
      img: 'assets/gorge.jpg', lon: 44.62, lat: 42.74, kinds: ['music'], music: 'Overture: “Beyond the Darial Pass”', musicRow: 'row-darial', journey: false },
    { id: 'krakow', name: 'Kraków', label: 'POLAND · 50.06° N, 19.94° E',
      text: 'On 24 March 1794, in the Main Square, Tadeusz Kościuszko swore his oath to the nation and took up arms against the partitioning powers.',
      img: 'assets/plain.jpg', lon: 19.94, lat: 50.06, kinds: ['music'], music: 'Koncert „Elegia Kościuszki”', musicRow: 'row-kosciuszko', journey: false },
    { id: 'hardanger', name: 'Hardangerfjord', label: 'NORWAY · 60.10° N, 6.20° E',
      text: 'The fjord in Tidemand and Gude\'s painting Bridal Procession on the Hardangerfjord (1848).',
      img: 'assets/coast.jpg', lon: 6.2, lat: 60.1, kinds: ['music'], music: 'Forløp (Forløb)', musicRow: 'row-forlop', journey: false }
  ];
  // The whole world, 180°W–180°E and 84°N–58°S, in map units (U per degree).
  var U = 26 / 3, LON0 = -180, LAT0 = 84, LAT1 = -58;
  var MAP_W = 360 * U, MAP_H = (LAT0 - LAT1) * U;
  function project(lon, lat) { return { x: (lon - LON0) * U, y: (LAT0 - lat) * U }; }
  var CROSS_ICON = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4"/></svg>';

  var stage = document.getElementById('worlds') || document.body;
  // EMBED: the map sits on the home page's Travel section with no side panel; a click opens the place instead.
  var EMBED = !document.getElementById('place-name');
  var map = document.getElementById('map');
  var canvas = map.querySelector('canvas');
  var layer = document.getElementById('map-layer');
  var chips = document.getElementById('chips');
  var imgs = document.getElementById('place-imgs');
  var musicBtn = document.getElementById('place-music');
  var journeyLink = document.getElementById('place-journey');
  var state = { side: 'music', place: 'journey' };
  var mouse = null, pulseT = -1e9, view = { s: 1, tx: 0, ty: 0 }, anim = null;
  var PULSE_MS = 2200, PULSE_R = 300;
  var pts = {}, drag = null, pinch = null, hot = null, wasHidden = true;
  var wholeBtn = document.getElementById('zoom-whole'), beforeWhole = null, wholeShown = null;
  var ICON_EXPAND = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
  var ICON_COLLAPSE = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function byId(id) { for (var i = 0; i < PLACES.length; i++) if (PLACES[i].id === id) return PLACES[i]; return PLACES[0]; }
  function mapPoint(p) { return project(p.lon, p.lat); }

  // ---- build pins, chips and place images from PLACES ----
  PLACES.forEach(function (p) {
    var pin = document.createElement('button');
    pin.type = 'button'; pin.className = 'pin' + p.kinds.map(function (k) { return ' k-' + k; }).join(''); pin.dataset.place = p.id;
    pin.setAttribute('aria-label', p.name + ' (' + p.kinds.map(function (k) { return { music: 'music', been: 'travel', next: 'upcoming' }[k]; }).join(', ') + ')');
    var pt = mapPoint(p); pin.dataset.x = pt.x; pin.dataset.y = pt.y;
    pin.appendChild(document.createElement('i'));
    var label = document.createElement('span');
    label.className = 'pin-label'; label.setAttribute('aria-hidden', 'true'); label.textContent = p.name;
    label.dataset.for = p.id; label.dataset.x = pin.dataset.x; label.dataset.y = pin.dataset.y;
    layer.appendChild(pin); layer.appendChild(label);

    var chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'chip'; chip.dataset.place = p.id; chip.textContent = p.name;
    if (chips) chips.appendChild(chip);

    var im = document.createElement('img');
    im.src = p.img; im.alt = ''; im.dataset.place = p.id;
    if (imgs) imgs.appendChild(im);
  });

  function selectPlace(id, ripple) {
    state.place = id;
    var p = byId(id);
    document.querySelectorAll('[data-place]').forEach(function (el) {
      var on = el.dataset.place === id;
      if (el.matches('.pin, .chip')) el.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (el.tagName === 'IMG' && el.parentNode === imgs) el.classList.toggle('on', on);
    });
    if (EMBED) { pulseT = performance.now(); if (ripple) { var o0 = mapPoint(p); flyTo(viewAround(o0.x, o0.y, Math.max(view.s, coverS() * 2.5))); } return; }
    document.getElementById('place-label').textContent = p.label;
    document.getElementById('place-name').textContent = p.name;
    document.getElementById('place-text').textContent = p.text;
    musicBtn.hidden = !p.music;
    musicBtn.innerHTML = CROSS_ICON + 'The music: <i>' + p.music + '</i>';
    journeyLink.hidden = !p.journey;
    if (p.journey) { journeyLink.href = p.journey; journeyLink.textContent = p.journeyText || 'Follow the journey'; }
    pulseT = performance.now(); // one soft ring from the chosen place, then it stops
    if (ripple) { var o = mapPoint(p); flyTo(viewAround(o.x, o.y, Math.max(view.s, coverS() * 2.5))); }
  }

  function setSide(side, highlightRow) {
    if (side === 'travel' && state.side !== 'travel') pulseT = performance.now();
    state.side = side;
    stage.dataset.side = side;
    stage.querySelectorAll('.switch button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.go === side ? 'true' : 'false');
    });
    document.querySelectorAll('.rows li.lit').forEach(function (li) { li.classList.remove('lit'); });
    if (highlightRow) { var li = document.getElementById(highlightRow); if (li) li.classList.add('lit'); }
  }

  // ---- events ----
  document.addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]');
    if (go) {
      if (go.dataset.place) selectPlace(go.dataset.place, true);
      setSide(go.dataset.go);
      return;
    }
    var z = e.target.closest('[data-zoom]');
    if (z) {
      var n = +z.dataset.zoom;
      if (n) { flyTo(zoomTarget(map.clientWidth / 2, map.clientHeight / 2, view.s * (n > 0 ? 1.8 : 1 / 1.8))); return; }
      // Whole-map button is a toggle: out to the whole world, then back to where you were.
      if (isWhole()) { flyTo(beforeWhole ? clampView({ s: clampS(beforeWhole.s), tx: beforeWhole.tx, ty: beforeWhole.ty }) : homeView()); beforeWhole = null; }
      else { beforeWhole = { s: view.s, tx: view.tx, ty: view.ty }; flyTo(clampView({ s: minS(), tx: 0, ty: 0 })); }
      return;
    }
    var pl = e.target.closest('.pin, .chip');
    if (pl) { if (EMBED && pl.classList.contains('pin')) openPlace(byId(pl.dataset.place)); else selectPlace(pl.dataset.place, true); return; }
  });
  if (musicBtn) musicBtn.addEventListener('click', function () { location.href = 'index.html#' + (byId(state.place).musicRow || 'music'); });

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
    if (whole !== wholeShown) {
      wholeShown = whole;
      wholeBtn.innerHTML = whole ? ICON_COLLAPSE : ICON_EXPAND;
      wholeBtn.setAttribute('aria-label', whole ? 'Zoom back in' : 'Show the whole map');
      wholeBtn.setAttribute('aria-pressed', whole ? 'true' : 'false');
    }
    layer.querySelectorAll('[data-x]').forEach(function (el) { el.style.left = sx(+el.dataset.x) + 'px'; el.style.top = sy(+el.dataset.y) + 'px'; });
  }
  function setView(t) { view = t; layout(); }
  function flyTo(t) { if (reduce) { anim = null; setView(t); } else anim = { a: view, b: t, t0: performance.now(), dur: 650 }; }

  // Only the place dots are clickable: the nearest one within a generous radius wins.
  function pinNear(px, py, radius) {
    var best = null, bd = radius;
    PLACES.forEach(function (p) { var o = mapPoint(p), d = Math.hypot(sx(o.x) - px, sy(o.y) - py); if (d < bd) { bd = d; best = p; } });
    return best;
  }
  // ---- hover preview: a small rolling photo carousel beside the dot ----
  var peek = document.createElement('div'), peekTimer = null, peekI = 0;
  peek.className = 'peek'; peek.setAttribute('aria-hidden', 'true');
  layer.appendChild(peek);
  function showPeek(p) {
    clearInterval(peekTimer); peekTimer = null;
    if (!p) { peek.classList.remove('show'); return; }
    var list = p.imgs || [p.img], o = mapPoint(p);
    peek.dataset.x = o.x; peek.dataset.y = o.y;
    peek.style.left = sx(o.x) + 'px'; peek.style.top = sy(o.y) + 'px';
    peek.classList.toggle('left', sx(o.x) > map.clientWidth - 280);
    peek.classList.toggle('below', sy(o.y) < 200);
    peek.innerHTML = '<div class="peek-imgs">' + list.map(function (src, i) { return '<img src="' + src + '" alt=""' + (i ? '' : ' class="on"') + '>'; }).join('') + '</div>' +
      (list.length > 1 ? '<div class="peek-dots">' + list.map(function (_, i) { return '<i' + (i ? '' : ' class="on"') + '></i>'; }).join('') + '</div>' : '') +
      '<div class="peek-txt"><b>' + p.name + '</b><span>' + p.label + '</span><em>' + (p.journey ? (p.journeyText || 'Follow the journey') : p.music ? 'The music: <i>' + p.music + '</i>' : '') + '</em></div>';
    peek.classList.add('show'); peekI = 0;
    if (list.length > 1 && !reduce) peekTimer = setInterval(function () {
      var ims = peek.querySelectorAll('.peek-imgs img'), ds = peek.querySelectorAll('.peek-dots i');
      ims[peekI].classList.remove('on'); ds[peekI].classList.remove('on');
      peekI = (peekI + 1) % ims.length; ims[peekI].classList.add('on'); ds[peekI].classList.add('on');
    }, 1300);
  }
  function openPlace(p) {
    if (p.journey) { location.href = p.journey; return; }
    if (p.musicRow) { location.href = 'index.html#' + p.musicRow; return; }
    selectPlace(p.id, true);
  }
  window.twMap = { select: function (id) { selectPlace(id === 'sevan' ? 'armenia' : id, true); } };

  function setHot(p) {
    if (hot === p) return; hot = p; showPeek(p);
    layer.querySelectorAll('.pin').forEach(function (el) { el.classList.toggle('hot', !!p && el.dataset.place === p.id); });
    layer.querySelectorAll('.pin-label').forEach(function (el) { el.classList.toggle('show', !!p && el.dataset.for === p.id); });
    map.classList.toggle('over-pin', !!p);
  }
  function local(e) { var r = map.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  map.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.zoom') || e.button > 0) return;
    var q = local(e); pts[e.pointerId] = q; anim = null;
    try { map.setPointerCapture(e.pointerId); } catch (err) {}
    var ids = Object.keys(pts);
    if (ids.length === 1) drag = { x: q.x, y: q.y, tx: view.tx, ty: view.ty, moved: false, touch: e.pointerType !== 'mouse' };
    else if (ids.length === 2) {
      var a = pts[ids[0]], b = pts[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: view.s };
      if (drag) drag.moved = true;
    }
  });
  map.addEventListener('pointermove', function (e) {
    var q = local(e);
    if (e.pointerType === 'mouse') mouse = q;
    if (pts[e.pointerId]) pts[e.pointerId] = q;
    var ids = Object.keys(pts);
    if (pinch && ids.length >= 2) {
      var a = pts[ids[0]], b = pts[ids[1]];
      setView(zoomTarget((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
      return;
    }
    if (drag) {
      var dx = q.x - drag.x, dy = q.y - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 6) { drag.moved = true; map.classList.add('dragging'); setHot(null); }
      if (drag.moved) setView(clampView({ s: view.s, tx: drag.tx + dx, ty: drag.ty + dy }));
      return;
    }
    if (e.pointerType === 'mouse') setHot(pinNear(q.x, q.y, 40));
  });
  function endPointer(e) {
    if (drag && !drag.moved && e.type === 'pointerup') {
      var q = local(e), p = pinNear(q.x, q.y, drag.touch ? 56 : 40);
      if (p) { if (EMBED) openPlace(p); else selectPlace(p.id, false); }
    }
    delete pts[e.pointerId];
    if (Object.keys(pts).length < 2) pinch = null;
    if (!Object.keys(pts).length) { drag = null; map.classList.remove('dragging'); }
  }
  map.addEventListener('pointerup', endPointer);
  map.addEventListener('pointercancel', endPointer);
  map.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !drag) { mouse = null; setHot(null); } });
  // Trackpad pinch (and ctrl/cmd + scroll) zooms; plain scrolling still scrolls the page.
  map.addEventListener('wheel', function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault(); anim = null;
    var q = local(e), dy = Math.max(-60, Math.min(60, e.deltaY));
    setView(zoomTarget(q.x, q.y, view.s * Math.exp(-dy * 0.01)));
  }, { passive: false });
  window.addEventListener('resize', function () { setView(clampView({ s: clampS(view.s), tx: view.tx, ty: view.ty })); });

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

  // The upcoming journey as lon, lat pairs: Casablanca down the coast to The Gambia. Drawn faintly so the articles lead.
  var ROUTE_NEXT = [-7.59, 33.57, -9.6, 30.4, -14.5, 26.13, -16, 18.1, -17.4, 14.7, -16.6, 13.45];
  // Colours for the map on the dark stage: resting dots, pointer glow (oxide) and the one-off ring (pale indigo).
  var DOT = [62, 66, 71], GLOW = [232, 103, 74], RING = [143, 166, 194];
  function rx(lon) { return sx((lon - LON0) * U); }
  function ry(lat) { return sy((LAT0 - lat) * U); }

  // Draws the whole map (dots, routes, hover glow, one-off ring) at the current pan and zoom.
  function draw(now) {
    requestAnimationFrame(draw);
    if (anim) {
      var t = Math.min(1, (now - anim.t0) / anim.dur), e = 1 - Math.pow(1 - t, 3);
      view = { s: anim.a.s + (anim.b.s - anim.a.s) * e, tx: anim.a.tx + (anim.b.tx - anim.a.tx) * e, ty: anim.a.ty + (anim.b.ty - anim.a.ty) * e };
      if (t >= 1) anim = null;
      layout();
    }
    var w = map.clientWidth, h = map.clientHeight; if (!w || !h) { wasHidden = true; return; }
    if (wasHidden) { wasHidden = false; setView(homeView()); pulseT = now; }
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    var g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cw, ch);
    if (state.side !== 'travel') return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var r = 2.7 * Math.pow(view.s, 0.6), o = mapPoint(byId(state.place)), ox = sx(o.x), oy = sy(o.y);
    var pAge = (now - pulseT) / PULSE_MS;
    var R = (reduce || pAge < 0 || pAge >= 1) ? -1 : pAge * PULSE_R;
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
  }

  setView(homeView());
  // Deep links from other pages: #music, #travel, #place-<id> (travel side, that place selected), #row-<id> (music side, that work lit)
  function fromHash() {
    if (EMBED) return;
    var h = (location.hash || '').slice(1);
    if (h === 'travel') setSide('travel');
    else if (h === 'music') setSide('music');
    else if (h.indexOf('place-') === 0) { var id = h.slice(6); if (id === 'sevan') id = 'armenia'; selectPlace(id, false); setSide('travel'); }
    else if (h.indexOf('row-') === 0 && document.getElementById(h)) setSide('music', h);
    else return;
    stage.scrollIntoView({ block: 'start' });
  }
  selectPlace('armenia', false);
  setSide(stage.dataset.side || 'music');
  fromHash();
  window.addEventListener('hashchange', fromHash);
  requestAnimationFrame(draw);
})();
