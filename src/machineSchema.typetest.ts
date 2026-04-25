/**
 * Type-level tests for Zod schema inference.
 * Run with `tsc --noEmit` — these are compile-time only.
 *
 * NOTE: stateSchema uses `z.ZodObject<any>` for recursive child states,
 * which makes State and StateMachine inferred types too wide.
 * Sub-schemas (transitions, actions, guards, invoke) ARE well-typed.
 * Runtime Zod validation still catches all errors regardless.
 */
import type { z } from 'zod';
import type {
  machineSchema,
  stateSchema,
  transitionObjectSchema,
  transitionsSchema,
  actionSchema,
  assignActionSchema,
  raiseActionSchema,
  sendToActionSchema,
  logActionSchema,
  emitActionSchema,
  customActionSchema,
  guardSchema,
  namedGuardSchema,
  invokeSchema,
  retrySchema,
  triggerSchema,
  triggersSchema,
  schemasSchema,
} from './machineSchema';

type StateMachine = z.infer<typeof machineSchema>;
type State = z.infer<typeof stateSchema>;
type TransitionObject = z.infer<typeof transitionObjectSchema>;
type Transitions = z.infer<typeof transitionsSchema>;
type Action = z.infer<typeof actionSchema>;
type AssignAction = z.infer<typeof assignActionSchema>;
type RaiseAction = z.infer<typeof raiseActionSchema>;
type SendToAction = z.infer<typeof sendToActionSchema>;
type LogAction = z.infer<typeof logActionSchema>;
type EmitAction = z.infer<typeof emitActionSchema>;
type CustomAction = z.infer<typeof customActionSchema>;
type Guard = z.infer<typeof guardSchema>;
type NamedGuard = z.infer<typeof namedGuardSchema>;
type Invoke = z.infer<typeof invokeSchema>;
type Retry = z.infer<typeof retrySchema>;
type Trigger = z.infer<typeof triggerSchema>;
type Triggers = z.infer<typeof triggersSchema>;
type Schemas = z.infer<typeof schemasSchema>;

// --- Helpers ---
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function assert<T>(_value: T) {}

// ============================================================
// StateMachine / State — wide due to ZodObject<any> recursion.
// These compile-time tests verify assignability, not narrowness.
// ============================================================

assert<StateMachine>({ key: 'machine' });
assert<StateMachine>({
  key: 'machine',
  version: '1.0',
  queryLanguage: 'jsonata',
  context: { count: 0 },
  triggers: [{ type: 'webhook', path: '/api/orders' }],
  initial: 'idle',
  states: {
    idle: { on: { GO: { target: 'active' } } },
    active: {},
  },
});
assert<State>({});
assert<State>({ type: 'parallel' });
assert<State>({ type: 'final' });
assert<State>({ type: 'history', history: 'deep' });

// ============================================================
// TransitionObject — well-typed
// ============================================================

assert<TransitionObject>({ target: 'foo' });
assert<TransitionObject>({ target: ['foo', 'bar'], reenter: true });
assert<TransitionObject>({ target: [] });
assert<TransitionObject>({
  target: 'bar',
  guard: '{{ context.ready }}',
  actions: [{ type: 'xstate.assign', params: { x: 1 } }],
  description: 'go to bar',
  order: 1,
});
assert<TransitionObject>({}); // all fields optional
assert<TransitionObject>({
  target: 'foo',
  context: { count: '{{ context.count + 1 }}' },
});
assert<TransitionObject>({
  target: 'foo',
  context: { status: 'done', count: 42 },
});

// @ts-expect-error — string shorthand not allowed
assert<TransitionObject>('target');

// @ts-expect-error — target must be string or string[]
assert<TransitionObject>({ target: 123 });

// @ts-expect-error — actions must be array
assert<TransitionObject>({ actions: { type: 'xstate.log' } });

// @ts-expect-error — order must be number
assert<TransitionObject>({ order: 'first' });

// @ts-expect-error — description must be string
assert<TransitionObject>({ description: 42 });

// ============================================================
// Transitions (union: object | object[]) — well-typed
// ============================================================

assert<Transitions>({ target: 'a' });
assert<Transitions>([
  { target: 'a', guard: '{{ context.x }}' },
  { target: 'b' },
]);

// @ts-expect-error — number not valid
assert<Transitions>(42);

// @ts-expect-error — array of strings not valid
assert<Transitions>(['a', 'b']);

// ============================================================
// Actions — core.assign plus profile-defined action types
// ============================================================

assert<AssignAction>({ type: 'core.assign', assignments: { x: 1, y: '{{ event.val }}' } });
assert<AssignAction>({
  type: 'core.assign',
  assignments: { x: 1 },
  params: { source: 'test' },
});
assert<RaiseAction>({ type: 'xstate.raise', params: { event: { type: 'DONE' } } });
assert<SendToAction>({
  type: 'xstate.sendTo',
  params: { actorRef: 'myActor', event: { type: 'PING' } },
});
assert<LogAction>({ type: 'xstate.log' });
assert<LogAction>({ type: 'xstate.log', params: { message: 'hello' } });
assert<EmitAction>({ type: 'xstate.emit', params: { event: { type: 'NOTIFY' } } });
assert<CustomAction>({ type: 'myAction', params: { foo: 'bar' } });
assert<CustomAction>({ type: 'myAction' });

assert<RaiseAction>({ type: 'xstate.raise', params: {} });
assert<SendToAction>({ type: 'xstate.sendTo', params: { actorRef: 'a' } });

// @ts-expect-error — core.assign requires assignments
assert<AssignAction>({ type: 'core.assign' });

// @ts-expect-error — assignActionSchema is the core assign schema
assert<AssignAction>({ type: 'xstate.assign', assignments: { x: 1 } });

// @ts-expect-error — action requires type
assert<Action>({ params: { x: 1 } });

// @ts-expect-error — action params must be JSON values
assert<Action>({ type: 'custom', params: () => undefined });

assert<RaiseAction>({ type: 'other', params: { event: 'E' } });
assert<RaiseAction>({ type: 'other', custom: { ok: true } });
assert<SendToAction>({ type: 'other', params: { actorRef: 'a', event: 'E' } });
assert<LogAction>({ type: 'other' });
assert<EmitAction>({ type: 'other', params: { event: 'E' } });

// Action union accepts all
assert<Action>({ type: 'core.assign', assignments: { x: 1 } });
assert<Action>({ type: 'xstate.assign', params: { x: 1 } });
assert<Action>({ type: 'xstate.raise', params: { event: 'E' } });
assert<Action>({ type: 'xstate.log' });
assert<Action>({ type: 'xstate.emit', params: { event: { type: 'X' } } });
assert<Action>({ type: 'custom' });

// ============================================================
// Guards — well-typed
// ============================================================

assert<Guard>('{{ context.ready }}');
assert<Guard>({ type: 'isReady' });
assert<Guard>({ type: 'isReady', params: { threshold: 5 } });
assert<Guard>({ type: 'isReady', config: { strict: true } });
assert<NamedGuard>({ type: 'isReady' });
assert<NamedGuard>({ type: 'isReady', config: { strict: true } });

// @ts-expect-error — named guard requires type
assert<NamedGuard>({ params: { x: 1 } });

// @ts-expect-error — named guard extra fields must be JSON values
assert<NamedGuard>({ type: 'isReady', config: () => undefined });

// Note: Guard accepts any string at type level — regex {{ }} is
// enforced at runtime by Zod, not in the TS type.
assert<Guard>('notAnExpression'); // compiles, but fails Zod parse

// ============================================================
// Invoke — well-typed
// ============================================================

assert<Invoke>({ src: 'fetchUser' });
assert<Invoke>({
  id: 'fetcher',
  src: 'fetchUser',
  input: '{{ context.userId }}',
  profileData: { mode: 'fast' },
  onDone: { target: 'success' },
  onError: { target: 'failure' },
  onSnapshot: { target: 'updating' },
  timeout: 'PT30S',
  heartbeat: 'PT5S',
  retry: { maxAttempts: 3, interval: 1000, backoff: 2 },
});

// @ts-expect-error — invoke requires src
assert<Invoke>({ id: 'fetcher' });

// @ts-expect-error — src must be string
assert<Invoke>({ src: 123 });

// @ts-expect-error — timeout must be string
assert<Invoke>({ src: 'foo', timeout: 30 });

// @ts-expect-error — invoke extra fields must be JSON values
assert<Invoke>({ src: 'foo', custom: () => undefined });

// ============================================================
// Retry
// ============================================================

assert<Retry>({ maxAttempts: 3 });
assert<Retry>({ maxAttempts: 5, interval: 1000, backoff: 2 });
assert<Retry>({ maxAttempts: 5, interval: 'PT5S' });

// @ts-expect-error — maxAttempts required
assert<Retry>({ interval: 1000 });

// ============================================================
// Triggers — well-typed
// ============================================================

assert<Trigger>({ type: 'webhook', path: '/api/orders' });
assert<Trigger>({ type: 'cron', schedule: '0 9 * * *' });
assert<Triggers>([{ type: 'webhook' }]);
assert<Triggers>(undefined);

// @ts-expect-error — trigger requires type
assert<Trigger>({ path: '/api/orders' });

// @ts-expect-error — trigger extra fields must be JSON values
assert<Trigger>({ type: 'webhook', handler: () => undefined });

// ============================================================
// Schemas
// ============================================================

assert<Schemas>({
  context: { count: { type: 'number' } },
  events: {
    INCREMENT: {
      type: 'object',
      properties: { amount: { type: 'number' } },
    },
  },
});
assert<Schemas>(undefined);
