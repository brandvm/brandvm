const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const read = file => readFileSync(resolve(__dirname, '..', file), 'utf8');
const script = html => html.match(/<script>([\s\S]*?)<\/script>/)[1];

test('generated head has no feature loader, stylesheet, or scroll lock', () => {
  const head = read('webflow/head-assets.html');
  assert.ok(head.includes('rel="preconnect"'));
  assert.doesNotMatch(head, /<script|rel="stylesheet"|is-loading/);
});

test('Designer gets one real released stylesheet without static localhost links', () => {
  const embed = read('webflow/designer-css.html');
  const config = JSON.parse(read('webflow/deployment.json'));
  const links = [...embed.matchAll(/<link\b[^>]+>/g)].map(m => m[0]);
  assert.equal(links.length, 1);
  assert.ok(links[0].includes(`href="${config.production.css}"`));
  assert.ok(links[0].includes('id="bv-css"'));
});

test('actual generated Embed and footer cooperate without downloading JS in the Embed', async () => {
  const config = JSON.parse(read('webflow/deployment.json'));
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
  vm.runInContext(script(read('webflow/designer-css.html')), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, []);
  vm.runInContext(script(read('webflow/footer-assets.html')), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, [config.production.js]);
});
