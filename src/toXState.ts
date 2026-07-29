import { createMachineFromConfig, type MachineJSON } from 'xstate';
import { machineSchema, type StateMachine } from './machineSchema';

/** Evaluates an expression against the active XState evaluation scope. */
export type ExpressionEvaluator = (
  expression: string,
  data: { context: any; event: any },
) => any;

export type XStateV6Sources = NonNullable<
  Parameters<typeof createMachineFromConfig>[1]
>;

export interface XStateV6Config extends MachineJSON {
  key?: string;
  profile?: string;
  queryLanguage?: string;
  triggers?: StateMachine['triggers'];
}

const EXPR_RE = /^\{\{[\s\S]*\}\}$/;

export function isExpression(value: unknown): value is string {
  return typeof value === 'string' && EXPR_RE.test(value);
}

export function stripDelimiters(expr: string): string {
  return expr.slice(2, -2).trim();
}

/** Parses an ISO 8601 duration, otherwise preserves the original delay key. */
export function parseISO8601Duration(value: string): number | string {
  const match = value.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/,
  );
  if (!match) return value;
  const days = parseInt(match[1] || '0', 10);
  const hours = parseInt(match[2] || '0', 10);
  const minutes = parseInt(match[3] || '0', 10);
  const seconds = parseFloat(match[4] || '0');
  return days * 86400000 + hours * 3600000 + minutes * 60000 + seconds * 1000;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value != null &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
}

function evaluateSync(
  evaluate: ExpressionEvaluator,
  expression: string,
  data: { context: any; event: any },
) {
  const result = evaluate(expression, data);
  if (isPromiseLike(result)) {
    throw new Error(
      'Async expression evaluators are not supported by XState conversion. Provide a synchronous evaluator or use a synchronous query language.',
    );
  }
  return result;
}

function expressionJSON(expression: string, language?: string) {
  return {
    '@expr': stripDelimiters(expression),
    ...(language ? { '@lang': language } : {}),
  };
}

function convertValue(value: unknown, language?: string): unknown {
  if (isExpression(value)) return expressionJSON(value, language);
  if (Array.isArray(value)) {
    return value.map((item) => convertValue(item, language));
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      convertValue(item, language),
    ]),
  );
}

function sortTransitions(transitions: any[]): any[] {
  return transitions
    .map((transition, index) => ({ transition, index }))
    .sort((a, b) => {
      const orderA =
        typeof a.transition.order === 'number'
          ? a.transition.order
          : Number.POSITIVE_INFINITY;
      const orderB =
        typeof b.transition.order === 'number'
          ? b.transition.order
          : Number.POSITIVE_INFINITY;
      return orderA === orderB ? a.index - b.index : orderA - orderB;
    })
    .map(({ transition }) => transition);
}

function convertGuard(guard: any, language?: string): any {
  return isExpression(guard)
    ? expressionJSON(guard, language)
    : convertValue(guard, language);
}

function convertAction(action: any, language?: string): any {
  switch (action.type) {
    case 'core.assign':
      return {
        type: '@xstate.assign',
        context: convertValue(action.assignments, language),
      };
    case 'xstate.assign':
      return {
        type: '@xstate.assign',
        context: convertValue(action.params ?? {}, language),
      };
    case 'xstate.raise':
      return {
        type: '@xstate.raise',
        ...(convertValue(action.params ?? {}, language) as Record<
          string,
          unknown
        >),
      };
    case 'xstate.cancel':
      return {
        type: '@xstate.cancel',
        ...(convertValue(action.params ?? {}, language) as Record<
          string,
          unknown
        >),
      };
    case 'xstate.log': {
      const message = action.params?.message;
      return {
        type: '@xstate.log',
        args: message === undefined ? [] : [convertValue(message, language)],
      };
    }
    case 'xstate.emit':
      return {
        type: '@xstate.emit',
        ...(convertValue(action.params ?? {}, language) as Record<
          string,
          unknown
        >),
      };
    case 'xstate.sendTo':
      throw new Error(
        'xstate.sendTo has no declarative XState v6 MachineJSON equivalent. Provide a named custom action source instead.',
      );
    default:
      return convertValue(action, language);
  }
}

function convertTransition(transition: any, language?: string): any {
  const result: Record<string, unknown> = {};
  for (const key of ['target', 'matches', 'description', 'reenter', 'meta']) {
    if (transition[key] !== undefined) result[key] = transition[key];
  }
  if (transition.guard !== undefined) {
    result.guard = convertGuard(transition.guard, language);
  }
  if (transition.input !== undefined) {
    result.input = convertValue(transition.input, language);
  }
  const transitionContext: Record<string, unknown> =
    transition.context === undefined
      ? {}
      : (convertValue(transition.context, language) as Record<string, unknown>);
  const actions: unknown[] = [];
  for (const action of transition.actions ?? []) {
    if (action.type === 'core.assign') {
      Object.assign(
        transitionContext,
        convertValue(action.assignments, language),
      );
    } else if (action.type === 'xstate.assign') {
      Object.assign(
        transitionContext,
        convertValue(action.params ?? {}, language),
      );
    } else {
      actions.push(convertAction(action, language));
    }
  }
  if (Object.keys(transitionContext).length) result.context = transitionContext;
  if (actions.length) result.actions = actions;
  return result;
}

function convertTransitions(transitions: any, language?: string): any {
  if (transitions == null) return undefined;
  return Array.isArray(transitions)
    ? sortTransitions(transitions).map((transition) =>
        convertTransition(transition, language),
      )
    : convertTransition(transitions, language);
}

function convertChoice(branches: any[], language?: string) {
  return branches.map((branch) => ({
    ...(branch.when !== undefined
      ? { when: convertGuard(branch.when, language) }
      : {}),
    target: branch.target,
    ...(branch.context !== undefined
      ? { context: convertValue(branch.context, language) }
      : {}),
    ...(branch.input !== undefined
      ? { input: convertValue(branch.input, language) }
      : {}),
    ...(branch.description !== undefined
      ? { description: branch.description }
      : {}),
    ...(branch.reenter !== undefined ? { reenter: branch.reenter } : {}),
    ...(branch.meta !== undefined ? { meta: branch.meta } : {}),
  }));
}

function convertState(
  state: any,
  language?: string,
  canonicalId?: string,
): any {
  const result: Record<string, any> = {};
  for (const key of [
    'id',
    'description',
    'type',
    'history',
    'target',
    'initial',
    'tags',
    'meta',
  ]) {
    if (state[key] !== undefined) result[key] = state[key];
  }
  if (canonicalId !== undefined) result.id = state.id ?? canonicalId;
  for (const key of ['context', 'input', 'output', 'timeout']) {
    if (state[key] !== undefined) {
      result[key] = convertValue(state[key], language);
    }
  }
  for (const key of ['entry', 'exit']) {
    if (state[key]?.length) {
      result[key] = state[key].map((action: any) =>
        convertAction(action, language),
      );
    }
  }
  if (state.on) {
    result.on = Object.fromEntries(
      Object.entries(state.on).map(([event, transitions]) => [
        event,
        convertTransitions(transitions, language),
      ]),
    );
  }
  if (state.after) {
    result.after = Object.fromEntries(
      Object.entries(state.after).map(([delay, transitions]) => [
        String(parseISO8601Duration(delay)),
        convertTransitions(transitions, language),
      ]),
    );
  }
  for (const key of ['always', 'onError', 'onTimeout']) {
    if (state[key] !== undefined) {
      result[key] = convertTransitions(state[key], language);
    }
  }
  if (state.onDone !== undefined) {
    const doneTransitions = convertTransitions(state.onDone, language);
    const values = Array.isArray(doneTransitions)
      ? doneTransitions
      : [doneTransitions];
    const matched = values.map((transition) => ({
      ...transition,
      matches: {
        ...transition.matches,
        stateId: result.id,
      },
    }));
    const converted = Array.isArray(doneTransitions) ? matched : matched[0];
    result.on ??= {};
    result.on['xstate.done.state'] = converted;
  }
  if (state.choice) result.choice = convertChoice(state.choice, language);
  if (state.route !== undefined) {
    result.route = convertValue(state.route, language);
  }
  if (state.invoke) {
    result.invoke = state.invoke.map((invoke: any) => {
      const unsupported = ['heartbeat', 'retry'].filter(
        (key) => invoke[key] !== undefined,
      );
      if (unsupported.length) {
        throw new Error(
          `Unsupported invoke semantics for XState v6 conversion: ${unsupported.join(', ')}.`,
        );
      }
      const converted = convertValue(invoke, language) as Record<
        string,
        unknown
      >;
      for (const key of ['input', 'timeout']) {
        if (invoke[key] !== undefined) {
          converted[key] = convertValue(invoke[key], language);
        }
      }
      for (const key of ['onDone', 'onError', 'onSnapshot', 'onTimeout']) {
        if (invoke[key] !== undefined) {
          converted[key] = convertTransitions(invoke[key], language);
        }
      }
      return converted;
    });
  }
  if (state.states) {
    result.states = Object.fromEntries(
      Object.entries(state.states).map(([key, child]) => [
        key,
        convertState(child, language, result.id ? `${result.id}.${key}` : key),
      ]),
    );
  }
  return result;
}

/** Converts the runtime-neutral specification into XState v6 MachineJSON. */
export function toXStateConfig(
  spec: StateMachine,
  _evaluate?: ExpressionEvaluator,
): any {
  const language = spec.queryLanguage ?? 'stately';
  const config = convertState(spec, language, spec.key) as XStateV6Config;
  config.key = spec.key;
  config.profile = spec.profile ?? 'xstate';
  if (spec.queryLanguage !== undefined) {
    config.queryLanguage = spec.queryLanguage;
  }
  config['@exprLang'] = language;
  if (spec.version !== undefined) config.version = spec.version;
  if (spec.triggers !== undefined) config.triggers = spec.triggers;
  if (spec.schemas !== undefined) config.schemas = spec.schemas;
  if (spec.actions !== undefined) {
    config.actions = Object.fromEntries(
      Object.entries(spec.actions).map(([key, value]) => [
        key,
        Array.isArray(value)
          ? value.map((action) => convertAction(action, language))
          : convertAction(value, language),
      ]),
    );
  }
  if (spec.guards !== undefined) {
    config.guards = Object.fromEntries(
      Object.entries(spec.guards).map(([key, value]) => [
        key,
        { when: convertGuard(value.when, language) },
      ]),
    );
  }
  if (spec.actors !== undefined) config.actors = spec.actors;
  if (spec.delays !== undefined) {
    config.delays = convertValue(
      spec.delays,
      language,
    ) as MachineJSON['delays'];
  }
  return config;
}

function evaluatorSource(
  evaluate: ExpressionEvaluator,
): NonNullable<XStateV6Sources['evaluators']>[string] {
  return ({ source, scope }) =>
    evaluateSync(evaluate, source, {
      context: scope.context,
      event: scope.event,
    });
}

/** Creates an executable XState v6 machine from a Stately specification. */
export function toXStateMachine(
  spec: StateMachine,
  evaluate: ExpressionEvaluator,
  sources: XStateV6Sources = {},
) {
  const language = spec.queryLanguage;
  const evaluatorLanguage = language ?? 'stately';
  return createMachineFromConfig(toXStateConfig(spec, evaluate), {
    ...sources,
    evaluators: {
      ...sources.evaluators,
      [evaluatorLanguage]: evaluatorSource(evaluate),
    },
  });
}

function restoreValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(restoreValue);
  if (!value || typeof value !== 'object') return value;
  if (typeof (value as Record<string, unknown>)['@expr'] === 'string') {
    return `{{ ${(value as Record<string, unknown>)['@expr']} }}`;
  }
  if (typeof (value as Record<string, unknown>)['@code'] === 'string') {
    throw new Error(
      'XState @code values cannot be represented by the runtime-neutral specification.',
    );
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, restoreValue(item)]),
  );
}

function restoreStateNode(
  node: Record<string, any>,
  canonicalId: string,
): void {
  const stateId = node.id ?? canonicalId;
  const doneTransitions = node.on?.['xstate.done.state'];
  if (doneTransitions !== undefined) {
    const values = Array.isArray(doneTransitions)
      ? doneTransitions
      : [doneTransitions];
    if (
      values.every((transition) => transition?.matches?.stateId === stateId)
    ) {
      const restored = values.map((transition) => {
        const result = { ...transition };
        const { stateId: _stateId, ...matches } = result.matches;
        if (Object.keys(matches).length) result.matches = matches;
        else delete result.matches;
        return result;
      });
      node.onDone = Array.isArray(doneTransitions) ? restored : restored[0];
      delete node.on['xstate.done.state'];
      if (!Object.keys(node.on).length) delete node.on;
    }
  }

  if (node.id === canonicalId) delete node.id;
  for (const [key, child] of Object.entries(node.states ?? {})) {
    restoreStateNode(child as Record<string, any>, `${canonicalId}.${key}`);
  }
}

export interface FromXStateV6Options {
  key?: string;
}

/** Converts the serializable XState v6 MachineJSON subset into a specification. */
export function fromXStateConfig(
  config: XStateV6Config,
  options: FromXStateV6Options = {},
): StateMachine {
  const restored = restoreValue(config) as Record<string, any>;
  const language = config['@exprLang'] ?? config.queryLanguage;
  delete restored['@exprLang'];
  delete restored.queryLanguage;
  delete restored.profile;
  delete restored.triggers;
  const key = options.key ?? config.key ?? config.id ?? 'machine';
  restoreStateNode(restored, key);

  return machineSchema.parse({
    ...restored,
    key,
    profile: 'xstate',
    ...(language ? { queryLanguage: language } : {}),
    ...(config.triggers ? { triggers: config.triggers } : {}),
  });
}
