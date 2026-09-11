const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { version } = require('../package.json');
const { head, embed, cssScript, footerScript, cssConfig: config, footerConfig } = require('./loader-source.cjs');

test('head has no feature loader, stylesheet, or scroll lock', () => {
  assert.ok(head.includes('rel="preconnect"'));
  assert.doesNotMatch(head, /<script|rel="stylesheet"|is-loading/);
});

test('Designer gets one real released stylesheet without static localhost links', () => {
  const links = [...embed.matchAll(/<link\b[^>]+>/g)].map(m => m[0]);
  assert.equal(links.length, 1);
  assert.ok(links[0].includes(`href="${config.production.css}"`));
  assert.ok(links[0].includes('id="bv-css"'));
});

test('both editable loader configurations and the stylesheet match the package release', () => {
  assert.deepEqual(config, footerConfig);
  assert.deepEqual(config.production, {
    version,
    js: `https://cdn.jsdelivr.net/gh/brandvm/brandvm@${version}/dist/index.js`,
    css: `https://cdn.jsdelivr.net/gh/brandvm/brandvm@${version}/dist/styles.css`,
  });
  assert.equal(config.stagingBase, 'https://brandvm.github.io/brandvm/');
  assert.equal(config.devBase, 'http://localhost:3000/');
});

test('actual loader.html Embed and footer cooperate without downloading JS in the Embed', async () => {
  const requests = [];
  const context = vm.createContext({
    window: {},
    document: {
      getElementById: () => ({ getAttribute: () => config.production.css }),
      createElement: () => ({}),
      head: { appendChild: () => assert.fail('Production must not add another head asset') },
      body: { appendChild: node => requests.push(node.src) },
    },
    location: { hostname: 'www.brandvm.com', search: '?bv-dev=1' },
  });
  vm.runInContext(cssScript, context);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, []);
  vm.runInContext(footerScript, context);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, [config.production.js]);
});
