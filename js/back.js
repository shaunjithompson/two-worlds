// Back button: returns to the previous page at the same scroll height.
// Uses the browser's history when you arrived from another page on this site;
// otherwise goes to the front page, which restores where you were (index.html#back).
(function () {
  var css = '.tw-brandrow{display:flex;align-items:center;gap:6px 18px;flex-wrap:wrap}' +
    '.tw-back{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px 0 10px;margin-left:-10px;border-radius:999px;' +
    'font-family:"Inter Tight",system-ui,sans-serif;font-size:14px;font-weight:500;' +
    'color:inherit;text-decoration:none;opacity:.75;transition:opacity .2s ease,background-color .2s ease}' +
    '.tw-back:hover{opacity:1;background:rgba(127,127,127,.14)}.tw-back svg{flex:none}';
  var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
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
