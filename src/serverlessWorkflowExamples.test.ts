import { describe, test } from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { machineSchema } from './machineSchema';

describe('Serverless Workflow examples', () => {
  test('converted examples validate against the machine schema', () => {
    const examplesDir = join(process.cwd(), 'examples', 'serverlessworkflow');
    const exampleFiles = readdirSync(examplesDir).filter((file) =>
      file.endsWith('.json')
    );

    assert.strictEqual(exampleFiles.length, 66);

    for (const file of exampleFiles) {
      const example = JSON.parse(
        readFileSync(join(examplesDir, file), 'utf8')
      );
      const result = machineSchema.safeParse(example);

      assert.ok(result.success, `${file} should validate`);
    }
  });
});
