const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const code = buildSync({ entryPoints: [path.resolve(__dirname, '../src/index.ts')], bundle: true, write: false, format: 'iife', define: { __BV_VERSION__: '"test-release"' } }).outputFiles[0].text;

function setup(ready) {
  const queue = [], events = [], root = { dataset: {} };
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
      addEventListener: (event) => events.push(event),
    },
    console,
  });
  return { context, queue, events, root };
}

test('bundle waits for Webflow readiness and boots once when the queue is drained', () => {
  const h = setup(false);
  vm.runInContext(code, h.context);
  assert.equal(h.queue.length, 1);
  assert.deepEqual(h.events, []);
  assert.equal(h.root.dataset.bvVersion, undefined);
  h.context.document.readyState = 'complete';
  h.queue[0]();
  assert.equal(h.root.dataset.bvVersion, 'test-release');
  const count = h.events.length;
  h.queue[0]();
  assert.equal(h.events.length, count);
});

test('bundle can arrive after Webflow readiness without reinitializing on duplicate execution', () => {
  const h = setup(true);
  vm.runInContext(code, h.context);
  assert.equal(h.root.dataset.bvVersion, 'test-release');
  const count = h.events.length;
  vm.runInContext(code, h.context);
  assert.equal(h.events.length, count);
});


test('built bundle and manifest expose the package release version', () => {
  const h = setup(true);
  const read = file => readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  const { version } = JSON.parse(read('package.json'));
  vm.runInContext(read('dist/index.js'), h.context);
  assert.equal(h.root.dataset.bvVersion, version);
  assert.deepEqual(JSON.parse(read('dist/version.json')), { version });
});
