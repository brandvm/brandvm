import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const bundle = readFileSync(new URL('../../dist/index.js', import.meta.url), 'utf8');

async function setup(page, { noObserver = false, blockedAutoplay = false } = {}) {
  await page.route('**/*', route => route.abort());
  await page.setContent(`<!doctype html><html><body>
    <style>video { display: block; width: 180px; height: 100px; }</style>
    <video id="near" preload="none" data-bv-lazy-video="true">
      <source data-src="https://media.example/near.mp4" type="video/mp4">
    </video>
    <video id="unmarked" preload="none" data-src="https://media.example/unmarked.mp4"></video>
    <video id="loaded" preload="none" data-bv-lazy-video="true" data-bv-video-loaded="true"></video>
    <div style="height:2500px"></div>
    <video id="far" preload="none" data-bv-lazy-video="true" data-src="https://media.example/far.mp4"></video>
  </body></html>`);
  await page.evaluate(({ noObserver, blockedAutoplay }) => {
    // Keep Webflow pending: this feature must work on DOM readiness alone.
    window.Webflow = [];
    window.mediaCalls = { load: [], play: [] };
    if (noObserver) delete window.IntersectionObserver;
    // Exercise viewport/source handling without downloading media or relying
    // on the test machine's codecs and autoplay permissions.
    HTMLMediaElement.prototype.load = function () { window.mediaCalls.load.push(this.id); };
    HTMLMediaElement.prototype.play = function () {
      window.mediaCalls.play.push(this.id);
      return blockedAutoplay ? Promise.reject(new DOMException('Blocked', 'NotAllowedError')) : Promise.resolve();
    };
  }, { noObserver, blockedAutoplay });
  await page.addScriptTag({ content: bundle });
}

test('videos load near the viewport once, with direct and child sources supported', async ({ page }) => {
  await setup(page);
  const near = page.locator('#near');
  const far = page.locator('#far');
  await expect(near).toHaveAttribute('data-bv-video-loaded', 'true');
  await expect(near.locator('source')).toHaveAttribute('src', 'https://media.example/near.mp4');
  await expect(near.locator('source')).not.toHaveAttribute('data-src');
  await expect(far).not.toHaveAttribute('src');
  await expect(far).toHaveAttribute('data-src', 'https://media.example/far.mp4');
  expect(await page.evaluate(() => window.mediaCalls)).toEqual({ load: ['near'], play: ['near'] });
  expect(await page.evaluate(() => window.__brandvmBooted)).toBeUndefined();

  await far.scrollIntoViewIfNeeded();
  await expect(far).toHaveAttribute('src', 'https://media.example/far.mp4');
  await expect(far).not.toHaveAttribute('data-src');
  for (const video of [near, far]) {
    await expect(video).toHaveJSProperty('muted', true);
    await expect(video).toHaveJSProperty('defaultMuted', true);
    await expect(video).toHaveJSProperty('playsInline', true);
  }
  await near.scrollIntoViewIfNeeded();
  await page.addScriptTag({ content: bundle });
  expect(await page.evaluate(() => window.mediaCalls)).toEqual({ load: ['near', 'far'], play: ['near', 'far'] });
  await expect(page.locator('#unmarked')).not.toHaveAttribute('src');
  await expect(page.locator('#unmarked')).not.toHaveAttribute('data-bv-video-loaded');
});

test('browsers without IntersectionObserver load all opted-in videos', async ({ page }) => {
  await setup(page, { noObserver: true });
  await expect(page.locator('#far')).toHaveAttribute('src', 'https://media.example/far.mp4');
  expect(await page.evaluate(() => window.mediaCalls.load)).toEqual(['near', 'far']);
  await expect(page.locator('#unmarked')).not.toHaveAttribute('src');
});

test('autoplay rejection enables manual playback controls', async ({ page }) => {
  await setup(page, { blockedAutoplay: true });
  await expect(page.locator('#near')).toHaveJSProperty('controls', true);
  await expect(page.locator('#far')).toHaveJSProperty('controls', false);
  expect(await page.evaluate(() => window.mediaCalls.play)).toEqual(['near']);
});
