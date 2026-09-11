import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const baseline = JSON.parse(await readFile('migration/baseline.json', 'utf8'));
const { version } = JSON.parse(await readFile('package.json', 'utf8'));

// Preserve this record after migration. Intentional feature changes need a
// new runtime version; they must not silently alter the migration release.
if (version !== baseline.migrationVersion) {
  console.log(`Migration release is ${baseline.migrationVersion}; ${version} is a later feature release. Original source baseline retained for comparison.`);
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
  let contents = await readFile(file);
  // The org starts at 1.0.0 while the archived source was 1.1.0. Normalize
  // only the two release metadata fields; every other byte must still match.
  if (file === 'dist/index.js') {
    const assignment = `.dataset.bvVersion=${JSON.stringify(version)}`;
    const text = contents.toString('utf8');
    assert.equal(text.split(assignment).length, 2, 'Expected exactly one current runtime version assignment');
    contents = Buffer.from(text.replace(assignment, `.dataset.bvVersion=${JSON.stringify(baseline.runtimeVersion)}`));
  } else if (file === 'dist/version.json') {
    assert.equal(contents.toString('utf8'), JSON.stringify({ version }) + '\n', 'Version manifest must match package.json');
    contents = Buffer.from(JSON.stringify({ version: baseline.runtimeVersion }) + '\n');
  }
  assert.equal(contents.length, expected.bytes, `${file}: byte count changed`);
  assert.equal(createHash('sha256').update(contents).digest('hex'), expected.sha256, `${file}: differs from the original served release`);
  console.log(`${file}: matches original CDN asset after release-metadata normalization (${contents.length} bytes)`);
}
