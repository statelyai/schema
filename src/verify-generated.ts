import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSchemaArtifacts } from './schemaArtifacts';

const schemasDir = join(process.cwd(), 'schemas');
const stale: string[] = [];

for (const artifact of createSchemaArtifacts()) {
  const actual = readFileSync(join(schemasDir, artifact.filename), 'utf8');
  if (actual !== artifact.content) stale.push(artifact.filename);
}

if (stale.length) {
  throw new Error(
    `Generated schemas are stale: ${stale.join(', ')}. Run pnpm generate-schema.`,
  );
}

console.log('Generated schemas are current.');
