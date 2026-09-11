// Shared Embed: select CSS early, but leave every JavaScript request to the footer.
function prepareBrandVisionStyles(config) {
  if (window.__bvAssets) return;
  var staging = /\.webflow\.io$/.test(location.hostname) || /\.canvas\.webflow\.com$/.test(location.hostname);
  var dev = false;
  if (staging) {
    try {
      var flag = new URLSearchParams(location.search).get('bv-dev');
      if (flag !== null) {
        dev = flag === '1';
        try { localStorage.setItem('bv-dev', flag); } catch (_) {}
      } else dev = localStorage.getItem('bv-dev') === '1';
    } catch (_) {}
  }
  var candidates = [];
  if (dev) candidates.push({ css: config.devBase + 'styles.css', js: config.devBase + 'index.js' });
  if (staging) {
    var stamp = '?v=' + Date.now();
    candidates.push({ css: config.stagingBase + 'styles.css' + stamp, js: config.stagingBase + 'index.js' + stamp });
  }
  candidates.push(config.production);
  var css = document.getElementById('bv-css');
  var state = window.__bvAssets = { candidates: candidates, select: select };
  state.ready = select(0);

  function select(index) {
    var candidate = candidates[index];
    if (!candidate) return Promise.resolve(-1);
    if (!css) {
      css = document.createElement('link');
      css.id = 'bv-css';
      css.rel = 'stylesheet';
      document.head.appendChild(css);
    }
    // The production link is real markup, already encountered before this script.
    // Do not put production JavaScript behind an extra CSS load-event dependency.
    if (css.getAttribute('href') === candidate.css) return Promise.resolve(index);
    return new Promise(function (resolve) {
      var settled = false;
      var timeout = setTimeout(function () { finish(false); }, 8000);
      function finish(ok) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        css.onload = css.onerror = null;
        resolve(ok ? index : select(index + 1));
      }
      css.onload = function () { finish(true); };
      css.onerror = function () { finish(false); };
      css.href = candidate.css;
    });
  }
}
