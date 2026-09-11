const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Compile the actual TypeScript module; no copied implementation in the fixture.
const { transformSync } = require("esbuild");
const source = readFileSync(resolve(__dirname, "../src/modules/newsletter.ts"), "utf8");
const moduleSource = transformSync(source, { loader: "ts", format: "cjs", target: "es2019" }).code;
const settle = () => new Promise((resolve) => setImmediate(resolve));

function setup({ count = 1, hasIO = true, reduceMotion = false } = {}) {
  const assets = [];
  const observers = [];
  const instances = [];
  const errors = [];
  const sliders = Array.from({ length: count }, () => ({
    dataset: {},
    displayed: true,
    getClientRects() { return this.displayed ? [{}] : []; },
    matches() { return true; },
    closest() { return this; },
    querySelector() { return null; },
  }));
  const createAsset = (tag) => {
    const listeners = new Map();
    return {
      tag,
      addEventListener(name, fn) { listeners.set(name, fn); },
      removeEventListener(name) { listeners.delete(name); },
      emit(name) { listeners.get(name)?.(); },
      remove() { assets.splice(assets.indexOf(this), 1); },
    };
  };
  const document = {
    createElement: createAsset,
    head: { appendChild: (asset) => assets.push(asset) },
    body: { appendChild: (asset) => assets.push(asset) },
    querySelectorAll: () => sliders,
    querySelector(selector) {
      return assets.find((asset) => selector.startsWith("link")
        ? asset.href?.includes("swiper-bundle.min.css")
        : asset.src?.includes("swiper-bundle.min.js")) || null;
    },
  };
  const window = { matchMedia: () => ({ matches: reduceMotion }) };
  class IntersectionObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.targets = new Set();
      observers.push(this);
    }
    observe(el) { this.targets.add(el); }
    unobserve(el) { this.targets.delete(el); }
    intersect(el, isIntersecting = true) {
      if (this.targets.has(el)) this.callback([{ target: el, isIntersecting }]);
    }
  }
  if (hasIO) window.IntersectionObserver = IntersectionObserver;
  const context = vm.createContext({
    window, document, IntersectionObserver, setTimeout, clearTimeout,
    module: { exports: {} },
    console: { error: (...args) => errors.push(args) },
  });
  vm.runInContext(`${moduleSource}\nglobalThis.smartSwiper = module.exports.SmartSwiper;`, context);
  const installSwiper = () => {
    window.Swiper = context.Swiper = class {
      constructor(el, opts) {
        this.el = el;
        this.opts = opts;
        this.updates = 0;
        instances.push(this);
      }
      update() { this.updates++; }
      on() {}
    };
  };
  const finishLoading = () => {
    installSwiper();
    assets.find((asset) => asset.tag === "script")?.emit("load");
  };
  return {
    module: context.smartSwiper, assets, observers, instances, errors, sliders,
    createAsset, finishLoading, installSwiper,
  };
}

test("offscreen sliders request no Swiper assets, including after refresh scans", () => {
  const h = setup();
  h.module.boot();
  h.module.boot();
  assert.equal(h.observers.length, 1);
  assert.equal(h.observers[0].options.rootMargin, "200px 0px");
  h.observers[0].intersect(h.sliders[0], false);
  assert.equal(h.assets.length, 0);
  assert.equal(h.instances.length, 0);
});

test("nearby sliders share one download and initialize only once", async () => {
  const h = setup({ count: 2 });
  h.module.boot();
  for (const el of h.sliders) {
    h.observers[0].intersect(el);
    h.observers[0].intersect(el);
  }
  h.module.boot();
  assert.equal(h.assets.filter((a) => a.tag === "link").length, 1);
  assert.equal(h.assets.filter((a) => a.tag === "script").length, 1);
  assert.equal(h.instances.length, 0);
  h.finishLoading();
  await settle();
  assert.equal(h.instances.length, 2);
  assert.equal(h.observers[0].targets.size, 0);
  h.module.boot();
  assert.equal(h.instances.length, 2);
  assert.equal(h.assets.length, 2);
  assert.ok(h.instances.every((instance) => instance.updates >= 2));
});

test("a tab hidden during download can initialize after becoming visible", async () => {
  const h = setup();
  const el = h.sliders[0];
  h.module.boot();
  h.observers[0].intersect(el);
  el.displayed = false;
  h.finishLoading();
  await settle();
  assert.equal(h.instances.length, 0);
  assert.ok(h.observers[0].targets.has(el));
  el.displayed = true;
  h.observers[0].intersect(el);
  await settle();
  assert.equal(h.instances.length, 1);
  assert.equal(h.assets.length, 2);
});

test("hidden tabs do not start downloads", () => {
  const h = setup();
  h.sliders[0].displayed = false;
  h.module.boot();
  h.observers[0].intersect(h.sliders[0]);
  assert.equal(h.assets.length, 0);
});

test("browsers without IntersectionObserver retain a working slider", async () => {
  const h = setup({ hasIO: false });
  h.module.boot();
  assert.equal(h.observers.length, 0);
  assert.equal(h.assets.length, 2);
  h.finishLoading();
  await settle();
  assert.equal(h.instances.length, 1);
});

test("a failed download can retry on a later intersection", async () => {
  const h = setup();
  h.module.boot();
  h.observers[0].intersect(h.sliders[0]);
  h.assets.find((a) => a.tag === "script").emit("error");
  await settle();
  assert.equal(h.instances.length, 0);
  assert.equal(h.errors.length, 1);
  assert.equal(h.assets.filter((a) => a.tag === "script").length, 0);
  h.observers[0].intersect(h.sliders[0]);
  h.finishLoading();
  await settle();
  assert.equal(h.instances.length, 1);
});

test("an existing Swiper script is reused", async () => {
  const h = setup();
  const script = h.createAsset("script");
  script.src = "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js";
  h.assets.push(script);
  h.module.boot();
  h.observers[0].intersect(h.sliders[0]);
  assert.equal(h.assets.filter((a) => a.tag === "script").length, 1);
  h.finishLoading();
  await settle();
  assert.equal(h.instances.length, 1);
});

test("preloaded Swiper still waits for proximity and respects reduced motion", async () => {
  const h = setup({ reduceMotion: true });
  h.installSwiper();
  h.module.boot();
  assert.equal(h.assets.length, 0);
  assert.equal(h.instances.length, 0);
  h.observers[0].intersect(h.sliders[0]);
  await settle();
  assert.equal(h.assets.filter((a) => a.tag === "script").length, 0);
  assert.equal(h.instances[0].opts.autoplay, false);
  assert.equal(h.instances[0].opts.speed, 300);
});
