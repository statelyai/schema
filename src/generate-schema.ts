import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'path';
import { createSchemaArtifacts } from './schemaArtifacts';

// Ensure schemas/ directory exists
const schemasDir = join(process.cwd(), 'schemas');
mkdirSync(schemasDir, { recursive: true });

for (const artifact of createSchemaArtifacts()) {
  const outputPath = join(schemasDir, artifact.filename);
  writeFileSync(outputPath, artifact.content);
  console.log(`${artifact.filename}: ${outputPath}`);
}
