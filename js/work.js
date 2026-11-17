/* Two Worlds — score pages: the cover/page preview and the solo tabs with zoom.
   Without JavaScript the thumbnails open each page and every solo shows in turn. */
(function () {
  // ---- preview pager ----
  var pager = document.querySelector('[data-pager]');
  if (pager) {
    var img = pager.querySelector('[data-pager-img]');
    var thumbs = Array.prototype.slice.call(pager.querySelectorAll('[data-pager-thumb]'));
    var ctrl = pager.querySelector('[data-pager-ctrl]');
    var prev = pager.querySelector('[data-pager-prev]');
    var next = pager.querySelector('[data-pager-next]');
    var count = pager.querySelector('[data-pager-count]');
    var i = 0;
    function show(n) {
      i = Math.max(0, Math.min(thumbs.length - 1, n));
      var t = thumbs[i];
      img.removeAttribute('srcset'); img.removeAttribute('sizes');
      img.src = t.dataset.src; img.alt = t.dataset.alt;
      thumbs.forEach(function (x, k) { x.setAttribute('aria-current', k === i ? 'true' : 'false'); });
      if (count) count.textContent = t.dataset.label + ' · ' + (i + 1) + ' of ' + thumbs.length;
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === thumbs.length - 1;
    }
    if (thumbs.length > 1) {
      if (ctrl) ctrl.hidden = false;
      thumbs.forEach(function (t, k) { t.addEventListener('click', function (e) { e.preventDefault(); show(k); }); });
      if (prev) prev.addEventListener('click', function () { show(i - 1); });
      if (next) next.addEventListener('click', function () { show(i + 1); });
      document.querySelectorAll('[data-pager-go]').forEach(function (b) {
        b.hidden = false;
        b.addEventListener('click', function () {
          show(parseInt(b.dataset.pagerGo, 10) || 0);
          pager.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        });
      });
      show(0);
    }
  }

  // ---- solos: tabs + zoom ----
  var box = document.querySelector('[data-solos]');
  if (!box) return;
  var tablist = box.querySelector('[data-solo-tabs]');
  var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
  var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
  var zoomBox = box.querySelector('[data-zoom]');
  var label = box.querySelector('[data-zoom-label]');
  var zin = box.querySelector('[data-zoom-in]'), zout = box.querySelector('[data-zoom-out]'), zfit = box.querySelector('[data-zoom-fit]');
  var LEVELS = [100, 150, 200, 300], START = 1, z = START, cur = 0;
  function applyZoom() {
    var pct = LEVELS[z];
    panels.forEach(function (pn) { pn.querySelector('img').style.width = pct + '%'; });
    label.textContent = pct + '%';
    zout.disabled = z === 0; zin.disabled = z === LEVELS.length - 1;
  }
  function select(n, focus) {
    cur = (n + tabs.length) % tabs.length;
    tabs.forEach(function (t, k) {
      var on = k === cur;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      panels[k].hidden = !on;
    });
    if (focus) tabs[cur].focus();
    z = START; applyZoom();
  }
  tablist.hidden = false; zoomBox.hidden = false;
  tabs.forEach(function (t, k) {
    t.addEventListener('click', function () { select(k); });
    t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); select(cur + 1, true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); select(cur - 1, true); }
      else if (e.key === 'Home') { e.preventDefault(); select(0, true); }
      else if (e.key === 'End') { e.preventDefault(); select(tabs.length - 1, true); }
    });
  });
  zin.addEventListener('click', function () { z = Math.min(LEVELS.length - 1, z + 1); applyZoom(); });
  zout.addEventListener('click', function () { z = Math.max(0, z - 1); applyZoom(); });
  zfit.addEventListener('click', function () { z = 0; applyZoom(); });
  select(0);
})();
