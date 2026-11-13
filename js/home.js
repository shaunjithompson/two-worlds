/* Two Worlds — home page behaviour: the Music / Travel switch and the dot map. No dependencies. */
(function () {
  'use strict';

  // Places on the map. x / y are percentages of the map box (lon -25..110, lat 60..-6).
  // To add a place: x = (lon + 25) / 135 * 100, y = (60 - lat) / 66 * 100.
  var PLACES = [
    { id: 'journey', name: 'Morocco to The Gambia', label: 'NEXT JOURNEY · DEPARTS [DATE]',
      text: 'Seven weeks down the Atlantic edge of the Sahara, written from the road.',
      img: 'assets/dunes.jpg', x: 5.63, y: 68.64, music: '', musicRow: '', journey: true },
    { id: 'bojador', name: 'Cape Bojador', label: 'WESTERN SAHARA · 26.13° N, 14.50° W',
      text: 'The cape Portuguese sailors feared to pass. The next journey goes by it on the road south.',
      img: 'assets/coast.jpg', x: 7.78, y: 51.32, music: 'O Mar Novo: «As Vagas de Nazaré»', musicRow: 'row-marNovo', journey: true },
    { id: 'darial', name: 'The Darial Gorge', label: 'CAUCASUS · 42.74° N, 44.62° E',
      text: 'Dar-e Alān, the old gate through the Caucasus, painted by Aivazovsky in 1868.',
      img: 'assets/gorge.jpg', x: 51.57, y: 26.15, music: 'Overture: “Beyond the Darial Pass”', musicRow: '', journey: false },
    { id: 'sevan', name: 'Lake Sevan', label: 'ARMENIA · 40.33° N, 45.33° E',
      text: 'The Gegham Sea, high in the Armenian mountains, one of the largest freshwater lakes in the Caucasus.',
      img: 'assets/plain.jpg', x: 52.10, y: 29.80, music: 'À la côte de la mer de Gegham', musicRow: 'row-gegham', journey: false },
    { id: 'krakow', name: 'Kraków', label: 'POLAND · 50.06° N, 19.94° E',
      text: 'On 24 March 1794, in the Main Square, Tadeusz Kościuszko swore his oath to the nation and took up arms against the partitioning powers.',
      img: 'assets/plain.jpg', x: 33.29, y: 15.06, music: 'Koncert „Elegia Kościuszki”', musicRow: 'row-kosciuszko', journey: false },
    { id: 'stalheim', name: 'Stalheim', label: 'NORWAY · 60.84° N, 6.68° E',
      text: 'The view J.C. Dahl painted in 1842: the Nærøy valley falling between sheer walls towards the fjord.',
      img: 'assets/gorge.jpg', x: 23.47, y: 2.6, music: 'Forløp (Forløb)', musicRow: 'row-forlop', journey: false }
  ];
  var MAP_W = 1170, MAP_H = 572;
  var CROSS_ICON = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4"/></svg>';

  var stage = document.getElementById('worlds');
  var map = document.getElementById('map');
  var canvas = map.querySelector('canvas');
  var chips = document.getElementById('chips');
  var imgs = document.getElementById('place-imgs');
  var musicBtn = document.getElementById('place-music');
  var journeyLink = document.getElementById('place-journey');
  var state = { side: 'music', place: 'journey' };
  var bursts = [], mouse = null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function byId(id) { for (var i = 0; i < PLACES.length; i++) if (PLACES[i].id === id) return PLACES[i]; return PLACES[0]; }
  function mapPoint(p) { return { x: p.x / 100 * MAP_W, y: p.y / 100 * MAP_H }; }

  // ---- build pins, chips and place images from PLACES ----
  PLACES.forEach(function (p) {
    var pin = document.createElement('button');
    pin.type = 'button'; pin.className = 'pin'; pin.dataset.place = p.id;
    pin.setAttribute('aria-label', p.name);
    pin.style.left = p.x + '%'; pin.style.top = p.y + '%';
    pin.appendChild(document.createElement('i'));
    var label = document.createElement('span');
    label.className = 'pin-label'; label.setAttribute('aria-hidden', 'true'); label.textContent = p.name;
    label.style.left = p.x + '%'; label.style.top = p.y + '%';
    map.appendChild(pin); map.appendChild(label);

    var chip = document.createElement('button');
    chip.type = 'button'; chip.className = 'chip'; chip.dataset.place = p.id; chip.textContent = p.name;
    chips.appendChild(chip);

    var im = document.createElement('img');
    im.src = p.img; im.alt = ''; im.dataset.place = p.id;
    imgs.appendChild(im);
  });

  function selectPlace(id, ripple) {
    state.place = id;
    var p = byId(id);
    document.querySelectorAll('[data-place]').forEach(function (el) {
      var on = el.dataset.place === id;
      if (el.matches('.pin, .chip')) el.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (el.tagName === 'IMG' && el.parentNode === imgs) el.classList.toggle('on', on);
    });
    document.getElementById('place-label').textContent = p.label;
    document.getElementById('place-name').textContent = p.name;
    document.getElementById('place-text').textContent = p.text;
    musicBtn.hidden = !p.music;
    musicBtn.innerHTML = CROSS_ICON + 'The music: ' + p.music;
    journeyLink.hidden = !p.journey;
    if (ripple) { var o = mapPoint(p); bursts.push({ x: o.x, y: o.y, t: performance.now() }); }
  }

  function setSide(side, highlightRow) {
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
    var pl = e.target.closest('.pin, .chip');
    if (pl) { selectPlace(pl.dataset.place, true); return; }
  });
  musicBtn.addEventListener('click', function () { setSide('music', byId(state.place).musicRow); });

  function toMap(e) { var r = map.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * MAP_W, y: (e.clientY - r.top) / r.height * MAP_H }; }
  map.addEventListener('pointermove', function (e) { mouse = toMap(e); });
  map.addEventListener('pointerleave', function () { mouse = null; });
  map.addEventListener('pointerdown', function (e) { var p = toMap(e); bursts.push({ x: p.x, y: p.y, t: performance.now() }); });

  // ---- the dot field (same simplified coastlines that produced assets/map.png) ----
  function buildDots() {
    var eur = [-9,37,-9.5,38.7,-9,43,-1.5,43.5,-1.2,46,-4.8,48.4,-1.6,49.6,2,51,4.5,52.5,8.5,54,8.2,57,10.5,57.7,12,56,11,54,14,54,19,54.5,21,56,24,58,30,60,110,60,110,21,108,21.5,106.5,20,106,18,108.5,16,109.3,12.5,107,10.5,105,8.6,105,10,103,11,101,12.8,100.5,13.5,100,11,99.3,9.2,101,6.8,103.4,4.5,104.2,1.4,103.4,1.5,101.3,2.9,100.3,5.5,98.5,8,98.6,10,98.5,13,97.6,16.5,95.5,16,94.3,18,92.2,21,90.5,22.5,88.5,21.8,87,21,85,19.8,82.3,16.7,80.2,15,80.3,13,79.8,10.3,78.2,8.9,77.5,8.1,76.3,9.9,74.8,12.9,73.3,17,72.8,19,72.6,21.5,70.5,20.8,69,22.3,68.5,23.5,67,24.8,62.3,25.2,57.5,25.5,56.4,27,52,27.6,50.2,30,48.5,30,48,29.3,50.2,26,51.6,24.3,54.5,24.2,56.3,26.2,56.6,24.5,58.6,23.6,59.8,22.5,57.8,19,55,17,52,16,48.7,14,45,12.8,43.3,12.7,42.7,16.5,39.2,21.5,37,25,35,28,34.9,29.5,34.3,27.8,32.6,29.9,32.3,31.2,34.5,31.5,35,33,35.8,35.5,36.2,36.6,34,36.3,32,36.1,30.6,36.8,28,36.7,27.3,37.5,26.2,39.3,26.2,40,29,41.1,31.5,41.2,35,42,38,41,41.5,41.5,41.6,42.5,39,44,37.5,45,39.3,47.2,35,46.3,33.5,46,33.5,44.5,32.5,45.3,30.7,46.5,29.6,45.2,28.6,43.8,27.9,42.5,28,41.6,27,40.6,26,40.8,24,40.8,23,40.3,22.7,39.3,24,38,23,36.4,21.6,37,21,39,19.4,41.5,19,42.3,16.5,43.5,13.6,45.6,12.3,45.3,12.5,44,14,42.3,16,41.8,18.5,40.2,17,40.5,16.6,38.9,16,38,15.7,40,14.2,40.8,12.2,41.8,10.3,43.5,8.9,44.4,7.3,43.7,5.3,43.3,3.1,42.4,2.2,41.4,0,39.5,-0.7,37.6,-2.2,36.8,-4.4,36.7,-5.6,36,-6.3,36.6,-7.4,37.2];
    var afr = [-5.9,35.8,-2,35.2,3,36.8,8,37,10.3,37.2,11,34,10.2,33.8,11.5,33,15,32.4,19,30.3,20,32.5,23,32.6,25,31.6,29,31,31,31.5,32.3,31.2,32.5,30,33.8,27,35.5,24,37.2,21,37.3,19,38.6,18,39.5,15.5,41.5,13.5,43.3,12.3,43.2,11.5,44.5,10.4,47.5,11.2,51.2,11.9,50.8,9,48,4.5,45.5,2,42.5,-0.3,40.3,-2.5,39.3,-6,12,-6,11.8,-4.8,9.4,0.4,9.7,4,6,4.3,3.4,6.4,-0.2,5.5,-7.7,4.4,-10.8,6.3,-13.2,8.5,-13.7,9.5,-15.6,11.9,-16.6,13.45,-17.5,14.7,-16,18.1,-17,20.9,-15.9,23.7,-14.5,26.1,-12.9,27.9,-9.6,30.4,-7.6,33.6];
    var land = [eur, afr,
      [-5.7,50,1.4,51.3,1.7,52.7,0.3,53,-0.1,54,-1.5,55,-2,56,-1.8,57.6,-3.5,58.6,-5,58.6,-6,57,-5,55,-3,54,-4.5,53.3,-4.2,52,-5.2,51.7,-3,51.3],
      [-10,52,-6,52,-5.5,54.5,-8,55.3,-10,54],
      [5,60,5.5,58.8,8,58,11,59,11.5,58,12.8,56,14.3,55.5,16.5,56.5,18.8,59.5,18,60],
      [79.8,9.6,81.8,7.5,81,6,80,6,79.7,8],
      [95.3,5.6,98,4.3,100.4,2.3,103.7,0,104.5,-2,106,-3.5,105.8,-6,102,-6,101,-2.5,99,0.3,97,2.5],
      [12.5,38,15.6,38.2,15.1,36.7,12.5,37.6],
      [8.2,41.2,9.7,41,9.6,39.2,8.4,39]];
    var cas = [47,45,50,46.6,53,46.8,53,45,51,44.5,50.5,42.5,53,41,54,39.5,53.8,37,51.5,36.7,49.5,37.5,49,39.5,49.8,40.5,47.5,42.8,46.8,44.5];
    function inside(x, y, p) {
      var c = false, n = p.length / 2;
      for (var i = 0; i < n; i++) {
        var j = (i + 1) % n, x1 = p[2 * i], y1 = p[2 * i + 1], x2 = p[2 * j], y2 = p[2 * j + 1];
        if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) c = !c;
      }
      return c;
    }
    var out = [], step = 1.25, sc = MAP_W / 135, row = 0;
    for (var lat = 60 - step / 2; lat > -6; lat -= step, row++) {
      for (var lon = -25 + step / 2 + (row % 2 ? step / 2 : 0); lon < 110; lon += step) {
        var on = false;
        for (var q = 0; q < land.length && !on; q++) on = inside(lon, lat, land[q]);
        if (on && !inside(lon, lat, cas)) out.push((lon + 25) * sc, (60 - lat) * sc);
      }
    }
    return out;
  }
  var dots = buildDots();

  // Draws only the dots that are lit (near the pointer, or on a ripple) over the static map image.
  function draw(now) {
    requestAnimationFrame(draw);
    var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    var g = canvas.getContext('2d');
    g.clearRect(0, 0, cw, ch);
    if (state.side !== 'travel') return;
    var k = cw / MAP_W, o = mapPoint(byId(state.place));
    bursts = bursts.filter(function (b) { return now - b.t < 1800; });
    var R = reduce ? -1 : ((now % 3400) / 3400) * 440;
    for (var i = 0; i < dots.length; i += 2) {
      var x = dots[i], y = dots[i + 1], a = 0, b = 0, d, v;
      if (mouse) { d = Math.hypot(x - mouse.x, y - mouse.y); if (d < 95) { v = 1 - d / 95; a = v * v; } }
      if (R >= 0) { d = Math.hypot(x - o.x, y - o.y); v = 1 - Math.abs(d - R) / 24; if (v > 0) b = v * (1 - R / 440); }
      for (var j = 0; j < bursts.length; j++) {
        var age = (now - bursts[j].t) / 1800;
        d = Math.hypot(x - bursts[j].x, y - bursts[j].y); v = 1 - Math.abs(d - age * 650) / 30;
        if (v > 0) a = Math.max(a, v * (1 - age));
      }
      var f = Math.max(a, b); if (f < 0.03) continue;
      var T = a >= b ? [166, 61, 36] : [33, 54, 79];
      g.fillStyle = 'rgb(' + Math.round(142 + (T[0] - 142) * f) + ',' + Math.round(136 + (T[1] - 136) * f) + ',' + Math.round(123 + (T[2] - 123) * f) + ')';
      g.beginPath(); g.arc(x * k, y * k, 2.7 * k * (1 + 1.5 * f), 0, 6.2832); g.fill();
    }
  }

  selectPlace('journey', false);
  setSide('music');
  requestAnimationFrame(draw);
})();
