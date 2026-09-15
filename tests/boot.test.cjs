const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const code = buildSync({ entryPoints: [path.resolve(__dirname, '../src/index.ts')], bundle: true, write: false, format: 'iife', define: { __BV_VERSION__: '"test-release"' } }).outputFiles[0].text;

function setup(ready) {
  const queue = [], events = [], errors = [], listeners = new Map(), root = { dataset: {} };
  const context = vm.createContext({
    window: {
      Webflow: ready ? { push(fn) { fn(); } } : queue,
      matchMedia: () => ({ matches: false }),
      addEventListener: (event) => events.push(event),
    },
    document: {
      readyState: ready ? 'complete' : 'loading',
      documentElement: root,
      querySelectorAll: () => [],
      addEventListener: (event, callback) => { events.push(event); listeners.set(event, callback); },
    },
    console: { ...console, error: (...args) => errors.push(args) },
  });
  return { context, queue, events, errors, listeners, root };
}

test('bundle waits for Webflow readiness and boots once when the queue is drained', () => {
  const h = setup(false);
  vm.runInContext(code, h.context);
  assert.equal(h.queue.length, 1);
  assert.deepEqual(h.events, ['DOMContentLoaded']);
  assert.equal(h.context.window.__bvLazyVideosStarted, true);
  h.listeners.get('DOMContentLoaded')();
  // Lazy videos can start before Webflow without starting the other features.
  assert.equal(h.root.dataset.bvVersion, undefined);
  h.context.document.readyState = 'complete';
  h.queue[0]();
  assert.equal(h.root.dataset.bvVersion, 'test-release');
  const count = h.events.length;
  h.queue[0]();
  assert.equal(h.events.length, count);
  assert.deepEqual(h.errors, []);
});

test('bundle can arrive after Webflow readiness without reinitializing on duplicate execution', () => {
  const h = setup(true);
  vm.runInContext(code, h.context);
  assert.equal(h.root.dataset.bvVersion, 'test-release');
  const count = h.events.length;
  vm.runInContext(code, h.context);
  assert.equal(h.events.length, count);
  assert.deepEqual(h.errors, []);
});

test('a failed feature logs once and later features still initialize', () => {
  const h = setup(true);
  h.context.window.Lenis = function () { throw new Error('Lenis unavailable'); };
  h.context.window.jQuery = () => ({ on: (event, selector) => h.events.push(selector) });
  vm.runInContext(code, h.context);
  assert.equal(h.errors.length, 1);
  assert.equal(h.errors[0][0], '[bv] Lenis failed');
  assert.equal(h.errors[0][1].message, 'Lenis unavailable');
  assert.ok(h.events.includes('click'), 'ReadMore still registers its click handler');
  assert.ok(h.events.includes('.js-close-dropdown'), 'DropdownClose still initializes');
  assert.equal(h.root.dataset.bvVersion, 'test-release');
  vm.runInContext(code, h.context);
  assert.equal(h.errors.length, 1, 'duplicate execution does not retry partially initialized features');
});


test('built bundle and manifest expose the package release version', () => {
  const h = setup(true);
  const read = file => readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  const { version } = JSON.parse(read('package.json'));
  vm.runInContext(read('dist/index.js'), h.context);
  assert.equal(h.root.dataset.bvVersion, version);
  assert.deepEqual(JSON.parse(read('dist/version.json')), { version });
  assert.deepEqual(h.errors, []);
});
