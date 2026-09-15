import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const bundle = readFileSync(new URL('../../dist/index.js', import.meta.url), 'utf8');

async function setup(page, { noObserver = false, errorName = null, synchronous = false } = {}) {
  await page.route('**/*', route => route.abort());
  await page.setContent(`<!doctype html><html><body>
    <style>
      video { position: absolute; left: 0; width: 180px; height: 100px; }
      body { height: 5000px; }
    </style>
    <video id="near" style="top:0" autoplay preload="none" data-bv-lazy-video="true">
      <source data-src="https://media.example/near.mp4" type="video/mp4">
    </video>
    <video id="unmarked" style="top:120px" autoplay preload="none" data-src="https://media.example/unmarked.mp4"></video>
    <video id="loaded" style="top:240px" autoplay preload="none" data-bv-lazy-video="true" data-bv-video-loaded="true"></video>
    <video id="buffer" style="top:calc(100vh + 150px)" autoplay preload="none" data-bv-lazy-video="true" data-src="https://media.example/buffer.mp4"></video>
    <video id="far" style="top:3500px" autoplay preload="none" data-bv-lazy-video="true" data-src="https://media.example/far.mp4"></video>
  </body></html>`);
  await page.evaluate(({ noObserver, errorName, synchronous }) => {
    // Keep Webflow pending: the controller must start on DOM readiness alone.
    window.Webflow = [];
    window.mediaCalls = { load: [], play: [], pause: [] };
    window.playing = {};
    if (noObserver) delete window.IntersectionObserver;
    // Exercise real viewport observations without codecs or media downloads.
    HTMLMediaElement.prototype.load = function () { window.mediaCalls.load.push(this.id); };
    HTMLMediaElement.prototype.pause = function () {
      window.mediaCalls.pause.push(this.id);
      window.playing[this.id] = false;
    };
    HTMLMediaElement.prototype.play = function () {
      window.mediaCalls.play.push(this.id);
      if (errorName) {
        const error = new DOMException('Playback failed', errorName);
        if (synchronous) throw error;
        return Promise.reject(error);
      }
      window.playing[this.id] = true;
      return Promise.resolve();
    };
  }, { noObserver, errorName, synchronous });
  await page.addScriptTag({ content: bundle });
  await expect.poll(() => page.evaluate(() => window.mediaCalls.play.includes('near'))).toBe(true);
}

test('preloads opted-in sources within 300px but plays only visible videos', async ({ page }) => {
  await setup(page);
  await expect(page.locator('#near source')).toHaveAttribute('src', 'https://media.example/near.mp4');
  await expect(page.locator('#near source')).not.toHaveAttribute('data-src');
  await expect(page.locator('#buffer')).toHaveAttribute('src', 'https://media.example/buffer.mp4');
  await expect(page.locator('#far')).not.toHaveAttribute('src');
  expect(await page.evaluate(() => window.mediaCalls.load)).toEqual(['near', 'buffer']);
  expect(await page.evaluate(() => window.mediaCalls.play)).toEqual(['near', 'unmarked', 'loaded']);
  expect(await page.evaluate(() => window.__brandvmBooted)).toBeUndefined();
  for (const id of ['near', 'buffer']) {
    await expect(page.locator(`#${id}`)).toHaveJSProperty('muted', true);
    await expect(page.locator(`#${id}`)).toHaveJSProperty('defaultMuted', true);
    await expect(page.locator(`#${id}`)).toHaveJSProperty('playsInline', true);
    await expect(page.locator(`#${id}`)).toHaveJSProperty('preload', 'auto');
  }
  expect(await page.locator('video').evaluateAll(videos => videos.every(video => !video.autoplay))).toBe(true);
  await expect(page.locator('#unmarked')).not.toHaveAttribute('src');
  await expect(page.locator('#unmarked')).not.toHaveAttribute('data-bv-video-loaded');
});

test('pauses offscreen videos, resumes on return, and loads sources only once', async ({ page }) => {
  await setup(page);
  await page.locator('#far').scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.playing.far)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.playing.near)).toBe(false);
  await expect(page.locator('#far')).toHaveAttribute('src', 'https://media.example/far.mp4');
  await expect(page.locator('#far')).not.toHaveAttribute('data-src');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.playing.near)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.playing.far)).toBe(false);
  expect(await page.evaluate(() => window.mediaCalls.load)).toEqual(['near', 'buffer', 'far']);
  const before = await page.evaluate(() => window.mediaCalls);
  await page.addScriptTag({ content: bundle });
  expect(await page.evaluate(() => window.mediaCalls)).toEqual(before);
});

test('hidden documents pause all videos and resume only visible videos', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(() => Object.values(window.playing).every(value => !value))).toBe(true);
  const before = await page.evaluate(() => window.mediaCalls.play.length);
  await page.locator('#far').scrollIntoViewIfNeeded();
  await expect(page.locator('#far')).toHaveAttribute('data-bv-video-loaded', 'true');
  expect(await page.evaluate(() => window.mediaCalls.play.length)).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => window.playing.far)).toBe(true);
  expect(await page.evaluate(() => window.playing.near)).toBe(false);
});

test('without IntersectionObserver plays all videos and loads only opted-in sources', async ({ page }) => {
  await setup(page, { noObserver: true });
  expect(await page.evaluate(() => window.mediaCalls.load)).toEqual(['near', 'buffer', 'far']);
  expect(await page.evaluate(() => window.mediaCalls.play)).toEqual(['near', 'unmarked', 'loaded', 'buffer', 'far']);
  await expect(page.locator('#unmarked')).not.toHaveAttribute('src');
});

for (const synchronous of [false, true]) {
  for (const errorName of ['AbortError', 'NotAllowedError']) {
    test(`${synchronous ? 'synchronous' : 'rejected'} ${errorName} ${errorName === 'AbortError' ? 'keeps controls hidden' : 'enables controls'}`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await setup(page, { errorName, synchronous });
      await expect(page.locator('#near')).toHaveJSProperty('controls', errorName !== 'AbortError');
      await expect(page.locator('#far')).toHaveJSProperty('controls', false);
      expect(errors).toEqual([]);
    });
  }
}
