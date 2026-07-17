import { describe, test } from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scxmlDocumentSchema } from './scxmlSchema';

describe('SCXML examples', () => {
  test('examples validate against the SCXML schema', () => {
    const examplesDir = join(process.cwd(), 'examples', 'scxml');
    const exampleFiles = readdirSync(examplesDir).filter((file) =>
      file.endsWith('.json'),
    );

    assert.strictEqual(exampleFiles.length, 5);

    for (const file of exampleFiles) {
      const example = JSON.parse(readFileSync(join(examplesDir, file), 'utf8'));
      const result = scxmlDocumentSchema.safeParse(example);

      assert.ok(result.success, `${file} should validate`);
    }
  });
});
