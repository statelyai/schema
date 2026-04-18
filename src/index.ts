export {
  expressionSchema,
  expressionOr,
  queryLanguageSchema,
  jsonSchemaPropertySchema,
} from './expressionSchema';
export {
  actionSchema,
  assignActionSchema,
  raiseActionSchema,
  sendToActionSchema,
  logActionSchema,
  emitActionSchema,
  retrySchema,
  customActionSchema,
  guardSchema,
  namedGuardSchema,
  metaSchema,
  transitionSchema,
  transitionObjectSchema,
  transitionsSchema,
  invokeSchema,
  stateSchema,
  schemasSchema,
  jsonValueSchema,
  profileSchema,
  eventDescriptorSchema,
  machineSchema,
} from './machineSchema';
export type { StateMachine } from './machineSchema';
export {
  isExpression,
  stripDelimiters,
  parseISO8601Duration,
} from './toXState';
export type { ExpressionEvaluator } from './toXState';
export { machineToGraph } from './machineToGraph';

import type { StateMachine } from './machineSchema';
import {
  toXStateConfig,
  toXStateMachine,
  type ExpressionEvaluator,
} from './toXState';
import { createJmespathEvaluator } from './jmespath';
import { createJsonpathEvaluator } from './jsonpath';

export type QueryLanguage = string;

export interface ConvertOptions {
  queryLanguage?: QueryLanguage;
  evaluate?: ExpressionEvaluator;
}

function resolveEvaluator(
  spec: StateMachine,
  options?: ConvertOptions
): ExpressionEvaluator {
  if (options?.evaluate) return options.evaluate;
  const lang = options?.queryLanguage ?? spec.queryLanguage;
  switch (lang) {
    case 'jmespath':
      return createJmespathEvaluator();
    case 'jsonpath':
      return createJsonpathEvaluator();
    case 'jsonata':
      throw new Error(
        'The built-in jsonata evaluator is async and cannot be converted directly to an XState machine. Provide a synchronous evaluate() override or use jmespath/jsonpath.'
      );
    default:
      throw new Error(
        `Unknown query language "${lang}". Specify queryLanguage in the spec or options.`
      );
  }
}

export function convertSpecToMachine(
  spec: StateMachine,
  options?: ConvertOptions
) {
  return toXStateMachine(spec, resolveEvaluator(spec, options));
}

export function convertSpecToConfig(
  spec: StateMachine,
  options?: ConvertOptions
) {
  return toXStateConfig(spec, resolveEvaluator(spec, options));
}
