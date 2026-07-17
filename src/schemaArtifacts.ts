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
import { registeredProfiles } from './profiles';
import {
  scxmlDocumentSchema,
  scxmlElementSchema,
  scxmlNodeSchema,
} from './scxmlSchema';

export interface SchemaArtifact {
  filename: string;
  content: string;
}

function registerSchemas(): void {
  z.globalRegistry.add(invokeSchema, { id: 'Invoke' });
  z.globalRegistry.add(actionSchema, { id: 'Action' });
  z.globalRegistry.add(guardSchema, { id: 'Guard' });
  z.globalRegistry.add(transitionSchema, { id: 'Transition' });
  z.globalRegistry.add(stateSchema, { id: 'State' });
  z.globalRegistry.add(metaSchema, { id: 'Meta' });
  z.globalRegistry.add(scxmlNodeSchema, { id: 'ScxmlNode' });
  z.globalRegistry.add(scxmlElementSchema, { id: 'ScxmlElement' });
}

function applyStateConstraints(schema: any): void {
  if (!schema?.properties) return;
  if (schema.properties.id) schema.properties.id.pattern = '^(?!#)';
  if (schema.properties.on?.propertyNames) {
    schema.properties.on.propertyNames.pattern =
      '^(?:\\*|[^*]+|[^.*]+(?:\\.[^.*]+)*\\.\\*)$';
  }
}

function createMachineJsonSchema(): unknown {
  const schema: any = z.toJSONSchema(machineSchema);
  applyStateConstraints(schema);
  applyStateConstraints(schema.$defs?.State);

  schema.properties.key.pattern = '^(?!#)(?!.*\\.).+$';
  schema.properties.profile = {
    description: schema.properties.profile.description,
    anyOf: [
      {
        type: 'string',
        enum: registeredProfiles.map((profile) => profile.shortName),
      },
      { type: 'string', format: 'uri' },
    ],
  };

  return schema;
}

export function createSchemaArtifacts(): SchemaArtifact[] {
  registerSchemas();
  return [
    {
      filename: 'machine.json',
      content: `${JSON.stringify(createMachineJsonSchema(), null, 2)}\n`,
    },
    {
      filename: 'scxml.json',
      content: `${JSON.stringify(z.toJSONSchema(scxmlDocumentSchema), null, 2)}\n`,
    },
  ];
}
