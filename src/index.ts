export {
  expressionSchema,
  expressionOr,
  queryLanguageSchema,
  jsonSchemaPropertySchema,
} from './expressionSchema';
export {
  registeredProfiles,
  isRegisteredProfileName,
  getRegisteredProfile,
  normalizeRegisteredProfile,
  matchesRegisteredProfile,
  XSTATE_PROFILE_SHORT_NAME,
  XSTATE_PROFILE_URI,
  SERVERLESSWORKFLOW_PROFILE_SHORT_NAME,
  SERVERLESSWORKFLOW_PROFILE_URI,
} from './profiles';
export {
  actionSchema,
  assignmentSchema,
  coreAssignActionSchema,
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
  triggerSchema,
  triggersSchema,
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
import { matchesRegisteredProfile } from './profiles';

export type QueryLanguage = string;

export interface ConvertOptions {
  queryLanguage?: QueryLanguage;
  evaluate?: ExpressionEvaluator;
}

export type XStateConversionSupport =
  | { supported: true }
  | { supported: false; reason: string };

function getUnsupportedProfileReason(spec: StateMachine): string | undefined {
  if (spec.profile == null) return;
  if (matchesRegisteredProfile(spec.profile, 'xstate')) return;

  return `XState conversion only supports machines with no profile or the xstate profile. Received "${spec.profile}".`;
}

function getQueryLanguageSupportReason(
  spec: StateMachine,
  options?: ConvertOptions
) {
  if (options?.evaluate) return undefined;
  const lang = options?.queryLanguage ?? spec.queryLanguage;
  switch (lang) {
    case 'jmespath':
      return undefined;
    case 'jsonpath':
      return undefined;
    case 'jsonata':
      return 'The built-in jsonata evaluator is async and cannot be converted directly to an XState machine. Provide a synchronous evaluate() override or use jmespath/jsonpath.';
    default:
      return `Unknown query language "${lang}". Specify queryLanguage in the spec or options.`;
  }
}

function findUnsupportedInvokeReason(state: any, path: string): string | undefined {
  if (state.invoke) {
    for (const [index, inv] of state.invoke.entries()) {
      const unsupportedKeys = ['timeout', 'heartbeat', 'retry'].filter(
        (key) => inv[key] != null
      );

      if (unsupportedKeys.length) {
        return `Unsupported invoke semantics for XState conversion at "${path}.invoke[${index}]": ${unsupportedKeys.join(
          ', '
        )}. These require a runtime wrapper and are not implemented by toXStateConfig()/toXStateMachine().`;
      }
    }
  }

  if (!state.states) return undefined;

  for (const [key, child] of Object.entries(state.states)) {
    const reason = findUnsupportedInvokeReason(child, `${path}.${key}`);
    if (reason) return reason;
  }

  return undefined;
}

export function getXStateConversionSupport(
  spec: StateMachine,
  options?: ConvertOptions
): XStateConversionSupport {
  const profileReason = getUnsupportedProfileReason(spec);
  if (profileReason) {
    return { supported: false, reason: profileReason };
  }

  const queryLanguageReason = getQueryLanguageSupportReason(spec, options);
  if (typeof queryLanguageReason === 'string') {
    return { supported: false, reason: queryLanguageReason };
  }

  const invokeReason = findUnsupportedInvokeReason(spec, spec.key);
  if (invokeReason) {
    return { supported: false, reason: invokeReason };
  }

  return { supported: true };
}

export function canConvertToXState(
  spec: StateMachine,
  options?: ConvertOptions
): boolean {
  return getXStateConversionSupport(spec, options).supported;
}

function assertXStateConversionSupported(
  spec: StateMachine,
  options?: ConvertOptions
): void {
  const support = getXStateConversionSupport(spec, options);
  if (!support.supported) {
    throw new Error(support.reason);
  }
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
  assertXStateConversionSupported(spec, options);
  return toXStateMachine(spec, resolveEvaluator(spec, options));
}

export function convertSpecToConfig(
  spec: StateMachine,
  options?: ConvertOptions
) {
  assertXStateConversionSupported(spec, options);
  return toXStateConfig(spec, resolveEvaluator(spec, options));
}
