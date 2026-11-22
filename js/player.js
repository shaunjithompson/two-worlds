/* Two Worlds — the recording player on score pages (made from templates/work.html).
   Without JavaScript the page keeps the browser's own <audio controls>. With it, that element
   is hidden and driven by our own controls: play/pause, a waveform you can scrub, and the time.
   The waveform comes from data-peaks, written by tools/build.py from the MP3 (0–100 per bar). */
(function () {
  var roots = document.querySelectorAll('[data-player]');
  if (!roots.length) return;

  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  Array.prototype.forEach.call(roots, function (root) {
    var audio = root.querySelector('audio');
    var ui = root.querySelector('[data-ui]');
    var btn = root.querySelector('[data-play]');
    var seek = root.querySelector('[data-seek]');
    var cur = root.querySelector('[data-cur]');
    var durEl = root.querySelector('[data-dur]');
    var canvas = root.querySelector('[data-wave]');
    var status = root.querySelector('[data-status]');
    if (!audio || !ui || !btn || !seek) return;

    var peaks = (canvas && canvas.dataset.peaks ? canvas.dataset.peaks.split(',') : []).map(Number);
    var dur = parseFloat(root.dataset.duration) || 0;
    var dragging = false, dragVal = 0;

    // swap the browser's controls for ours
    audio.removeAttribute('controls');
    audio.hidden = true;
    ui.hidden = false;

    function setStatus(t) { if (status) status.textContent = t || ''; }
    function duration() { return isFinite(audio.duration) && audio.duration > 0 ? audio.duration : dur; }
    function position() { return dragging ? dragVal : audio.currentTime; }

    // ---- waveform ----
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    var played = cssVar('--paper', '#F1EEE7'), rest = cssVar('--mute-2', '#6E7378'), head = cssVar('--oxide-light', '#E8674A');
    var cw = 0, ch = 0, dpr = 1;
    function size() {
      if (!ctx) return;
      dpr = window.devicePixelRatio || 1;
      cw = canvas.clientWidth; ch = canvas.clientHeight;
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      draw();
    }
    function draw() {
      if (!ctx || !cw) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      var d = duration(), frac = d ? Math.min(1, position() / d) : 0;
      var x = cw * frac;
      if (peaks.length) {
        var step = 3, bars = Math.max(1, Math.floor(cw / step)), mid = ch / 2;
        for (var i = 0; i < bars; i++) {
          // sample the peaks for this bar (peaks may be more or fewer than bars)
          var a = Math.floor(i * peaks.length / bars), b = Math.max(a + 1, Math.floor((i + 1) * peaks.length / bars)), m = 0;
          for (var k = a; k < b && k < peaks.length; k++) m = Math.max(m, peaks[k]);
          var h = Math.max(1.5, (m / 100) * (ch - 2));
          ctx.fillStyle = i * step + 1 <= x ? played : rest;
          ctx.fillRect(i * step, mid - h / 2, 2, h);
        }
      } else {
        // no waveform yet: a plain line
        ctx.fillStyle = rest; ctx.fillRect(0, ch / 2 - 1, cw, 2);
        ctx.fillStyle = played; ctx.fillRect(0, ch / 2 - 1, x, 2);
      }
      if (frac > 0) { ctx.fillStyle = head; ctx.fillRect(Math.min(cw - 2, x), 0, 2, ch); }
    }
    if (ctx) {
      if (window.ResizeObserver) new ResizeObserver(size).observe(canvas);
      else window.addEventListener('resize', size);
      size();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
    }

    // ---- time and slider ----
    function update() {
      var d = duration(), t = position();
      if (d) {
        seek.max = String(Math.round(d));
        if (durEl) durEl.textContent = fmt(d);
      }
      if (!dragging) seek.value = String(Math.round(t));
      if (cur) cur.textContent = fmt(t);
      seek.setAttribute('aria-valuetext', fmt(t) + ' of ' + fmt(d));
      draw();
    }
    var raf = 0;
    function loop() { update(); raf = audio.paused ? 0 : requestAnimationFrame(loop); }
    function setPlaying(on) {
      root.classList.toggle('is-playing', on);
      btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on && !raf) raf = requestAnimationFrame(loop);
    }

    btn.addEventListener('click', function () {
      if (audio.paused) {
        // only one recording at a time
        document.querySelectorAll('[data-player] audio').forEach(function (a) { if (a !== audio) a.pause(); });
        if (audio.preload === 'none') audio.preload = 'auto';
        var p = audio.play();
        if (p && p.catch) p.catch(function (e) { if (e && e.name !== 'AbortError') setStatus('The recording could not be played.'); setPlaying(false); });
      } else {
        audio.pause();
      }
    });

    seek.addEventListener('input', function () { dragging = true; dragVal = +seek.value; update(); });
    seek.addEventListener('change', function () {
      dragging = false;
      try { audio.currentTime = +seek.value; } catch (e) { /* not seekable yet */ }
      update();
    });

    audio.addEventListener('play', function () { setStatus(''); setPlaying(true); });
    audio.addEventListener('pause', function () { setPlaying(false); update(); });
    audio.addEventListener('ended', function () { setPlaying(false); audio.currentTime = 0; update(); });
    audio.addEventListener('waiting', function () { setStatus('Loading…'); });
    audio.addEventListener('playing', function () { setStatus(''); });
    audio.addEventListener('loadedmetadata', update);
    audio.addEventListener('timeupdate', function () { if (audio.paused) update(); });
    audio.addEventListener('error', function () { setStatus('The recording could not be loaded.'); setPlaying(false); });

    // lock screen and headphone controls on phones
    if ('mediaSession' in navigator) {
      audio.addEventListener('play', function () {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: root.dataset.title || document.title,
            artist: 'Shaun Ji-Thompson',
            album: root.dataset.label || '',
            artwork: root.dataset.art ? [{ src: new URL(root.dataset.art, location.href).href }] : []
          });
          navigator.mediaSession.setActionHandler('seekto', function (d) { audio.currentTime = d.seekTime; update(); });
          navigator.mediaSession.setActionHandler('seekbackward', function () { audio.currentTime = Math.max(0, audio.currentTime - 10); });
          navigator.mediaSession.setActionHandler('seekforward', function () { audio.currentTime = Math.min(duration(), audio.currentTime + 10); });
        } catch (e) { /* older browsers */ }
      });
    }

    update();
  });
})();
