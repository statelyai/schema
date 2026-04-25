import z from 'zod';
import {
  expressionOr,
  expressionSchema,
  jsonSchemaPropertySchema,
  queryLanguageSchema,
} from './expressionSchema';
import { isRegisteredProfileName } from './profiles';

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

function isUri(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export const profileSchema = z
  .string()
  .refine((value) => isRegisteredProfileName(value) || isUri(value), {
    message: 'Profile must be a registered profile name or URI',
  });

function isValidEventDescriptor(value: string): boolean {
  if (value === '') return false;
  if (!value.includes('*')) return true;
  if (value === '*') return true;
  if (!value.endsWith('.*')) return false;
  if (value.indexOf('*') !== value.length - 1) return false;

  const prefix = value.slice(0, -2);
  if (prefix === '') return false;

  return prefix.split('.').every((segment) => segment !== '');
}

export const eventDescriptorSchema = z.string().refine(isValidEventDescriptor, {
  message: 'Event descriptor must be exact, *, or a partial wildcard like foo.*',
});

// --- Actions ---

export const assignmentSchema = z.record(
  z.string(),
  expressionOr(jsonValueSchema)
);

export const coreAssignActionSchema = z
  .object({
    type: z.literal('core.assign'),
    assignments: assignmentSchema,
    params: jsonValueSchema.optional(),
  })
  .strict();

const profileActionSchema = z
  .object({
    type: z.string(),
    params: jsonValueSchema.optional(),
  })
  .catchall(jsonValueSchema)
  .superRefine((action, ctx) => {
    if (action.type === 'core.assign') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type'],
        message: 'core.assign must satisfy the core assign action schema',
      });
    }
  });

export const actionSchema = z.union([
  coreAssignActionSchema,
  profileActionSchema,
]);

// Backward-compatible aliases for consumers that imported the previous
// profile-specific schemas.
export const assignActionSchema = coreAssignActionSchema;
export const raiseActionSchema = actionSchema;
export const sendToActionSchema = actionSchema;
export const logActionSchema = actionSchema;
export const emitActionSchema = actionSchema;
export const customActionSchema = actionSchema;

// --- Guards ---

export const namedGuardSchema = z.object({
  type: z.string(),
  params: jsonValueSchema.optional(),
}).catchall(jsonValueSchema);

export const guardSchema = z.union([namedGuardSchema, expressionSchema]);

// --- Meta ---

export const metaSchema = z.record(z.string(), jsonValueSchema);

// --- Transitions ---

export const transitionObjectSchema = z.object({
  target: z.union([z.string(), z.array(z.string())]).optional(),
  context: z
    .record(z.string(), expressionOr(jsonValueSchema))
    .optional()
    .describe(
      'Context assignments applied when this transition is taken. Appended as a core.assign action.'
    ),
  actions: z.array(actionSchema).optional(),
  description: z.string().optional(),
  guard: guardSchema.optional(),
  meta: metaSchema.optional(),
  order: z.number().optional().describe('Explicit transition priority'),
  reenter: z.boolean().optional().describe('Whether this transition re-enters target states'),
}).strict();

/** A transition is an object or an array of objects (for branching) */
export const transitionSchema = transitionObjectSchema;

export const transitionsSchema = z.union([
  z.array(transitionObjectSchema),
  transitionObjectSchema,
]);

// --- Retry ---

export const retrySchema = z.object({
  maxAttempts: z
    .number()
    .int()
    .min(1)
    .describe('Maximum number of retry attempts'),
  interval: z
    .union([z.string(), z.number()])
    .optional()
    .describe('Delay between retries: ms (number) or ISO 8601 duration (string)'),
  backoff: z
    .number()
    .optional()
    .describe('Backoff multiplier applied to interval after each retry'),
}).strict();

// --- Invoke ---

export const invokeSchema = z.object({
  id: z.string().optional(),
  src: z.string(),
  input: expressionOr(jsonValueSchema).optional().describe('Input passed to the invoked actor'),
  meta: z.record(z.string(), jsonValueSchema).optional(),
  onDone: transitionsSchema.optional(),
  onError: transitionsSchema.optional(),
  onSnapshot: transitionsSchema
    .optional()
    .describe('Transitions triggered when the invoked actor emits a snapshot'),
  timeout: z
    .string()
    .optional()
    .describe('ISO 8601 duration for invocation timeout'),
  heartbeat: z
    .string()
    .optional()
    .describe('ISO 8601 duration for heartbeat interval'),
  retry: retrySchema
    .optional()
    .describe('Retry policy for the invoked actor on error'),
}).catchall(jsonValueSchema);

// --- State ---

export const stateSchema = z.strictObject({
  id: z
    .string()
    .refine((value) => !value.startsWith('#'), {
      message: 'State IDs must not start with #',
    })
    .optional()
    .describe('The state node ID'),
  description: z
    .string()
    .optional()
    .describe('The text description of this state node'),
  type: z
    .union([z.literal('parallel'), z.literal('history'), z.literal('final')])
    .optional()
    .describe(
      'The state type, if not a normal (atomic or compound) state node'
    ),
  target: z
    .string()
    .optional()
    .describe('The target state for history states'),
  history: z
    .enum(['shallow', 'deep'])
    .optional()
    .describe('The history type for history states'),
  entry: z.array(actionSchema).optional().describe('The entry actions'),
  exit: z.array(actionSchema).optional().describe('The exit actions'),
  initial: z.string().optional().describe('The initial child state'),
  on: z
    .record(eventDescriptorSchema, transitionsSchema)
    .optional()
    .describe('The transitions'),
  after: z
    .record(z.string(), transitionsSchema)
    .optional()
    .describe(
      'Delayed transitions. Keys can be milliseconds (number as string) or ISO 8601 durations (e.g. PT30S, PT1M).'
    ),
  always: transitionsSchema
    .optional()
    .describe(
      'Eventless transitions that trigger immediately when their guard is true'
    ),
  onDone: transitionsSchema
    .optional()
    .describe('Transitions triggered when this state reaches done status'),
  invoke: z
    .array(invokeSchema)
    .optional()
    .describe('Invoked actors spawned when the state is entered'),
  tags: z
    .array(z.string())
    .optional()
    .describe('Tags for categorizing this state'),
  output: expressionOr(jsonValueSchema)
    .optional()
    .describe('Output data for final states'),
  meta: metaSchema.optional().describe('The metadata for this state node'),
  get states() {
    return z
      .record(z.string(), stateSchema)
      .optional()
      .describe('The child states');
  },
})
  .superRefine((state, ctx) => {
    if (state.initial != null) {
      if (!state.states) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['states'],
          message: 'States with an initial child must define states',
        });
      } else if (!Object.prototype.hasOwnProperty.call(state.states, state.initial)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['initial'],
          message: 'Initial must reference an immediate child state key',
        });
      }
    }
  });

// --- Machine (root) ---

export const schemasSchema = z
  .object({
    input: jsonSchemaPropertySchema
      .optional()
      .describe('JSON Schema for machine input'),
    context: z
      .record(z.string(), jsonSchemaPropertySchema)
      .optional()
      .describe('JSON Schema definitions for each context property'),
    events: z
      .record(z.string(), jsonSchemaPropertySchema)
      .optional()
      .describe('JSON Schema definitions for each event payload by event type'),
    output: jsonSchemaPropertySchema
      .optional()
      .describe('JSON Schema for machine output'),
  })
  .strict()
  .superRefine((schemas, ctx) => {
    if (!schemas.events) return;

    for (const key of Object.keys(schemas.events)) {
      if (key === '*' || key.includes('*')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['events', key],
          message: 'Event schema keys must be exact event types, not event descriptors',
        });
      }
    }
  })
  .optional();

export const machineSchema = stateSchema.safeExtend({
  key: z
    .string()
    .min(1)
    .refine((value) => !value.includes('.') && !value.startsWith('#'), {
      message: 'Machine key must not contain . or start with #',
    })
    .describe('The root machine key used as the canonical path root'),
  version: z.string().optional().describe('The machine version'),
  profile: profileSchema.optional().describe('Execution profile short name or URI'),
  queryLanguage: queryLanguageSchema,
  context: z
    .record(z.string(), jsonValueSchema)
    .optional()
    .describe('Initial context values'),
  schemas: schemasSchema,
}).strict();

export type StateMachine = z.infer<typeof machineSchema>;
