const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const read = (file) => readFileSync(resolve(__dirname, '..', file), 'utf8');

test('generated production snippet keeps direct head CSS and a single asynchronous bundle request', () => {
  const head = read('webflow/head-assets.html');
  const config = JSON.parse(read('webflow/deployment.json'));
  assert.ok(head.includes(`<link id="bv-site-css" rel="stylesheet" href="${config.production.css}" />`));
  const scripts = [];
  vm.runInNewContext(head.match(/<script>([\s\S]*?)<\/script>/)[1], {
    document: {
      getElementById: () => ({ getAttribute: () => config.production.css }),
      createElement: () => ({}),
      head: { appendChild: script => scripts.push(script) },
    },
    location: { hostname: 'www.brandvm.com', search: '?bv-dev=1' },
  });
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, config.production.js);
  assert.equal(scripts[0].async, true);
});

test('Designer CSS cleanup preserves its link without the published head and removes it when the head exists', () => {
  const embed = read('webflow/designer-css.html');
  const config = JSON.parse(read('webflow/deployment.json'));
  assert.ok(embed.includes(`href="${config.production.css}"`));
  const script = embed.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const hasHead of [false, true]) {
    let removed = 0;
    vm.runInNewContext(script, {
      document: {
        getElementById: id => id === 'bv-site-css' && hasHead,
        querySelectorAll: selector => {
          assert.equal(selector, 'link[data-bv-designer-css]');
          return [{ remove() { removed++; } }];
        },
      },
    });
    assert.equal(removed, hasHead ? 1 : 0);
  }
});
