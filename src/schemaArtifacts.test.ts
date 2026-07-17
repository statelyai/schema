import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSchemaArtifacts } from './schemaArtifacts';

const machineSchema = JSON.parse(
  createSchemaArtifacts().find(
    (artifact) => artifact.filename === 'machine.json',
  )!.content,
);

test('generated schema preserves machine key and profile constraints', () => {
  const keyPattern = new RegExp(machineSchema.properties.key.pattern);
  assert.strictEqual(keyPattern.test('machine'), true);
  assert.strictEqual(keyPattern.test('foo.bar'), false);
  assert.strictEqual(keyPattern.test('#machine'), false);

  assert.deepStrictEqual(machineSchema.properties.profile.anyOf[0].enum, [
    'xstate',
    'serverlessworkflow',
    'scxml',
  ]);
  assert.strictEqual(machineSchema.properties.profile.anyOf[1].format, 'uri');
});

test('generated schema preserves state ID and event descriptor constraints', () => {
  const idPattern = new RegExp(machineSchema.$defs.State.properties.id.pattern);
  assert.strictEqual(idPattern.test('alias'), true);
  assert.strictEqual(idPattern.test('#alias'), false);

  const descriptorPattern = new RegExp(
    machineSchema.$defs.State.properties.on.propertyNames.pattern,
  );
  assert.strictEqual(descriptorPattern.test('feedback.good'), true);
  assert.strictEqual(descriptorPattern.test('feedback.*'), true);
  assert.strictEqual(descriptorPattern.test('mouse*'), false);
  assert.strictEqual(descriptorPattern.test('mouse.*.click'), false);
});
