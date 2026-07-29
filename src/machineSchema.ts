import z from 'zod';
import {
  expressionOr,
  expressionSchema,
  jsonSchemaPropertySchema,
  queryLanguageSchema,
} from './expressionSchema';
import { isRegisteredProfileName } from './profiles';

type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
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
  message:
    'Event descriptor must be exact, *, or a partial wildcard like foo.*',
});

// --- Actions ---

export const assignmentSchema = z.record(
  z.string(),
  expressionOr(jsonValueSchema),
);

export const coreAssignActionSchema = z
  .object({
    type: z.literal('core.assign'),
    assignments: assignmentSchema,
    params: jsonValueSchema.optional(),
  })
  .strict();

export const xstateAssignActionSchema = z
  .object({
    type: z.literal('@xstate.assign'),
    context: assignmentSchema,
  })
  .strict();

const eventValueSchema = z.union([
  expressionSchema,
  z.object({ type: z.string() }).catchall(jsonValueSchema),
]);

export const xstateRaiseActionSchema = z
  .object({
    type: z.literal('@xstate.raise'),
    event: eventValueSchema,
    id: z.string().optional(),
    delay: z.number().finite().optional(),
  })
  .strict();

export const xstateCancelActionSchema = z
  .object({
    type: z.literal('@xstate.cancel'),
    id: z.string(),
  })
  .strict();

export const xstateLogActionSchema = z
  .object({
    type: z.literal('@xstate.log'),
    args: z.array(jsonValueSchema),
  })
  .strict();

export const xstateEmitActionSchema = z
  .object({
    type: z.literal('@xstate.emit'),
    event: eventValueSchema,
  })
  .strict();

const profileActionSchema = z
  .object({
    type: z.string(),
    params: jsonValueSchema.optional(),
  })
  .catchall(jsonValueSchema)
  .superRefine((action, ctx) => {
    if (
      [
        'core.assign',
        '@xstate.assign',
        '@xstate.raise',
        '@xstate.cancel',
        '@xstate.log',
        '@xstate.emit',
      ].includes(action.type)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['type'],
        message: `${action.type} must satisfy its reserved action schema`,
      });
    }
  });

export const actionSchema = z.union([
  coreAssignActionSchema,
  xstateAssignActionSchema,
  xstateRaiseActionSchema,
  xstateCancelActionSchema,
  xstateLogActionSchema,
  xstateEmitActionSchema,
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

export const namedGuardSchema = z
  .object({
    type: z.string(),
    params: jsonValueSchema.optional(),
  })
  .catchall(jsonValueSchema);

export const guardSchema = z.union([namedGuardSchema, expressionSchema]);

// --- Meta ---

export const metaSchema = z.record(z.string(), jsonValueSchema);

// --- Triggers ---

export const triggerSchema = z
  .object({
    type: z.string(),
  })
  .catchall(jsonValueSchema);

export const triggersSchema = z.array(triggerSchema).optional();

// --- Transitions ---

export const transitionObjectSchema = z
  .object({
    target: z.union([z.string(), z.array(z.string())]).optional(),
    matches: z
      .record(z.string(), jsonValueSchema)
      .optional()
      .describe('Shallow event payload pattern matched before guards'),
    context: z
      .record(z.string(), expressionOr(jsonValueSchema))
      .optional()
      .describe(
        'Context assignments applied when this transition is taken. Appended as a core.assign action.',
      ),
    actions: z.array(actionSchema).optional(),
    description: z.string().optional(),
    guard: guardSchema.optional(),
    meta: metaSchema.optional(),
    input: expressionOr(jsonValueSchema)
      .optional()
      .describe('Input supplied to target states'),
    order: z.number().optional().describe('Explicit transition priority'),
    reenter: z
      .boolean()
      .optional()
      .describe('Whether this transition re-enters target states'),
  })
  .strict();

/** A transition is an object or an array of objects (for branching) */
export const transitionSchema = transitionObjectSchema;

export const transitionsSchema = z.union([
  z.array(transitionObjectSchema),
  transitionObjectSchema,
]);

// --- Retry ---

export const retrySchema = z
  .object({
    maxAttempts: z
      .number()
      .int()
      .min(1)
      .describe('Maximum number of retry attempts'),
    interval: z
      .union([z.string(), z.number()])
      .optional()
      .describe(
        'Delay between retries: ms (number) or ISO 8601 duration (string)',
      ),
    backoff: z
      .number()
      .optional()
      .describe('Backoff multiplier applied to interval after each retry'),
  })
  .strict();

// --- Invoke ---

export const invokeSchema = z
  .object({
    id: z.string().optional(),
    registryKey: z.string().optional(),
    src: z.string(),
    input: expressionOr(jsonValueSchema)
      .optional()
      .describe('Input passed to the invoked actor'),
    meta: z.record(z.string(), jsonValueSchema).optional(),
    onDone: transitionsSchema.optional(),
    onError: transitionsSchema.optional(),
    onSnapshot: transitionsSchema
      .optional()
      .describe(
        'Transitions triggered when the invoked actor emits a snapshot',
      ),
    timeout: z
      .union([z.string(), z.number().finite()])
      .optional()
      .describe('Milliseconds, delay reference, or ISO 8601 duration'),
    onTimeout: transitionsSchema
      .optional()
      .describe('Transition taken when the invocation times out'),
    heartbeat: z
      .string()
      .optional()
      .describe('ISO 8601 duration for heartbeat interval'),
    retry: retrySchema
      .optional()
      .describe('Retry policy for the invoked actor on error'),
  })
  .catchall(jsonValueSchema)
  .superRefine((invoke, ctx) => {
    if (invoke.timeout != null && invoke.onTimeout == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['onTimeout'],
        message: 'onTimeout is required when timeout is set',
      });
    }
  });

export const choiceBranchSchema = z
  .object({
    when: guardSchema.optional(),
    target: z.union([z.string(), z.array(z.string())]),
    context: z.record(z.string(), expressionOr(jsonValueSchema)).optional(),
    input: expressionOr(jsonValueSchema).optional(),
    description: z.string().optional(),
    reenter: z.boolean().optional(),
    meta: metaSchema.optional(),
  })
  .strict();

export const routeSchema = z.union([
  expressionSchema,
  z
    .object({
      description: z.string().optional(),
      reenter: z.boolean().optional(),
      meta: metaSchema.optional(),
      guard: z.string().optional(),
      input: z.record(z.string(), jsonValueSchema).optional(),
    })
    .strict(),
]);

// --- State ---

export const stateSchema = z
  .strictObject({
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
      .enum(['atomic', 'compound', 'parallel', 'history', 'final', 'choice'])
      .optional()
      .describe(
        'The state type, if not a normal (atomic or compound) state node',
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
        'Delayed transitions. Keys can be milliseconds (number as string) or ISO 8601 durations (e.g. PT30S, PT1M).',
      ),
    always: transitionsSchema
      .optional()
      .describe(
        'Eventless transitions that trigger immediately when their guard is true',
      ),
    onDone: transitionsSchema
      .optional()
      .describe('Transitions triggered when this state reaches done status'),
    onError: transitionsSchema
      .optional()
      .describe('Transitions triggered by descendant execution errors'),
    timeout: z
      .union([z.string(), z.number().finite()])
      .optional()
      .describe('Milliseconds, delay reference, or ISO 8601 duration'),
    onTimeout: transitionsSchema
      .optional()
      .describe('Transition taken when this state times out'),
    choice: z
      .array(choiceBranchSchema)
      .optional()
      .describe('Ordered branches for choice states'),
    route: routeSchema.optional().describe('Profile-defined state routing'),
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
    input: expressionOr(jsonValueSchema)
      .optional()
      .describe('Input received when this state is entered'),
    context: z
      .record(z.string(), expressionOr(jsonValueSchema))
      .optional()
      .describe('Context initialized when this state is entered'),
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
      } else if (
        !Object.prototype.hasOwnProperty.call(state.states, state.initial)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['initial'],
          message: 'Initial must reference an immediate child state key',
        });
      }
    }

    if (state.timeout != null && state.onTimeout == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['onTimeout'],
        message: 'onTimeout is required when timeout is set',
      });
    }

    if (state.type === 'choice' && state.choice == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choice'],
        message: 'Choice states must define choice branches',
      });
    }

    state.choice?.forEach((branch, index) => {
      if (branch.when == null && index !== state.choice!.length - 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['choice', index, 'when'],
          message: 'An unguarded choice fallback branch must be last',
        });
      }
    });
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
          message:
            'Event schema keys must be exact event types, not event descriptors',
        });
      }
    }
  })
  .optional();

const sourceActionSchema = z.union([actionSchema, z.array(actionSchema)]);
const sourceGuardSchema = z.object({ when: guardSchema }).strict();
const delaySourceSchema = z.union([
  z.number().finite(),
  z.string(),
  z
    .object({
      duration: z.union([z.number().finite(), z.string()]),
    })
    .strict(),
]);

type DiagnosticPath = Array<string | number>;

export interface MachineDiagnostic {
  code: string;
  message: string;
  path: DiagnosticPath;
}

function walkStateTree(
  state: any,
  canonicalId: string,
  path: DiagnosticPath,
  visit: (state: any, canonicalId: string, path: DiagnosticPath) => void,
): void {
  visit(state, canonicalId, path);
  for (const [key, child] of Object.entries(state.states ?? {})) {
    walkStateTree(
      child,
      `${canonicalId}.${key}`,
      [...path, 'states', key],
      visit,
    );
  }
}

function addGlobalIdIssues(machine: any, ctx: z.RefinementCtx): void {
  const canonicalIds = new Set<string>();
  const explicitIds = new Map<string, DiagnosticPath>();

  walkStateTree(machine, machine.key, [], (_state, canonicalId) => {
    canonicalIds.add(canonicalId);
  });

  walkStateTree(machine, machine.key, [], (state, _canonicalId, path) => {
    if (state.id == null) return;

    if (explicitIds.has(state.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'id'],
        message: `Explicit state ID "${state.id}" must be globally unique`,
      });
    } else {
      explicitIds.set(state.id, [...path, 'id']);
    }

    if (canonicalIds.has(state.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'id'],
        message: `Explicit state ID "${state.id}" collides with a canonical path ID`,
      });
    }
  });
}

function collectWarnings(machine: any): MachineDiagnostic[] {
  const warnings: MachineDiagnostic[] = [];

  const collectTransitionWarnings = (
    transitions: any,
    path: DiagnosticPath,
  ): void => {
    const values = Array.isArray(transitions) ? transitions : [transitions];
    values.forEach((transition, index) => {
      if (transition?.reenter === true && transition.target == null) {
        warnings.push({
          code: 'transition.targetlessReenter',
          message: 'reenter has no effect on a targetless transition',
          path: [
            ...path,
            ...(Array.isArray(transitions) ? [index] : []),
            'reenter',
          ],
        });
      }
    });
  };

  walkStateTree(machine, machine.key, [], (state, _canonicalId, path) => {
    if (state.type === 'parallel' && state.initial != null) {
      warnings.push({
        code: 'parallel.initial',
        message: 'An initial field on a parallel state is vestigial',
        path: [...path, 'initial'],
      });
    }

    if (
      state.type === 'final' &&
      ['on', 'after', 'always', 'onDone', 'onError', 'onTimeout'].some(
        (key) => state[key] != null,
      )
    ) {
      warnings.push({
        code: 'final.transitions',
        message: 'Transition fields on a final state may be ignored',
        path,
      });
    }

    if (
      state.type === 'history' &&
      [
        'initial',
        'states',
        'on',
        'after',
        'always',
        'onDone',
        'onError',
        'onTimeout',
        'entry',
        'exit',
        'invoke',
      ].some((key) => state[key] != null)
    ) {
      warnings.push({
        code: 'history.vestigialFields',
        message: 'This history state contains fields that runtimes may ignore',
        path,
      });
    }

    for (const [event, transitions] of Object.entries(state.on ?? {})) {
      collectTransitionWarnings(transitions, [...path, 'on', event]);
    }
    for (const [delay, transitions] of Object.entries(state.after ?? {})) {
      collectTransitionWarnings(transitions, [...path, 'after', delay]);
    }
    for (const key of ['always', 'onDone', 'onError', 'onTimeout'] as const) {
      if (state[key] != null) {
        collectTransitionWarnings(state[key], [...path, key]);
      }
    }
    for (const [index, invoke] of (state.invoke ?? []).entries()) {
      for (const key of [
        'onDone',
        'onError',
        'onSnapshot',
        'onTimeout',
      ] as const) {
        if (invoke[key] != null) {
          collectTransitionWarnings(invoke[key], [
            ...path,
            'invoke',
            index,
            key,
          ]);
        }
      }
    }
  });

  return warnings;
}

export const machineSchema = stateSchema
  .safeExtend({
    key: z
      .string()
      .min(1)
      .refine((value) => !value.includes('.') && !value.startsWith('#'), {
        message: 'Machine key must not contain . or start with #',
      })
      .describe('The root machine key used as the canonical path root'),
    version: z.string().optional().describe('The machine version'),
    profile: profileSchema
      .optional()
      .describe('Execution profile short name or URI'),
    queryLanguage: queryLanguageSchema,
    context: z
      .record(z.string(), jsonValueSchema)
      .optional()
      .describe('Initial context values'),
    triggers: triggersSchema.describe(
      'Optional machine-level trigger metadata for runtimes and workflow hosts',
    ),
    schemas: schemasSchema,
    actions: z
      .record(z.string(), sourceActionSchema)
      .optional()
      .describe('Declarative named action definitions'),
    guards: z
      .record(z.string(), sourceGuardSchema)
      .optional()
      .describe('Declarative named guard definitions'),
    actors: z
      .record(z.string(), jsonValueSchema)
      .optional()
      .describe('Profile-defined serializable actor definitions'),
    delays: z
      .record(z.string(), delaySourceSchema)
      .optional()
      .describe('Named delay definitions'),
  })
  .strict()
  .superRefine(addGlobalIdIssues);

export type StateMachine = z.infer<typeof machineSchema>;

export type MachineValidationResult =
  | {
      success: true;
      data: StateMachine;
      errors: [];
      warnings: MachineDiagnostic[];
    }
  | {
      success: false;
      data?: undefined;
      errors: MachineDiagnostic[];
      warnings: [];
    };

export function validateMachine(input: unknown): MachineValidationResult {
  const result = machineSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => ({
        code: `schema.${issue.code}`,
        message: issue.message,
        path: issue.path.map((segment) =>
          typeof segment === 'symbol' ? String(segment) : segment,
        ),
      })),
      warnings: [],
    };
  }

  return {
    success: true,
    data: result.data,
    errors: [],
    warnings: collectWarnings(result.data),
  };
}
