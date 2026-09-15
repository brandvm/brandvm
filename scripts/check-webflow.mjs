// Read-only external check: published HTML stays intact. Only asset responses in
// this isolated browser use the local build; nothing is deployed or published.
import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const args = process.argv.slice(2);
const local = args.includes('--local');
const production = args.includes('--production');
assert.ok(!(local && production), '--local is available only on staging');
for (const arg of args) {
  assert.ok(['--local', '--production'].includes(arg) || (arg.startsWith('/') && !arg.startsWith('//')),
    `Unknown option or invalid page path: ${arg}`);
}
const selectedPaths = args.filter(arg => arg.startsWith('/'));
const paths = selectedPaths.length ? selectedPaths : [
  '/', '/contact', '/our-work-portfolio', '/insights', '/branding', '/about',
  '/case-studies/ai-data-center-branding-website',
];
const site = production ? 'https://www.brandvm.com' : 'https://brandvm.webflow.io';
const stageBase = 'https://brandvm.github.io/brandvm/';
const localBase = 'http://localhost:3000/';
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const bundle = await readFile(new URL('../dist/index.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../dist/styles.css', import.meta.url), 'utf8');
const mode = production ? 'production' : local ? 'local' : 'staging';
const output = `test-results/webflow-${mode}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];

function assetName(url) {
  const parsed = new URL(url);
  if (url.startsWith(stageBase) || url.startsWith(localBase)
    || (parsed.hostname === 'cdn.jsdelivr.net' && /^\/gh\/brandvm\/brandvm@[^/]+\/dist\//.test(parsed.pathname))) {
    return /\/(index\.js|styles\.css)$/.exec(parsed.pathname)?.[1];
  }
}

try {
  for (const width of [1440, 390]) {
    for (const path of paths) {
      const context = await browser.newContext({
        viewport: { width, height: 900 }, serviceWorkers: 'block',
      });
      if (local) await context.grantPermissions(['local-network-access'], { origin: site });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const errors = [], assets = [], failedAssets = [], blockedWrites = [];
      const record = { width, path, mode, passed: false, errors, assets, failedAssets, blockedWrites };
      results.push(record);
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error' && /^\[bv\]/.test(message.text())) errors.push(message.text());
      });
      page.on('requestfailed', request => {
        if (assetName(request.url())) failedAssets.push(request.url());
      });
      await page.route('**/*', async route => {
        const request = route.request();
        const url = request.url();
        if (!['GET', 'HEAD'].includes(request.method())) {
          blockedWrites.push(new URL(url).origin + new URL(url).pathname);
          return route.abort('blockedbyclient');
        }
        if (request.isNavigationRequest() && new URL(url).origin === site) {
          const response = await route.fetch();
          const html = await response.text();
          if (response.status() !== 200 || !html.includes('data-wf-site="68b9f0236581de795cba8ec2"')) {
            errors.push(`Unexpected page response: ${response.status()} ${url}`);
          }
          return route.fulfill({ response, body: html });
        }
        const name = assetName(url);
        if (name) {
          assets.push(url);
          if (local && url.startsWith(localBase)) return route.continue();
          return route.fulfill({
            contentType: name === 'index.js' ? 'text/javascript' : 'text/css',
            body: name === 'index.js' ? bundle : css,
          });
        }
        if (request.resourceType() === 'media'
          || /(?:googletagmanager|google-analytics|analytics\.ahrefs|clarity\.ms|facebook\.net|facebook\.com)/.test(new URL(url).hostname)) {
          return route.abort('blockedbyclient');
        }
        return route.continue();
      });
      try {
        const url = new URL(path, site);
        assert.equal(url.origin, site);
        url.searchParams.set('bv-dev', local ? '1' : '0');
        await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForFunction(expected => document.documentElement.dataset.bvVersion === expected, version);
        await page.locator('h1').first().waitFor({ state: 'visible' });
        // Give native page scripts a chance to finish without waiting for analytics/media.
        await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
        record.state = await page.evaluate(() => ({
          booted: !!window.__brandvmBooted,
          version: document.documentElement.dataset.bvVersion,
          source: window.BV?.source || null,
          dev: !!window.BV?.dev,
          switchers: document.querySelectorAll('#bv-environment').length,
          scrollLocked: document.documentElement.classList.contains('is-loading'),
          ix3Ready: document.documentElement.classList.contains('w-mod-ix3'),
          heading: document.querySelector('h1')?.textContent?.trim(),
          localCSS: !!document.querySelector('#bv-css-dev'),
          stylesheet: document.querySelector('#bv-css')?.getAttribute('href'),
          navCTA: [...document.querySelectorAll('.g-nav-w .grouped-cta-w')].map(element => ({
            display: getComputedStyle(element).display, visibility: getComputedStyle(element).visibility,
          })),
          hero: [...document.querySelectorAll('.s-home-hero :is(.grouped-cta-w, .text-b)')].map(element => ({
            display: getComputedStyle(element).display, visibility: getComputedStyle(element).visibility,
          })),
        }));
        assert.equal(record.state.booted, true);
        assert.equal(record.state.version, version);
        assert.equal(record.state.switchers, production ? 0 : 1);
        assert.equal(record.state.scrollLocked, false);
        assert.equal(record.state.dev, local);
        assert.equal(assets.filter(url => assetName(url) === 'index.js').length, 1,
          'Expected one site bundle request, without a hidden fallback');
        assert.ok(assets.some(url => assetName(url) === 'styles.css'), 'Expected a site stylesheet request');
        assert.deepEqual(failedAssets, [], 'A site asset failed to load');
        if (!production) assert.equal(record.state.source, local ? localBase : stageBase);
        assert.deepEqual(errors, [], 'Runtime errors were recorded');
        record.passed = true;
      } catch (error) {
        record.failure = error.message;
      } finally {
        if (path === '/' || !record.passed) {
          const filename = path.replace(/[^a-z0-9-]/gi, '_') || 'home';
          await page.screenshot({ path: `${output}/${filename}-${width}.png`, animations: 'disabled' })
            .catch(error => { record.screenshotError = error.message; });
        }
        console.log(JSON.stringify(record));
        await context.close();
      }
    }
  }
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2) + '\n');
  await browser.close();
}
const failures = results.filter(result => !result.passed);
console.log(`${results.length - failures.length}/${results.length} page checks passed. Report: ${output}/results.json`);
if (failures.length) process.exitCode = 1;
