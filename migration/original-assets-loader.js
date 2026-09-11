// Inline bootstrap generated into _header.html by pnpm snippets.
// The production <link> exists without JavaScript. Development is staging-only.
function loadBrandVisionAssets(config) {
  var css = document.getElementById('bv-site-css');
  var staging = /\.webflow\.io$/.test(location.hostname);
  var dev = false;
  if (staging) {
    try {
      var params = new URLSearchParams(location.search);
      var flag = params.get('bv-dev');
      if (flag !== null) {
        dev = flag === '1';
        try { localStorage.setItem('bv-dev', flag); } catch (_) {}
      } else {
        dev = localStorage.getItem('bv-dev') === '1';
      }
    } catch (_) {}
  }

  var candidates = [];
  if (dev) candidates.push({ css: config.devBase + 'styles.css', js: config.devBase + 'index.js' });
  if (staging) {
    var stamp = '?v=' + Date.now();
    candidates.push({ css: config.stagingBase + 'styles.css' + stamp, js: config.stagingBase + 'index.js' + stamp });
  }
  candidates.push(config.production);

  function attempt(index) {
    var candidate = candidates[index];
    if (!candidate) {
      console.error('[Brand Vision] Custom code could not be loaded.');
      return;
    }
    function loadScript() {
      var script = document.createElement('script');
      script.src = candidate.js;
      script.async = true;
      script.onerror = function () {
        script.remove();
        attempt(index + 1);
      };
      document.head.appendChild(script);
    }
    // Production takes the direct path, with no staging / localhost requests.
    if (!css || css.getAttribute('href') === candidate.css) {
      loadScript();
      return;
    }
    var settled = false;
    // A local server that accepts connections but never responds should not
    // strand a staging preview. Production CSS has no bootstrap timeout.
    var timeout = setTimeout(function () { finish(false); }, 8000);
    function finish(ok) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      css.onload = css.onerror = null;
      if (ok) loadScript();
      else attempt(index + 1);
    }
    css.onload = function () { finish(true); };
    css.onerror = function () { finish(false); };
    css.href = candidate.css;
  }

  attempt(0);
}
