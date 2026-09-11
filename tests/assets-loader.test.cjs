const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { cssScript, footerScript, production, staging, local } = require('./loader-source.cjs');

function setup({ host = 'www.brandvm.com', search = '', stored = null, denyStorage = false, missingConfig = false, missingCSS = false } = {}) {
  const scripts = [], warnings = [];
  const css = { href: staging + 'styles.css?v=1' };
  const devCSS = { href: local + 'styles.css', removed: false, remove() { this.removed = true; } };
  const context = vm.createContext({
    window: {},
    document: {
      getElementById: id => missingCSS ? null : id === 'bv-css' ? css : devCSS,
      createElement: tag => { assert.equal(tag, 'script'); return {}; },
      head: { appendChild: node => scripts.push(node) },
    },
    location: { hostname: host, search }, URLSearchParams,
    localStorage: {
      getItem() { if (denyStorage) throw Error('blocked'); return stored; },
      setItem(_, value) { if (denyStorage) throw Error('blocked'); stored = value; },
    },
    console: { warn: message => warnings.push(message) },
  });
  if (!missingConfig) vm.runInContext(cssScript, context);
  return { css, devCSS, scripts, warnings, context, stored: () => stored,
    footer: () => vm.runInContext(footerScript, context),
  };
}

test('configuration starts no JavaScript request; the footer starts the bundle immediately', () => {
  const h = setup();
  assert.equal(h.scripts.length, 0);
  h.footer();
  assert.deepEqual(h.scripts.map(s => s.src), [production + 'index.js']);
});

test('production selects pinned CSS and removes the local stylesheet despite dev flags', () => {
  const h = setup({ search: '?bv-dev=1', stored: '1', denyStorage: true });
  h.footer();
  assert.equal(h.css.href, production + 'styles.css');
  assert.equal(h.devCSS.removed, true);
  assert.equal(h.context.window.BV.dev, false);
  assert.deepEqual(h.scripts.map(s => s.src), [production + 'index.js']);
});

test('staging cache-busts hosted CSS and JS and removes the local stylesheet', () => {
  const h = setup({ host: 'brandvm.webflow.io' });
  h.footer();
  assert.ok(h.css.href.startsWith(staging + 'styles.css?v='));
  assert.ok(h.scripts[0].src.startsWith(staging + 'index.js?v='));
  assert.equal(h.devCSS.removed, true);
});

test('dev mode keeps localhost CSS after hosted CSS and loads local JavaScript', () => {
  const h = setup({ host: 'brandvm.webflow.io', search: '?bv-dev=1' });
  h.footer();
  assert.ok(h.css.href.startsWith(staging + 'styles.css?v='));
  assert.equal(h.devCSS.href, local + 'styles.css');
  assert.equal(h.devCSS.removed, false);
  assert.equal(h.scripts[0].src, local + 'index.js');
  assert.equal(h.stored(), '1');
});

test('local and staging JavaScript failures eventually fall back to the pinned release', () => {
  const h = setup({ host: 'brandvm.webflow.io', search: '?bv-dev=1' });
  h.footer();
  h.scripts[0].onerror();
  assert.ok(h.scripts[1].src.startsWith(staging + 'index.js?v='));
  h.scripts[1].onerror();
  assert.equal(h.scripts[2].src, production + 'index.js');
});

test('normal staging JavaScript failure falls back to the pinned release', () => {
  const h = setup({ host: 'brandvm.webflow.io' });
  h.footer();
  h.scripts[0].onerror();
  assert.equal(h.scripts[1].src, production + 'index.js');
});

test('saved dev mode applies without a URL flag', () => {
  const h = setup({ host: 'brandvm.webflow.io', stored: '1' });
  h.footer();
  assert.equal(h.devCSS.removed, false);
  assert.equal(h.scripts[0].src, local + 'index.js');
});

test('dev-off URL overrides and replaces a persisted local flag', () => {
  const h = setup({ host: 'brandvm.webflow.io', search: '?bv-dev=0', stored: '1' });
  h.footer();
  assert.equal(h.devCSS.removed, true);
  assert.ok(h.scripts[0].src.startsWith(staging));
  assert.equal(h.stored(), '0');
});

test('URL selection works when storage is blocked; missing flag defaults to staging', () => {
  for (const search of ['?bv-dev=1', '?bv-dev=0', '']) {
    const h = setup({ host: 'brandvm.webflow.io', search, denyStorage: true });
    h.footer();
    assert.equal(h.devCSS.removed, search !== '?bv-dev=1');
    assert.ok(h.scripts[0].src.startsWith(search === '?bv-dev=1' ? local : staging));
  }
});

test('custom-code preview frames support explicit local mode', () => {
  const h = setup({ host: 'brandvm.canvas.webflow.com', search: '?bv-dev=1' });
  h.footer();
  assert.equal(h.devCSS.removed, false);
  assert.equal(h.scripts[0].src, local + 'index.js');
});

test('lookalike domains cannot enable staging or local mode', () => {
  for (const host of ['brandvm.webflow.io.example.com', 'brandvm.canvas.webflow.com.example.com']) {
    const h = setup({ host, search: '?bv-dev=1' });
    h.footer();
    assert.equal(h.css.href, production + 'styles.css');
    assert.equal(h.devCSS.removed, true);
    assert.equal(h.scripts[0].src, production + 'index.js');
  }
});

test('missing configuration warns and loads production JavaScript', () => {
  const h = setup({ missingConfig: true, host: 'brandvm.webflow.io', search: '?bv-dev=1' });
  h.footer();
  assert.equal(h.scripts[0].src, production + 'index.js');
  assert.equal(h.warnings.length, 1);
});

test('missing CSS Embed does not throw or stop the footer', () => {
  const h = setup({ missingCSS: true });
  h.footer();
  assert.equal(h.scripts[0].src, production + 'index.js');
});

test('repeated footer execution starts only one bundle request', () => {
  const h = setup();
  h.footer();
  h.footer();
  assert.equal(h.scripts.length, 1);
});
