const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
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
function config(code, name) {
  const match = code.match(new RegExp(`${name}\\((\\{[\\s\\S]*\\})\\);\\s*$`));
  assert.ok(match, `Missing ${name} configuration`);
  return JSON.parse(match[1]);
}
const head = section('HEAD'), embed = section('EMBED'), footer = section('FOOTER');
const cssScript = script(embed), footerScript = script(footer);
module.exports = { head, embed, footer, cssScript, footerScript,
  cssConfig: config(cssScript, 'prepareBrandVisionStyles'),
  footerConfig: config(footerScript, 'loadBrandVisionScript'),
};
