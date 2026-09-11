const assert = require('node:assert/strict');
const test = require('node:test');
const { version } = require('../package.json');
const { head, cssEmbed, cssScript, footerScript, staging, local } = require('./loader-source.cjs');

test('head has a connection hint without JavaScript or a scroll lock', () => {
  assert.ok(head.includes('rel="preconnect"'));
  assert.doesNotMatch(head, /<script|rel="stylesheet"|is-loading/);
});

test('Designer CSS Embed has two real stylesheets, staging first and localhost second, with no script', () => {
  assert.doesNotMatch(cssEmbed, /<script/);
  const links = [...cssEmbed.matchAll(/<link\b[^>]+>/g)].map(m => m[0]);
  assert.equal(links.length, 2);
  assert.ok(links[0].includes(`href="${staging}styles.css?v=1"`));
  assert.ok(links[0].includes('id="bv-css"'));
  assert.ok(links[1].includes(`href="${local}styles.css"`));
  assert.ok(links[1].includes('id="bv-css-dev"'));
  for (const link of links) assert.ok(link.includes('rel="stylesheet"'));
});

test('both editable release pins match package.json', () => {
  for (const code of [cssScript, footerScript]) {
    assert.equal(code.match(/var VER = ['"]([^'"]+)['"]/)[1], version);
  }
});
