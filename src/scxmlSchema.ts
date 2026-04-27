import z from 'zod';
import { SCXML_PROFILE_SHORT_NAME } from './profiles';

export const SCXML_NAMESPACE = 'http://www.w3.org/2005/07/scxml';

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);

const expressionSchema = z
  .string()
  .describe('SCXML data-model expression string');

const locationExpressionSchema = z
  .string()
  .describe('SCXML data-model location expression string');

const eventDescriptorListSchema = z
  .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
  .describe('SCXML event descriptor list');

const stateReferenceListSchema = z
  .union([z.string().min(1), z.array(z.string().min(1)).min(1)])
  .describe('SCXML legal state specification');

const extensionFieldsSchema = z
  .record(z.string(), jsonValueSchema)
  .describe('JSON-valued extension fields for custom processors');

function requireExactlyOne(
  object: Record<string, unknown>,
  keys: string[],
  ctx: z.RefinementCtx
) {
  const present = keys.filter((key) => object[key] != null);

  if (present.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Exactly one of ${keys.join(', ')} must be present`,
    });
  }
}

function requireAtMostOne(
  object: Record<string, unknown>,
  keys: string[],
  ctx: z.RefinementCtx
) {
  const present = keys.filter((key) => object[key] != null);

  if (present.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `At most one of ${keys.join(', ')} may be present`,
    });
  }
}

type ScxmlStateNode =
  | z.infer<typeof scxmlStateSchema>
  | z.infer<typeof scxmlParallelSchema>
  | z.infer<typeof scxmlFinalSchema>
  | z.infer<typeof scxmlHistorySchema>;

type ScxmlExecutableContent =
  | z.infer<typeof scxmlRaiseSchema>
  | z.infer<typeof scxmlIfSchema>
  | z.infer<typeof scxmlForeachSchema>
  | z.infer<typeof scxmlLogSchema>
  | z.infer<typeof scxmlAssignSchema>
  | z.infer<typeof scxmlScriptSchema>
  | z.infer<typeof scxmlSendSchema>
  | z.infer<typeof scxmlCancelSchema>
  | z.infer<typeof scxmlCustomActionSchema>;

export const scxmlDataSchema = z
  .strictObject({
    kind: z.literal('data'),
    id: z.string(),
    src: z.string().optional(),
    expr: expressionSchema.optional(),
    value: jsonValueSchema.optional(),
    extensions: extensionFieldsSchema.optional(),
  })
  .superRefine((data, ctx) => {
    requireAtMostOne(data, ['src', 'expr', 'value'], ctx);
  });

export const scxmlDatamodelSchema = z.strictObject({
  kind: z.literal('datamodel'),
  data: z.array(scxmlDataSchema).optional(),
  extensions: extensionFieldsSchema.optional(),
});

export const scxmlContentSchema = z
  .strictObject({
    kind: z.literal('content'),
    expr: expressionSchema.optional(),
    value: jsonValueSchema.optional(),
    raw: z.string().optional(),
    extensions: extensionFieldsSchema.optional(),
  })
  .superRefine((content, ctx) => {
    requireAtMostOne(content, ['expr', 'value', 'raw'], ctx);
  });

export const scxmlParamSchema = z
  .strictObject({
    kind: z.literal('param'),
    name: z.string(),
    expr: expressionSchema.optional(),
    location: locationExpressionSchema.optional(),
    extensions: extensionFieldsSchema.optional(),
  })
  .superRefine((param, ctx) => {
    requireExactlyOne(param, ['expr', 'location'], ctx);
  });

export const scxmlDonedataSchema = z.strictObject({
  kind: z.literal('donedata'),
  content: scxmlContentSchema.optional(),
  params: z.array(scxmlParamSchema).optional(),
  extensions: extensionFieldsSchema.optional(),
});

export const scxmlRaiseSchema = z.strictObject({
  kind: z.literal('raise'),
  event: z.string(),
  extensions: extensionFieldsSchema.optional(),
});

export const scxmlIfSchema: z.ZodType<{
  kind: 'if';
  cond: string;
  then?: ScxmlExecutableContent[];
  elseifs?: { cond: string; actions?: ScxmlExecutableContent[] }[];
  else?: ScxmlExecutableContent[];
  extensions?: Record<string, JsonValue>;
}> = z.strictObject({
  kind: z.literal('if'),
  cond: expressionSchema,
  get then() {
    return z.array(scxmlExecutableContentSchema).optional();
  },
  elseifs: z
    .array(
      z.strictObject({
        cond: expressionSchema,
        get actions() {
          return z.array(scxmlExecutableContentSchema).optional();
        },
      })
    )
    .optional(),
  get else() {
    return z.array(scxmlExecutableContentSchema).optional();
  },
  extensions: extensionFieldsSchema.optional(),
});

export const scxmlForeachSchema: z.ZodType<{
  kind: 'foreach';
  array: string;
  item: string;
  index?: string;
  actions?: ScxmlExecutableContent[];
  extensions?: Record<string, JsonValue>;
}> = z.strictObject({
  kind: z.literal('foreach'),
  array: expressionSchema,
  item: z.string(),
  index: z.string().optional(),
  get actions() {
    return z.array(scxmlExecutableContentSchema).optional();
  },
  extensions: extensionFieldsSchema.optional(),
});

export const scxmlLogSchema = z.strictObject({
  kind: z.literal('log'),
  label: z.string().optional(),
  expr: expressionSchema.optional(),
  extensions: extensionFieldsSchema.optional(),
});

export const scxmlAssignSchema = z.strictObject({
  kind: z.literal('assign'),
  location: locationExpressionSchema,
  expr: expressionSchema.optional(),
  value: jsonValueSchema.optional(),
  extensions: extensionFieldsSchema.optional(),
});

export const scxmlScriptSchema = z
  .strictObject({
    kind: z.literal('script'),
    src: z.string().optional(),
    content: z.string().optional(),
    extensions: extensionFieldsSchema.optional(),
  })
  .superRefine((script, ctx) => {
    requireAtMostOne(script, ['src', 'content'], ctx);
  });

export const scxmlSendSchema = z
  .strictObject({
    kind: z.literal('send'),
    event: z.string().optional(),
    eventexpr: expressionSchema.optional(),
    target: z.string().optional(),
    targetexpr: expressionSchema.optional(),
    type: z.string().optional(),
    typeexpr: expressionSchema.optional(),
    id: z.string().optional(),
    idlocation: locationExpressionSchema.optional(),
    delay: z.string().optional(),
    delayexpr: expressionSchema.optional(),
    namelist: z.array(z.string()).optional(),
    params: z.array(scxmlParamSchema).optional(),
    content: scxmlContentSchema.optional(),
    extensions: extensionFieldsSchema.optional(),
  })
  .superRefine((send, ctx) => {
    requireAtMostOne(send, ['event', 'eventexpr'], ctx);
    requireAtMostOne(send, ['target', 'targetexpr'], ctx);
    requireAtMostOne(send, ['type', 'typeexpr'], ctx);
    requireAtMostOne(send, ['id', 'idlocation'], ctx);
    requireAtMostOne(send, ['delay', 'delayexpr'], ctx);
  });

export const scxmlCancelSchema = z
  .strictObject({
    kind: z.literal('cancel'),
    sendid: z.string().optional(),
    sendidexpr: expressionSchema.optional(),
    extensions: extensionFieldsSchema.optional(),
  })
  .superRefine((cancel, ctx) => {
    requireExactlyOne(cancel, ['sendid', 'sendidexpr'], ctx);
  });

export const scxmlCustomActionSchema = z.strictObject({
  kind: z.literal('customAction'),
  name: z.string(),
  namespace: z.string().optional(),
  data: jsonValueSchema.optional(),
  extensions: extensionFieldsSchema.optional(),
});

export const scxmlExecutableContentSchema: z.ZodType<ScxmlExecutableContent> =
  z.lazy(() =>
    z.union([
      scxmlRaiseSchema,
      scxmlIfSchema,
      scxmlForeachSchema,
      scxmlLogSchema,
      scxmlAssignSchema,
      scxmlScriptSchema,
      scxmlSendSchema,
      scxmlCancelSchema,
      scxmlCustomActionSchema,
    ])
  );

export const scxmlTransitionSchema = z.strictObject({
  kind: z.literal('transition'),
  event: eventDescriptorListSchema.optional(),
  cond: expressionSchema.optional(),
  target: stateReferenceListSchema.optional(),
  type: z.enum(['internal', 'external']).optional(),
  actions: z.array(scxmlExecutableContentSchema).optional(),
  extensions: extensionFieldsSchema.optional(),
});

export const scxmlInitialSchema = z.strictObject({
  kind: z.literal('initial'),
  transition: scxmlTransitionSchema,
  extensions: extensionFieldsSchema.optional(),
});

export const scxmlFinalizeSchema = z.strictObject({
  kind: z.literal('finalize'),
  actions: z.array(scxmlExecutableContentSchema).optional(),
  extensions: extensionFieldsSchema.optional(),
});

export const scxmlInvokeSchema = z
  .strictObject({
    kind: z.literal('invoke'),
    type: z.string().optional(),
    typeexpr: expressionSchema.optional(),
    src: z.string().optional(),
    srcexpr: expressionSchema.optional(),
    id: z.string().optional(),
    idlocation: locationExpressionSchema.optional(),
    namelist: z.array(z.string()).optional(),
    autoforward: z.boolean().optional(),
    params: z.array(scxmlParamSchema).optional(),
    content: scxmlContentSchema.optional(),
    finalize: scxmlFinalizeSchema.optional(),
    extensions: extensionFieldsSchema.optional(),
  })
  .superRefine((invoke, ctx) => {
    requireAtMostOne(invoke, ['type', 'typeexpr'], ctx);
    requireAtMostOne(invoke, ['src', 'srcexpr'], ctx);
    requireAtMostOne(invoke, ['id', 'idlocation'], ctx);
  });

const stateNodeBaseSchema = {
  id: z.string().optional(),
  order: z.number().optional(),
  datamodel: scxmlDatamodelSchema.optional(),
  onEntry: z.array(scxmlExecutableContentSchema).optional(),
  onExit: z.array(scxmlExecutableContentSchema).optional(),
  initial: stateReferenceListSchema.optional(),
  initialTransition: scxmlInitialSchema.optional(),
  transitions: z.array(scxmlTransitionSchema).optional(),
  invokes: z.array(scxmlInvokeSchema).optional(),
  extensions: extensionFieldsSchema.optional(),
};

export const scxmlStateSchema: z.ZodType<{
  kind: 'state';
  id?: string;
  datamodel?: z.infer<typeof scxmlDatamodelSchema>;
  onEntry?: ScxmlExecutableContent[];
  onExit?: ScxmlExecutableContent[];
  initial?: string | string[];
  initialTransition?: z.infer<typeof scxmlInitialSchema>;
  transitions?: z.infer<typeof scxmlTransitionSchema>[];
  invokes?: z.infer<typeof scxmlInvokeSchema>[];
  states?: Record<string, ScxmlStateNode>;
  order?: number;
  extensions?: Record<string, JsonValue>;
}> = z.strictObject({
  kind: z.literal('state'),
  ...stateNodeBaseSchema,
  get states() {
    return z.record(z.string(), scxmlStateNodeSchema).optional();
  },
});

export const scxmlParallelSchema: z.ZodType<{
  kind: 'parallel';
  id?: string;
  datamodel?: z.infer<typeof scxmlDatamodelSchema>;
  onEntry?: ScxmlExecutableContent[];
  onExit?: ScxmlExecutableContent[];
  transitions?: z.infer<typeof scxmlTransitionSchema>[];
  invokes?: z.infer<typeof scxmlInvokeSchema>[];
  states?: Record<string, ScxmlStateNode>;
  order?: number;
  extensions?: Record<string, JsonValue>;
}> = z.strictObject({
  kind: z.literal('parallel'),
  id: stateNodeBaseSchema.id,
  order: stateNodeBaseSchema.order,
  datamodel: stateNodeBaseSchema.datamodel,
  onEntry: stateNodeBaseSchema.onEntry,
  onExit: stateNodeBaseSchema.onExit,
  transitions: stateNodeBaseSchema.transitions,
  invokes: stateNodeBaseSchema.invokes,
  extensions: stateNodeBaseSchema.extensions,
  get states() {
    return z.record(z.string(), scxmlStateNodeSchema).optional();
  },
});

export const scxmlFinalSchema = z.strictObject({
  kind: z.literal('final'),
  id: z.string().optional(),
  order: z.number().optional(),
  onEntry: z.array(scxmlExecutableContentSchema).optional(),
  onExit: z.array(scxmlExecutableContentSchema).optional(),
  donedata: scxmlDonedataSchema.optional(),
  extensions: extensionFieldsSchema.optional(),
});

export const scxmlHistorySchema = z.strictObject({
  kind: z.literal('history'),
  id: z.string().optional(),
  order: z.number().optional(),
  type: z.enum(['shallow', 'deep']).optional(),
  transition: scxmlTransitionSchema.optional(),
  extensions: extensionFieldsSchema.optional(),
});

export const scxmlStateNodeSchema: z.ZodType<ScxmlStateNode> =
  z.lazy(() =>
    z.union([
      scxmlStateSchema,
      scxmlParallelSchema,
      scxmlFinalSchema,
      scxmlHistorySchema,
    ])
  );

export const scxmlDocumentSchema = z.strictObject({
  profile: z.literal(SCXML_PROFILE_SHORT_NAME).optional(),
  version: z.literal('1.0'),
  name: z.string().optional(),
  datamodel: z.string().optional(),
  binding: z.enum(['early', 'late']).optional(),
  initial: stateReferenceListSchema.optional(),
  data: z.array(scxmlDataSchema).optional(),
  states: z.record(z.string(), scxmlStateNodeSchema).optional(),
  extensions: extensionFieldsSchema.optional(),
});

export const scxmlNodeSchema = scxmlStateNodeSchema;
export const scxmlElementSchema = scxmlStateNodeSchema;

export type ScxmlDocument = z.infer<typeof scxmlDocumentSchema>;
export type ScxmlNode = z.infer<typeof scxmlNodeSchema>;
export type ScxmlElement = z.infer<typeof scxmlElementSchema>;
