import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import z from 'zod';
import {
  actionSchema,
  guardSchema,
  invokeSchema,
  machineSchema,
  metaSchema,
  stateSchema,
  transitionSchema,
} from './machineSchema';
import {
  scxmlDocumentSchema,
  scxmlElementSchema,
  scxmlNodeSchema,
} from './scxmlSchema';

// Register machine schema types
z.globalRegistry.add(invokeSchema, { id: 'Invoke' });
z.globalRegistry.add(actionSchema, { id: 'Action' });
z.globalRegistry.add(guardSchema, { id: 'Guard' });
z.globalRegistry.add(transitionSchema, { id: 'Transition' });
z.globalRegistry.add(stateSchema, { id: 'State' });
z.globalRegistry.add(metaSchema, { id: 'Meta' });
z.globalRegistry.add(scxmlNodeSchema, { id: 'ScxmlNode' });
z.globalRegistry.add(scxmlElementSchema, { id: 'ScxmlElement' });

// Generate JSON schema
const machineJsonSchema = z.toJSONSchema(machineSchema);
const scxmlJsonSchema = z.toJSONSchema(scxmlDocumentSchema);

// Ensure schemas/ directory exists
const schemasDir = join(process.cwd(), 'schemas');
mkdirSync(schemasDir, { recursive: true });

// Write schema
const machineOutputPath = join(schemasDir, 'machine.json');
writeFileSync(machineOutputPath, JSON.stringify(machineJsonSchema, null, 2));
console.log(`Machine schema: ${machineOutputPath}`);

const scxmlOutputPath = join(schemasDir, 'scxml.json');
writeFileSync(scxmlOutputPath, JSON.stringify(scxmlJsonSchema, null, 2));
console.log(`SCXML schema: ${scxmlOutputPath}`);
