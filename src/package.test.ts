import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

test('package exposes evaluator entrypoints and ships specification docs', () => {
  assert.ok(packageJson.exports['./jmespath']);
  assert.ok(packageJson.exports['./jsonata']);
  assert.ok(packageJson.exports['./jsonpath']);
  assert.ok(packageJson.files.includes('profiles'));
  assert.ok(packageJson.files.includes('spec.md'));
});

test('eagerly imported evaluators are regular dependencies', () => {
  assert.ok(packageJson.dependencies.jmespath);
  assert.ok(packageJson.dependencies['jsonpath-plus']);
  assert.strictEqual(packageJson.peerDependencies?.jmespath, undefined);
  assert.strictEqual(
    packageJson.peerDependencies?.['jsonpath-plus'],
    undefined,
  );
});
