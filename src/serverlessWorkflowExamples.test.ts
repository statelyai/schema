import { describe, test } from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { machineSchema } from './machineSchema';
import { convertSpecToConfig } from './index';

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

  test('converted examples are not executable by the built-in xstate converter', () => {
    const examplesDir = join(process.cwd(), 'examples', 'serverlessworkflow');
    const exampleFiles = readdirSync(examplesDir).filter((file) =>
      file.endsWith('.json')
    );

    for (const file of exampleFiles) {
      const example = JSON.parse(
        readFileSync(join(examplesDir, file), 'utf8')
      );

      assert.throws(
        () => convertSpecToConfig(example),
        /only supports machines with no profile or the xstate profile/i,
        `${file} should be rejected by the built-in xstate converter`
      );
    }
  });
});
