const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const read = file => readFileSync(resolve(__dirname, '..', file), 'utf8');
const config = {
  production: { css: 'https://cdn.example/v1/styles.css', js: 'https://cdn.example/v1/index.js' },
  stagingBase: 'https://preview.example/', devBase: 'http://localhost:3000/',
};
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup({ host = 'www.brandvm.com', search = '', stored = null, denyStorage = false, missingEmbed = false } = {}) {
  const scripts = [], links = [], styleRequests = [], timers = new Map(), errors = [], warnings = [];
  let href = config.production.css;
  const css = {
    getAttribute: () => href,
    get href() { return href; },
    set href(value) { href = value; styleRequests.push(value); },
  };
  const context = vm.createContext({
    window: {},
    document: {
      getElementById: () => missingEmbed ? null : css,
      createElement: tag => ({ tag, remove() { this.removed = true; } }),
      head: { appendChild: node => links.push(node) },
      body: { appendChild: node => scripts.push(node) },
    },
    location: { hostname: host, search }, URLSearchParams,
    localStorage: {
      getItem() { if (denyStorage) throw Error('blocked'); return stored; },
      setItem(_, value) { if (denyStorage) throw Error('blocked'); stored = value; },
    },
    setTimeout(fn) { const id = Symbol(); timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    console: { error: message => errors.push(message), warn: message => warnings.push(message) },
  });
  vm.runInContext(read('webflow/css-config.js') + '\n' + read('webflow/footer-loader.js'), context);
  if (!missingEmbed) context.prepareBrandVisionStyles(config);
  return { css, scripts, links, styleRequests, timers, errors, warnings, context,
    footer: () => context.loadBrandVisionScript(config),
    prepare: () => context.prepareBrandVisionStyles(config),
  };
}

test('CSS Embed never requests the feature bundle; only the footer starts JavaScript', async () => {
  const h = setup();
  await flush();
  assert.equal(h.scripts.length, 0);
  h.footer();
  await flush();
  assert.equal(h.scripts[0].src, config.production.js);
  assert.equal(h.scripts[0].async, true);
});

test('production ignores dev flags and storage without staging or localhost requests', async () => {
  const h = setup({ search: '?bv-dev=1', stored: '1', denyStorage: true });
  h.footer();
  await flush();
  assert.deepEqual(h.styleRequests, []);
  assert.deepEqual(h.links, []);
  assert.deepEqual(h.scripts.map(s => s.src), [config.production.js]);
  assert.equal(h.timers.size, 0);
});

test('CSS finishing before the footer does not start JavaScript early', async () => {
  const h = setup({ host: 'brandvm.webflow.io' });
  h.css.onload();
  await flush();
  assert.equal(h.scripts.length, 0);
  h.footer();
  await flush();
  assert.match(h.scripts[0].src, /^https:\/\/preview.example\/index.js\?v=/);
});

test('footer waits for pending staging CSS and uses the same cache token', async () => {
  const h = setup({ host: 'brandvm.webflow.io' });
  h.footer();
  await flush();
  assert.equal(h.scripts.length, 0);
  h.css.onload();
  await flush();
  assert.equal(new URL(h.scripts[0].src).search, new URL(h.css.href).search);
  assert.equal(h.timers.size, 0);
});

test('local CSS failure falls back to staging even when storage is blocked', async () => {
  const h = setup({ host: 'brandvm.webflow.io', search: '?bv-dev=1', denyStorage: true });
  h.footer();
  assert.equal(h.css.href, 'http://localhost:3000/styles.css');
  h.css.onerror();
  assert.match(h.css.href, /^https:\/\/preview.example/);
  h.css.onload();
  await flush();
  assert.match(h.scripts[0].src, /^https:\/\/preview.example/);
});

test('local and staging JS failures switch CSS as well, then reach pinned production', async () => {
  const h = setup({ host: 'brandvm.webflow.io', search: '?bv-dev=1' });
  h.footer();
  h.css.onload();
  await flush();
  assert.equal(h.scripts[0].src, 'http://localhost:3000/index.js');
  h.scripts[0].onerror();
  assert.equal(h.scripts[0].removed, true);
  assert.match(h.css.href, /^https:\/\/preview.example/);
  h.css.onload();
  await flush();
  assert.match(h.scripts[1].src, /^https:\/\/preview.example/);
  h.scripts[1].onerror();
  assert.equal(h.css.href, config.production.css);
  h.css.onload();
  await flush();
  assert.equal(h.scripts[2].src, config.production.js);
  assert.equal(h.timers.size, 0);
});

test('stalled local CSS advances to staging and ignores the old load callback', async () => {
  const h = setup({ host: 'brandvm.webflow.io', stored: '1' });
  h.footer();
  const lateLoad = h.css.onload;
  [...h.timers.values()][0]();
  lateLoad();
  assert.match(h.css.href, /^https:\/\/preview.example/);
  h.css.onload();
  await flush();
  assert.equal(h.scripts.length, 1);
  assert.match(h.scripts[0].src, /^https:\/\/preview.example/);
});

test('dev-off URL overrides a persisted local flag', async () => {
  const h = setup({ host: 'brandvm.webflow.io', search: '?bv-dev=0', stored: '1' });
  h.footer();
  h.css.onload();
  await flush();
  assert.match(h.scripts[0].src, /^https:\/\/preview.example/);
});

test('custom-code preview frames support explicit local mode', async () => {
  const h = setup({ host: 'brandvm.canvas.webflow.com', search: '?bv-dev=1' });
  h.footer();
  h.css.onload();
  await flush();
  assert.equal(h.scripts[0].src, 'http://localhost:3000/index.js');
});

test('lookalike hosts do not enable dev mode', async () => {
  for (const host of ['brandvm.webflow.io.example.com', 'brandvm.canvas.webflow.com.example.com']) {
    const h = setup({ host, search: '?bv-dev=1' });
    h.footer();
    await flush();
    assert.deepEqual(h.styleRequests, []);
    assert.equal(h.scripts[0].src, config.production.js);
  }
});

test('missing shared Embed falls back to both production CSS and JavaScript', () => {
  const h = setup({ missingEmbed: true, host: 'brandvm.webflow.io', search: '?bv-dev=1' });
  h.footer();
  assert.equal(h.links[0].href, config.production.css);
  assert.equal(h.scripts[0].src, config.production.js);
  assert.equal(h.warnings.length, 1);
});

test('repeated Embed configuration and footer execution do not load twice', async () => {
  const h = setup({ host: 'brandvm.webflow.io', search: '?bv-dev=1' });
  h.prepare();
  h.footer();
  h.footer();
  h.css.onload();
  await flush();
  h.footer();
  await flush();
  assert.equal(h.styleRequests.length, 1);
  assert.equal(h.scripts.length, 1);
});

test('exhausted CSS fallback does not load mismatched JavaScript', async () => {
  const h = setup({ host: 'brandvm.webflow.io' });
  h.footer();
  h.css.onerror();
  h.css.onerror();
  await flush();
  assert.equal(h.scripts.length, 0);
  assert.equal(h.errors.length, 1);
  assert.equal(h.timers.size, 0);
});
