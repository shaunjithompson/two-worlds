// Back button (top left of every inner page): returns to the previous page at the same scroll height.
// Uses the browser's history when you arrived from another page on this site;
// otherwise goes to the front page, which restores where you were (index.html#back).
(function () {
  function sameSiteReferrer() {
    try {
      if (!document.referrer) return false;
      var r = new URL(document.referrer);
      return r.origin === location.origin && r.pathname !== location.pathname;
    } catch (e) { return false; }
  }
  document.querySelectorAll('[data-back]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (sameSiteReferrer() && history.length > 1) { e.preventDefault(); history.back(); }
    });
  });
})();
