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
  SCXML_PROFILE_SHORT_NAME,
  SCXML_PROFILE_URI,
} from './profiles';
export {
  actionSchema,
  assignmentSchema,
  coreAssignActionSchema,
  xstateAssignActionSchema,
  xstateRaiseActionSchema,
  xstateCancelActionSchema,
  xstateLogActionSchema,
  xstateEmitActionSchema,
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
  choiceBranchSchema,
  routeSchema,
  stateSchema,
  schemasSchema,
  jsonValueSchema,
  profileSchema,
  eventDescriptorSchema,
  machineSchema,
  validateMachine,
} from './machineSchema';
export type {
  StateMachine,
  MachineDiagnostic,
  MachineValidationResult,
} from './machineSchema';
export {
  scxmlDataSchema,
  scxmlDatamodelSchema,
  scxmlContentSchema,
  scxmlParamSchema,
  scxmlDonedataSchema,
  scxmlRaiseSchema,
  scxmlIfSchema,
  scxmlForeachSchema,
  scxmlLogSchema,
  scxmlAssignSchema,
  scxmlScriptSchema,
  scxmlSendSchema,
  scxmlCancelSchema,
  scxmlCustomActionSchema,
  scxmlExecutableContentSchema,
  scxmlTransitionSchema,
  scxmlInitialSchema,
  scxmlFinalizeSchema,
  scxmlInvokeSchema,
  scxmlStateSchema,
  scxmlParallelSchema,
  scxmlFinalSchema,
  scxmlHistorySchema,
  scxmlStateNodeSchema,
  scxmlNodeSchema,
  scxmlElementSchema,
  scxmlDocumentSchema,
} from './scxmlSchema';
export type { ScxmlDocument, ScxmlElement, ScxmlNode } from './scxmlSchema';
export {
  isExpression,
  stripDelimiters,
  parseISO8601Duration,
  toXStateConfig,
  toXStateMachine,
  fromXStateConfig,
} from './toXState';
export type {
  ExpressionEvaluator,
  XStateV6Config,
  XStateV6Sources,
  FromXStateV6Options,
} from './toXState';
export { machineToGraph } from './machineToGraph';

import type { StateMachine } from './machineSchema';
import {
  toXStateConfig,
  toXStateMachine,
  type ExpressionEvaluator,
  type XStateV6Sources,
} from './toXState';
import { createJmespathEvaluator } from './jmespath';
import { createJsonpathEvaluator } from './jsonpath';
import { matchesRegisteredProfile } from './profiles';

export type QueryLanguage = string;

export interface ConvertOptions {
  queryLanguage?: QueryLanguage;
  evaluate?: ExpressionEvaluator;
  sources?: XStateV6Sources;
}

export type XStateConversionSupport =
  { supported: true } | { supported: false; reason: string };

function getUnsupportedProfileReason(spec: StateMachine): string | undefined {
  if (spec.profile == null) return;
  if (matchesRegisteredProfile(spec.profile, 'xstate')) return;

  return `XState conversion only supports machines with no profile or the xstate profile. Received "${spec.profile}".`;
}

function getQueryLanguageSupportReason(
  spec: StateMachine,
  options?: ConvertOptions,
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

function findUnsupportedInvokeReason(
  state: any,
  path: string,
): string | undefined {
  if (state.invoke) {
    for (const [index, inv] of state.invoke.entries()) {
      const unsupportedKeys = ['heartbeat', 'retry'].filter(
        (key) => inv[key] != null,
      );

      if (unsupportedKeys.length) {
        return `Unsupported invoke semantics for XState conversion at "${path}.invoke[${index}]": ${unsupportedKeys.join(
          ', ',
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function getActionShapeReason(action: any, path: string): string | undefined {
  const requireParams = (...keys: string[]) => {
    if (!isRecord(action.params)) {
      return `${action.type} at "${path}" requires an object params value containing ${keys
        .map((key) => `params.${key}`)
        .join(' and ')}.`;
    }
    const missing = keys.filter((key) => action.params[key] == null);
    if (missing.length) {
      return `${action.type} at "${path}" requires ${missing
        .map((key) => `params.${key}`)
        .join(' and ')}.`;
    }
  };

  switch (action.type) {
    case '@xstate.assign':
      if (!isRecord(action.context)) {
        return `${action.type} at "${path}" requires an object context value.`;
      }
      return;
    case '@xstate.raise':
    case '@xstate.emit':
      if (action.event == null) {
        return `${action.type} at "${path}" requires event.`;
      }
      return;
    case '@xstate.cancel':
      if (typeof action.id !== 'string') {
        return `${action.type} at "${path}" requires a string id.`;
      }
      return;
    case '@xstate.log':
      if (!Array.isArray(action.args)) {
        return `${action.type} at "${path}" requires an args array.`;
      }
      return;
    case 'xstate.assign':
      return requireParams();
    case 'xstate.raise':
    case 'xstate.emit':
      return requireParams('event');
    case 'xstate.cancel':
      return requireParams('id');
    case 'xstate.sendTo':
      return 'xstate.sendTo has no declarative XState v6 MachineJSON equivalent. Use a named custom action source.';
    case 'xstate.log':
      if (action.params != null && !isRecord(action.params)) {
        return `${action.type} at "${path}" requires params to be an object when provided.`;
      }
  }
}

function findUnsupportedActionReason(
  state: any,
  path: string,
): string | undefined {
  const visitActions = (actions: any, actionPath: string) => {
    if (!Array.isArray(actions)) return undefined;
    for (const [index, action] of actions.entries()) {
      const reason = getActionShapeReason(action, `${actionPath}[${index}]`);
      if (reason) return reason;
    }
  };

  const visitTransitions = (transitions: any, transitionPath: string) => {
    const values = Array.isArray(transitions) ? transitions : [transitions];
    for (const [index, transition] of values.entries()) {
      if (!transition) continue;
      const reason = visitActions(
        transition.actions,
        `${transitionPath}${Array.isArray(transitions) ? `[${index}]` : ''}.actions`,
      );
      if (reason) return reason;
    }
  };

  for (const key of ['entry', 'exit'] as const) {
    const reason = visitActions(state[key], `${path}.${key}`);
    if (reason) return reason;
  }

  for (const [event, transitions] of Object.entries(state.on ?? {})) {
    const reason = visitTransitions(transitions, `${path}.on.${event}`);
    if (reason) return reason;
  }
  for (const [delay, transitions] of Object.entries(state.after ?? {})) {
    const reason = visitTransitions(transitions, `${path}.after.${delay}`);
    if (reason) return reason;
  }
  for (const key of ['always', 'onDone', 'onError', 'onTimeout'] as const) {
    if (state[key] == null) continue;
    const reason = visitTransitions(state[key], `${path}.${key}`);
    if (reason) return reason;
  }
  for (const [index, invoke] of (state.invoke ?? []).entries()) {
    for (const key of [
      'onDone',
      'onError',
      'onSnapshot',
      'onTimeout',
    ] as const) {
      if (invoke[key] == null) continue;
      const reason = visitTransitions(
        invoke[key],
        `${path}.invoke[${index}].${key}`,
      );
      if (reason) return reason;
    }
  }

  for (const [key, child] of Object.entries(state.states ?? {})) {
    const reason = findUnsupportedActionReason(child, `${path}.${key}`);
    if (reason) return reason;
  }
}

function getXStateConfigConversionSupport(
  spec: StateMachine,
): XStateConversionSupport {
  const profileReason = getUnsupportedProfileReason(spec);
  if (profileReason) {
    return { supported: false, reason: profileReason };
  }

  const actionReason = findUnsupportedActionReason(spec, spec.key);
  if (actionReason) {
    return { supported: false, reason: actionReason };
  }

  for (const [name, definition] of Object.entries(spec.actions ?? {})) {
    const definitions = Array.isArray(definition) ? definition : [definition];
    for (const [index, action] of definitions.entries()) {
      const reason = getActionShapeReason(
        action,
        `${spec.key}.actions.${name}${definitions.length > 1 ? `[${index}]` : ''}`,
      );
      if (reason) return { supported: false, reason };
    }
  }

  const invokeReason = findUnsupportedInvokeReason(spec, spec.key);
  if (invokeReason) {
    return { supported: false, reason: invokeReason };
  }

  return { supported: true };
}

export function getXStateConversionSupport(
  spec: StateMachine,
  options?: ConvertOptions,
): XStateConversionSupport {
  const configSupport = getXStateConfigConversionSupport(spec);
  if (!configSupport.supported) return configSupport;

  const queryLanguageReason = getQueryLanguageSupportReason(spec, options);
  return typeof queryLanguageReason === 'string'
    ? { supported: false, reason: queryLanguageReason }
    : { supported: true };
}

export function canConvertToXState(
  spec: StateMachine,
  options?: ConvertOptions,
): boolean {
  return getXStateConversionSupport(spec, options).supported;
}

function assertXStateConversionSupported(
  spec: StateMachine,
  options?: ConvertOptions,
): void {
  const support = getXStateConversionSupport(spec, options);
  if (!support.supported) {
    throw new Error(support.reason);
  }
}

function resolveEvaluator(
  spec: StateMachine,
  options?: ConvertOptions,
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
        'The built-in jsonata evaluator is async and cannot be converted directly to an XState machine. Provide a synchronous evaluate() override or use jmespath/jsonpath.',
      );
    default:
      throw new Error(
        `Unknown query language "${lang}". Specify queryLanguage in the spec or options.`,
      );
  }
}

export function convertSpecToMachine(
  spec: StateMachine,
  options?: ConvertOptions,
) {
  assertXStateConversionSupported(spec, options);
  const resolvedSpec = options?.queryLanguage
    ? { ...spec, queryLanguage: options.queryLanguage }
    : spec;
  return toXStateMachine(
    resolvedSpec,
    resolveEvaluator(spec, options),
    options?.sources,
  );
}

export function convertSpecToConfig(
  spec: StateMachine,
  options?: ConvertOptions,
) {
  const support = getXStateConfigConversionSupport(spec);
  if (!support.supported) throw new Error(support.reason);
  return toXStateConfig(
    options?.queryLanguage
      ? { ...spec, queryLanguage: options.queryLanguage }
      : spec,
  );
}
