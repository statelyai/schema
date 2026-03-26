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

// Register machine schema types
z.globalRegistry.add(invokeSchema, { id: 'Invoke' });
z.globalRegistry.add(actionSchema, { id: 'Action' });
z.globalRegistry.add(guardSchema, { id: 'Guard' });
z.globalRegistry.add(transitionSchema, { id: 'Transition' });
z.globalRegistry.add(stateSchema, { id: 'State' });
z.globalRegistry.add(metaSchema, { id: 'Meta' });

// Generate JSON schema
const machineJsonSchema = z.toJSONSchema(machineSchema);

// Ensure schemas/ directory exists
const schemasDir = join(process.cwd(), 'schemas');
mkdirSync(schemasDir, { recursive: true });

// Write schema
const machineOutputPath = join(schemasDir, 'machine.json');
writeFileSync(machineOutputPath, JSON.stringify(machineJsonSchema, null, 2));
console.log(`Machine schema: ${machineOutputPath}`);
