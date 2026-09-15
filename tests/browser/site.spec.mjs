import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json');
const { head, cssEmbed, configEmbed, footer, production, staging, local } = require('../loader-source.cjs');
const bundle = readFileSync(new URL('../../dist/index.js', import.meta.url), 'utf8');
const stylesheet = readFileSync(new URL('../../dist/styles.css', import.meta.url), 'utf8');

// All requests are intercepted. These tests never connect to or edit Webflow.
async function loadSite(page, {
  url = 'https://brandvm.webflow.io/',
  failScript = () => false,
  storedDev,
  duplicateFooter = false,
  blockedStorage = false,
  editor = false,
  designer = false,
  body = '',
} = {}) {
  const scripts = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /^\[bv\]/.test(message.text())) errors.push(message.text());
  });
  if (blockedStorage) {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
    });
  }
  if (storedDev !== undefined) {
    await page.addInitScript(value => localStorage.setItem('bv-dev', value), storedDev);
  }
  const html = `<!doctype html><html><head>${head}</head><body>
    ${cssEmbed}${configEmbed}${body}
    <script>
      // Model Webflow's readiness queue, including scripts arriving late.
      const queue = [];
      let ready = false;
      window.Webflow = {
        push(fn) { ready ? fn() : queue.push(fn); },
        env(mode) { return mode === 'editor' ? ${editor} : mode === 'design' ? ${designer} : false; },
      };
      document.addEventListener('DOMContentLoaded', () => {
        ready = true;
        queue.splice(0).forEach(fn => fn());
      });
    </script>
    ${footer}${duplicateFooter ? footer : ''}
  </body></html>`;
  await page.route('**/*', route => {
    const request = route.request();
    if (request.isNavigationRequest()) {
      return route.fulfill({ contentType: 'text/html', body: html });
    }
    if (request.resourceType() === 'script') {
      scripts.push(request.url());
      if (failScript(request.url())) return route.abort();
      return route.fulfill({ contentType: 'text/javascript', body: bundle });
    }
    if (request.resourceType() === 'stylesheet') {
      return route.fulfill({ contentType: 'text/css', body: stylesheet });
    }
    return route.abort();
  });
  await page.goto(url);
  await expect(page.locator('html')).toHaveAttribute('data-bv-version', version);
  expect(errors).toEqual([]);
  return { scripts, errors };
}

test('production ignores saved and URL dev mode and loads one pinned bundle', async ({ page }) => {
  const { scripts } = await loadSite(page, {
    url: 'https://www.brandvm.com/?bv-dev=1', storedDev: '1', duplicateFooter: true,
  });
  expect(scripts).toEqual([production + 'index.js']);
  await expect(page.locator('#bv-css')).toHaveAttribute('href', production + 'styles.css');
  await expect(page.locator('#bv-css-dev')).toHaveCount(0);
  await expect(page.locator('#bv-environment')).toHaveCount(0);
});

test('switcher changes modes, preserves the URL, and stays isolated from site styles', async ({ page }) => {
  await loadSite(page, {
    url: 'https://brandvm.webflow.io/branding?tab=one#services',
    body: '<style>button { background: red !important; font-size: 60px !important; }</style>',
    duplicateFooter: true,
  });
  await expect(page.locator('#bv-environment')).toHaveCount(1);
  const launcher = page.getByRole('button', { name: 'Choose environment (Staging)' });
  await expect(launcher).toHaveCSS('font-size', '11px');
  await launcher.click();
  await page.getByRole('button', { name: 'Dev', exact: true }).click();
  await expect(page).toHaveURL('https://brandvm.webflow.io/branding?tab=one&bv-dev=1#services');
  await expect(page.getByRole('button', { name: 'Choose environment (Dev)' })).toBeVisible();
  expect(await page.evaluate(() => window.BV.source)).toBe(local);
  await page.getByRole('button', { name: 'Choose environment (Dev)' }).click();
  await page.getByRole('button', { name: 'Staging', exact: true }).click();
  await expect(page).toHaveURL('https://brandvm.webflow.io/branding?tab=one&bv-dev=0#services');
  await expect(launcher).toBeVisible();
  expect(await page.evaluate(() => window.BV.source)).toBe(staging);
  await page.addScriptTag({ content: bundle });
  await expect(page.locator('#bv-environment')).toHaveCount(1);
});

test('switcher supports keyboard dismissal, outside clicks, and print hiding', async ({ page }) => {
  await loadSite(page, { body: '<h1>Page content</h1>' });
  const launcher = page.getByRole('button', { name: 'Choose environment (Staging)' });
  await launcher.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Staging', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(launcher).toBeFocused();
  await expect(page.getByRole('group', { name: 'Code environment' })).toBeHidden();
  await launcher.click();
  await page.locator('h1').click();
  await expect(launcher).toBeVisible();
  await expect(page.getByRole('group', { name: 'Code environment' })).toBeHidden();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#bv-environment')).toBeHidden();
});

test('switcher works when localStorage is unavailable', async ({ page }) => {
  await loadSite(page, { blockedStorage: true });
  await page.getByRole('button', { name: 'Choose environment (Staging)' }).click();
  await page.getByRole('button', { name: 'Dev', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Choose environment (Dev)' })).toBeVisible();
  expect(await page.evaluate(() => window.BV.source)).toBe(local);
});

for (const releaseFallback of [false, true]) {
  test(`switcher identifies ${releaseFallback ? 'release' : 'staging'} fallback and retries the selected source`, async ({ page }) => {
    let failing = true;
    await loadSite(page, {
      url: 'https://brandvm.webflow.io/?bv-dev=1',
      failScript: url => failing && (url.startsWith(local) || (releaseFallback && url.startsWith(staging))),
    });
    expect(await page.evaluate(() => window.BV.source)).toBe(releaseFallback ? production : staging);
    await page.getByRole('button', { name: 'Choose environment (Staging)' }).click();
    await expect(page.getByRole('status')).toHaveText(releaseFallback
      ? 'Staging JavaScript unavailable · using release'
      : 'Local JavaScript unavailable · using staging');
    // The indicator reports JavaScript; the existing CSS fallback policy stays intact.
    await expect(page.locator('#bv-css-dev')).toHaveCount(1);
    failing = false;
    await page.getByRole('button', { name: 'Dev', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Choose environment (Dev)' })).toBeVisible();
    expect(await page.evaluate(() => window.BV.source)).toBe(local);
  });
}

for (const [name, options] of [
  ['editor', { editor: true }],
  ['Designer', { designer: true }],
  ['preview frame', { url: 'https://brandvm.canvas.webflow.com/?bv-dev=1' }],
  ['localhost', { url: 'http://localhost:3000/fixture' }],
  ['lookalike staging host', { url: 'https://brandvm.webflow.io.example.com/' }],
]) {
  test(`switcher is absent in ${name}`, async ({ page }) => {
    await loadSite(page, options);
    await expect(page.locator('#bv-environment')).toHaveCount(0);
  });
}

test('dev selection persists across navigation and can be turned off', async ({ page }) => {
  await loadSite(page, { url: 'https://brandvm.webflow.io/?bv-dev=1' });
  await expect(page.locator('#bv-css-dev')).toHaveCount(1);
  expect(await page.evaluate(() => window.BV.dev)).toBe(true);

  await page.goto('https://brandvm.webflow.io/contact');
  await expect(page.locator('html')).toHaveAttribute('data-bv-version', version);
  expect(await page.evaluate(() => window.BV.dev)).toBe(true);
  expect(await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.src)))
    .toEqual([local + 'index.js']);

  await page.goto('https://brandvm.webflow.io/contact?bv-dev=0');
  await expect(page.locator('html')).toHaveAttribute('data-bv-version', version);
  await expect(page.locator('#bv-css-dev')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('bv-dev'))).toBe('0');
  const cssURL = new URL(await page.locator('#bv-css').getAttribute('href'));
  expect(cssURL.origin + cssURL.pathname).toBe(staging + 'styles.css');
  expect(cssURL.searchParams.has('v')).toBe(true);
});

test('failed local and staging scripts fall back to the release without switching CSS', async ({ page }) => {
  const { scripts } = await loadSite(page, {
    url: 'https://brandvm.webflow.io/?bv-dev=1',
    failScript: url => url.startsWith(local) || url.startsWith(staging),
  });
  expect(scripts.map(url => url.split('?')[0])).toEqual([
    local + 'index.js', staging + 'index.js', production + 'index.js',
  ]);
  await expect(page.locator('#bv-css-dev')).toHaveAttribute('href', local + 'styles.css');
  expect((await page.locator('#bv-css').getAttribute('href')).startsWith(staging)).toBe(true);
});

test('read-more remains operable by keyboard after Webflow readiness', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { errors } = await loadSite(page, {
    duplicateFooter: true,
    body: `<div data-readmore="card">
      <div data-readmore="text" style="width:240px;--rm-lines:2">
        ${'<p>A longer description that needs room to expand on the page.</p>'.repeat(12)}
      </div>
      <button data-readmore="toggle"><span data-readmore="label">Read More +</span></button>
    </div>`,
  });
  const button = page.getByRole('button', { name: 'Read More +' });
  const content = page.locator('[data-readmore="text"]');
  await expect(button).toBeVisible();
  const collapsedHeight = await content.evaluate(node => node.clientHeight);
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Read Less −' })).toHaveAttribute('aria-expanded', 'true');
  expect(await content.evaluate(node => node.clientHeight)).toBeGreaterThan(collapsedHeight);
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(content).not.toHaveClass(/is-expanded/);
  expect(errors).toEqual([]);
});

test('IX3 visibility fallback is scoped and releases control after initialization', async ({ page }) => {
  // The initial-hide rule is taken from published Home markup (2026-09-15).
  // Inline styles model animation-owned visibility, opacity and transforms.
  await page.setContent(`<!doctype html><html class="w-mod-js"><head><style>
    html.w-mod-js:not(.w-mod-ix3) :is(.sh-exp-image-w, .section-header-top-info,
    .sh-line, .text-b, .grouped-cta-w, .text-b-m, [data-gsap="animate-wrapper"],
    .process-step, .process-step-line-inner, .process-step-line, .heading-image-mask,
    .project-link-cursor, .service-tabs-menu, .service-tab-link) { visibility: hidden !important; }
  </style></head><body>
    <nav class="g-nav-w">
      <div id="nav-cta" class="grouped-cta-w" style="visibility:hidden">Navigation CTA</div>
      <div id="responsive-hidden" class="grouped-cta-w" style="display:none">Hidden variant</div>
    </nav>
    <section class="s-home-hero">
      <div id="hero-cta" class="grouped-cta-w" style="visibility:hidden">Hero CTA</div>
      <p id="hero-copy" class="text-b" style="visibility:hidden;opacity:0.4;transform:translateY(12px)">Hero text</p>
    </section>
    <section><div id="other-cta" class="grouped-cta-w">Other CTA</div>
      <p id="other-copy" class="text-b">Other text</p></section>
  </body></html>`);
  await expect(page.locator('#nav-cta')).toHaveCSS('visibility', 'hidden');
  await page.addStyleTag({ content: stylesheet });
  for (const id of ['nav-cta', 'hero-cta', 'hero-copy']) {
    await expect(page.locator('#' + id)).toHaveCSS('visibility', 'visible');
  }
  for (const id of ['other-cta', 'other-copy']) {
    await expect(page.locator('#' + id)).toHaveCSS('visibility', 'hidden');
  }
  await expect(page.locator('#responsive-hidden')).toHaveCSS('display', 'none');
  await expect(page.locator('#hero-copy')).toHaveCSS('opacity', '0.4');
  await expect(page.locator('#hero-copy')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 12)');

  await page.evaluate(() => document.documentElement.classList.add('w-mod-ix3'));
  for (const id of ['nav-cta', 'hero-cta', 'hero-copy']) {
    await expect(page.locator('#' + id)).toHaveCSS('visibility', 'hidden');
  }
  await page.evaluate(() => document.documentElement.className = '');
  await expect(page.locator('#nav-cta')).toHaveCSS('visibility', 'hidden');
});
