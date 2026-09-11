const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const source = readFileSync(resolve(__dirname, '../webflow/assets-loader.js'), 'utf8');
const config = {
  production: { css: 'https://cdn.example/v1/styles.css', js: 'https://cdn.example/v1/index.js' },
  stagingBase: 'https://preview.example/', devBase: 'http://localhost:3000/',
};

function setup({ host = 'www.brandvm.com', search = '', stored = null, denyStorage = false } = {}) {
  const scripts = [], styleRequests = [], timers = new Map();
  let href = config.production.css;
  const css = {
    getAttribute: () => href,
    get href() { return href; },
    set href(value) { href = value; styleRequests.push(value); },
  };
  const context = vm.createContext({
    document: {
      getElementById: () => css,
      createElement: () => ({ remove() { this.removed = true; } }),
      head: { appendChild: (script) => scripts.push(script) },
    },
    location: { hostname: host, search }, URLSearchParams,
    localStorage: {
      getItem() { if (denyStorage) throw Error('blocked'); return stored; },
      setItem(_, value) { if (denyStorage) throw Error('blocked'); stored = value; },
    },
    setTimeout(fn) { const id = timers.size + 1; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    console: { error() {} },
  });
  vm.runInContext(source, context);
  context.loadBrandVisionAssets(config);
  return { css, scripts, styleRequests, timers };
}

test('production ignores dev flags and requests only pinned JavaScript', () => {
  const h = setup({ search: '?bv-dev=1', stored: '1' });
  assert.deepEqual(h.styleRequests, []);
  assert.deepEqual(h.scripts.map(s => s.src), [config.production.js]);
  assert.equal(h.timers.size, 0);
});

test('staging waits for its stylesheet before requesting matching JavaScript', () => {
  const h = setup({ host: 'brandvm.webflow.io' });
  assert.match(h.css.href, /^https:\/\/preview.example\/styles.css\?v=/);
  assert.equal(h.scripts.length, 0);
  h.css.onload();
  assert.match(h.scripts[0].src, /^https:\/\/preview.example\/index.js\?v=/);
  assert.equal(h.timers.size, 0);
});

test('failed local CSS falls back to staging, even if storage is blocked', () => {
  const h = setup({ host: 'brandvm.webflow.io', search: '?bv-dev=1', denyStorage: true });
  assert.equal(h.css.href, 'http://localhost:3000/styles.css');
  h.css.onerror();
  assert.match(h.css.href, /^https:\/\/preview.example/);
  h.css.onload();
  assert.match(h.scripts[0].src, /^https:\/\/preview.example/);
});

test('failed staging JavaScript restores production CSS before production JavaScript', () => {
  const h = setup({ host: 'brandvm.webflow.io' });
  h.css.onload();
  h.scripts[0].onerror();
  assert.equal(h.scripts[0].removed, true);
  assert.equal(h.css.href, config.production.css);
  assert.equal(h.scripts.length, 1);
  h.css.onload();
  assert.equal(h.scripts[1].src, config.production.js);
});

test('a stalled local stylesheet times out to staging', () => {
  const h = setup({ host: 'brandvm.webflow.io', stored: '1' });
  [...h.timers.values()][0]();
  assert.match(h.css.href, /^https:\/\/preview.example/);
});

test('the dev-off URL overrides a persisted local flag', () => {
  const h = setup({ host: 'brandvm.webflow.io', search: '?bv-dev=0', stored: '1' });
  assert.match(h.css.href, /^https:\/\/preview.example/);
});

test('a hostname containing webflow.io is not enough to enable development', () => {
  const h = setup({ host: 'brandvm.webflow.io.example.com', search: '?bv-dev=1' });
  assert.deepEqual(h.styleRequests, []);
  assert.equal(h.scripts[0].src, config.production.js);
});
