// Called only from Webflow's before-</body> custom code.
function loadBrandVisionScript(config) {
  if (window.__bvFooterStarted) return;
  window.__bvFooterStarted = true;
  var state = window.__bvAssets;
  if (!state) {
    console.warn('[Brand Vision] Shared CSS Embed missing; using production assets.');
    var css = document.getElementById('bv-css');
    if (!css) {
      css = document.createElement('link');
      css.id = 'bv-css';
      css.rel = 'stylesheet';
      css.href = config.production.css;
      document.head.appendChild(css);
    }
    return request(config.production.js);
  }
  state.ready.then(start);

  function start(index) {
    if (index < 0) {
      console.error('[Brand Vision] Custom assets could not be loaded.');
      return;
    }
    request(state.candidates[index].js, function () {
      state.ready = state.select(index + 1);
      state.ready.then(start);
    });
  }
  function request(src, fallback) {
    var script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onerror = function () {
      script.remove();
      if (fallback) fallback();
      else console.error('[Brand Vision] Production JavaScript could not be loaded.');
    };
    document.body.appendChild(script);
  }
}
