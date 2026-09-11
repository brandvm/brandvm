const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { version } = require('../package.json');
const loader = readFileSync(resolve(__dirname, '../loader.html'), 'utf8');
function section(name) {
  const match = loader.match(new RegExp(`<!-- START ${name} -->([\\s\\S]*?)<!-- END ${name} -->`));
  assert.ok(match, `loader.html must contain the ${name} section`);
  return match[1];
}
function script(html) {
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(matches.length, 1, 'Each executable section must contain one script');
  return matches[0][1];
}
const head = section('HEAD'), cssEmbed = section('EMBED_CSS');
const configEmbed = section('EMBED_CONFIG'), footer = section('FOOTER');
module.exports = {
  head, cssEmbed, configEmbed, footer,
  cssScript: script(configEmbed), footerScript: script(footer),
  production: `https://cdn.jsdelivr.net/gh/brandvm/brandvm@${version}/dist/`,
  staging: 'https://brandvm.github.io/brandvm/',
  local: 'http://localhost:3000/',
};
