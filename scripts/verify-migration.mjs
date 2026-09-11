import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const baseline = JSON.parse(await readFile('migration/baseline.json', 'utf8'));
const { version } = JSON.parse(await readFile('package.json', 'utf8'));

// Preserve this record after migration. Intentional feature changes need a
// new runtime version; they must not silently alter the migration release.
if (version !== baseline.runtimeVersion) {
  console.log(`Migration baseline is ${baseline.runtimeVersion}; ${version} is a later feature release. Baseline retained for comparison.`);
  process.exit(0);
}

assert.equal(
  createHash('sha256').update(await readFile(baseline.publishedBootstrap.file)).digest('hex'),
  baseline.publishedBootstrap.sha256,
  'Original published bootstrap changed',
);

for (const [file, expected] of Object.entries(baseline.sourceFiles)) {
  const actual = createHash('sha256').update(await readFile(file)).digest('hex');
  assert.equal(actual, expected, `${file}: source behavior changed during migration`);
}
for (const [file, expected] of Object.entries(baseline.assets)) {
  const contents = await readFile(file);
  assert.equal(contents.length, expected.bytes, `${file}: byte count changed`);
  assert.equal(createHash('sha256').update(contents).digest('hex'), expected.sha256, `${file}: differs from the original served release`);
  console.log(`${file}: identical to the original CDN asset (${contents.length} bytes)`);
}
