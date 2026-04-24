import { test, describe } from 'node:test';
import assert from 'node:assert';
import { machineSchema } from './machineSchema';

function parseMachine(machine: Record<string, unknown>) {
  return machineSchema.parse({ key: 'machine', ...machine });
}

describe('machineSchema', () => {
  test('trivial machine', () => {
    parseMachine({});
  });

  test('all basic properties', () => {
    parseMachine({
      id: 'test',
      description: 'test',
      version: '1.0.0',
      initial: 'idle',
      states: {
        idle: {},
      },
    });
  });

  test('invalid machine', () => {
    assert.throws(() => parseMachine({ id: 3 }));
  });

  test('unknown top-level properties are rejected', () => {
    assert.throws(() =>
      parseMachine({
        initial: 'idle',
        states: { idle: {} },
        bogus: true,
      })
    );
  });

  // --- queryLanguage ---

  test('queryLanguage', () => {
    parseMachine({ queryLanguage: 'jsonata' });
    parseMachine({ queryLanguage: 'jmespath' });
    parseMachine({ queryLanguage: 'jsonpath' });
    parseMachine({ queryLanguage: 'sql' });
  });

  test('machine key is required and constrained', () => {
    assert.throws(() => machineSchema.parse({}));
    assert.throws(() => machineSchema.parse({ key: 'foo.bar' }));
    assert.throws(() => machineSchema.parse({ key: '#foo' }));
    machineSchema.parse({ key: 'foo' });
  });

  // --- Context ---

  test('context with initial values', () => {
    parseMachine({
      context: { count: 0, name: '', items: [] },
    });
  });

  test('freeform values must be JSON values', () => {
    assert.throws(() =>
      parseMachine({
        context: { fn: () => undefined },
      })
    );
    assert.throws(() =>
      parseMachine({
        context: { infinite: Number.POSITIVE_INFINITY },
      })
    );
    assert.throws(() =>
      parseMachine({
        states: {
          idle: {
            entry: [{ type: 'custom', params: () => undefined }],
          },
        },
      })
    );
  });

  // --- Schemas ---

  test('schemas for context and events', () => {
    parseMachine({
      context: { count: 0 },
      schemas: {
        input: {
          type: 'object',
          properties: { orderId: { type: 'string' } },
        },
        context: {
          count: { type: 'number' },
        },
        events: {
          INCREMENT: {
            type: 'object',
            properties: {
              amount: { type: 'number' },
            },
          },
        },
      },
    });
  });

  test('event schemas are exact event types, not descriptors', () => {
    assert.throws(() =>
      parseMachine({
        schemas: {
          events: {
            '*': {},
          },
        },
      })
    );
    assert.throws(() =>
      parseMachine({
        schemas: {
          events: {
            'feedback.*': {},
          },
        },
      })
    );
  });

  // --- Input ---

  test('input JSON Schema lives under schemas', () => {
    parseMachine({
      schemas: {
        input: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
          },
        },
      },
    });
  });

  test('top-level input is rejected', () => {
    assert.throws(() =>
      parseMachine({
        input: {
          type: 'object',
        },
      })
    );
  });

  // --- Profiles ---

  test('profile is a registered name or URI', () => {
    parseMachine({ profile: 'xstate' });
    parseMachine({ profile: 'https://example.com/profiles/my-runtime' });
    parseMachine({ profile: 'urn:example:profile' });
    assert.throws(() => parseMachine({ profile: 'fake' }));
  });

  // --- Expressions ---

  test('assign action with expressions', () => {
    parseMachine({
      initial: 'active',
      states: {
        active: {
          entry: [
            {
              type: 'xstate.assign',
              params: {
                count: '{{ $context.count + 1 }}',
                name: 'literal string',
              },
            },
          ],
        },
      },
    });
  });

  test('inline guard expression', () => {
    parseMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            NEXT: {
              target: 'done',
              guard: '{{ $context.count > 0 }}',
            },
          },
        },
        done: { type: 'final' },
      },
    });
  });

  test('named guard object', () => {
    parseMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            NEXT: {
              target: 'done',
              guard: { type: 'isReady', params: { threshold: 5 } },
            },
          },
        },
        done: { type: 'final' },
      },
    });
  });

  test('profile guards may define extra JSON fields', () => {
    parseMachine({
      initial: 'active',
      states: {
        active: {
          on: {
            NEXT: {
              target: 'done',
              guard: {
                type: 'isReady',
                params: { threshold: 5 },
                config: { strict: true },
              },
            },
          },
        },
        done: { type: 'final' },
      },
    });
    assert.throws(() =>
      parseMachine({
        initial: 'active',
        states: {
          active: {
            on: {
              NEXT: {
                target: 'done',
                guard: {
                  type: 'isReady',
                  config: () => undefined,
                },
              },
            },
          },
          done: { type: 'final' },
        },
      })
    );
  });

  // --- Transition object ---

  test('transition object', () => {
    parseMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            GO: { target: 'b' },
          },
        },
        b: {},
      },
    });
  });

  test('string transition shorthand rejected', () => {
    assert.throws(() =>
      parseMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              GO: 'b',
            },
          },
          b: {},
        },
      })
    );
  });

  test('final states may contain vestigial fields structurally', () => {
    parseMachine({
      initial: 'done',
      states: {
        done: {
          type: 'final',
          on: { RETRY: { target: 'done' } },
          states: { ignored: {} },
        },
      },
    });
  });

  test('compound states may omit initial structurally', () => {
    parseMachine({
      initial: 'parent',
      states: {
        parent: {
          states: {
            child: {},
          },
        },
      },
    });
  });

  test('initial must reference an immediate child when present', () => {
    assert.throws(() =>
      parseMachine({
        initial: 'missing',
        states: { idle: {} },
      })
    );
    assert.throws(() =>
      parseMachine({
        initial: 'parent',
        states: {
          parent: {
            initial: 'missing',
            states: { child: {} },
          },
        },
      })
    );
  });

  test('transition with context shorthand', () => {
    parseMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            INC: {
              target: 'a',
              context: { count: '{{ context.count + 1 }}' },
            },
          },
        },
      },
    });
  });

  test('transition with context shorthand and static value', () => {
    parseMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            RESET: {
              target: 'a',
              context: { count: 0, name: 'default' },
            },
          },
        },
      },
    });
  });

  test('transition with order', () => {
    parseMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            GO: [
              { target: 'b', guard: '{{ $context.x }}', order: 1 },
              { target: 'c', order: 2 },
            ],
          },
        },
        b: {},
        c: {},
      },
    });
  });

  test('transition supports array targets, empty targets, and reenter', () => {
    parseMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            SPLIT: { target: ['b', 'c'], reenter: true },
            FORBID: {},
            NO_TARGETS: { target: [] },
          },
        },
        b: {},
        c: {},
      },
    });
  });

  test('event descriptors allow exact, wildcard, and partial wildcard', () => {
    parseMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            GO: {},
            '*': {},
            'feedback.*': {},
          },
        },
      },
    });
  });

  test('malformed event descriptors are rejected', () => {
    assert.throws(() =>
      parseMachine({
        initial: 'a',
        states: {
          a: { on: { 'feedback.*.bad': {} } },
        },
      })
    );
    assert.throws(() =>
      parseMachine({
        initial: 'a',
        states: {
          a: { on: { 'feedback*': {} } },
        },
      })
    );
  });

  // --- Built-in actions ---

  test('core.assign action', () => {
    parseMachine({
      initial: 'a',
      states: {
        a: {
          entry: [
            {
              type: 'core.assign',
              assignments: {
                count: '{{ $context.count + 1 }}',
                status: 'ready',
              },
              params: { source: 'entry' },
            },
          ],
        },
      },
    });
  });

  test('core.assign requires keyed assignments', () => {
    assert.throws(() =>
      parseMachine({
        initial: 'a',
        states: {
          a: {
            entry: [{ type: 'core.assign' }],
          },
        },
      })
    );
    assert.throws(() =>
      parseMachine({
        initial: 'a',
        states: {
          a: {
            entry: [{ type: 'core.assign', assignments: [] }],
          },
        },
      })
    );
  });

  test('profile actions may define extra JSON fields', () => {
    parseMachine({
      initial: 'a',
      states: {
        a: {
          entry: [
            {
              type: 'profile.action',
              params: { value: 1 },
              custom: { value: true },
            },
          ],
        },
      },
    });
    assert.throws(() =>
      parseMachine({
        initial: 'a',
        states: {
          a: {
            entry: [
              {
                type: 'profile.action',
                custom: () => undefined,
              },
            ],
          },
        },
      })
    );
  });

  test('raise action', () => {
    parseMachine({
      initial: 'a',
      states: {
        a: {
          entry: [{ type: 'xstate.raise', params: { event: 'DONE' } }],
        },
      },
    });
  });

  test('sendTo action', () => {
    parseMachine({
      initial: 'a',
      states: {
        a: {
          entry: [
            {
              type: 'xstate.sendTo',
              params: {
                actorRef: '{{ $system.worker }}',
                event: '{{ { "type": "PING" } }}',
              },
            },
          ],
        },
      },
    });
  });

  test('log action', () => {
    parseMachine({
      initial: 'a',
      states: {
        a: {
          entry: [
            { type: 'xstate.log', params: { message: '{{ "count: " & $context.count }}' } },
            { type: 'xstate.log' },
          ],
        },
      },
    });
  });

  test('emit action', () => {
    parseMachine({
      initial: 'a',
      states: {
        a: {
          entry: [
            {
              type: 'xstate.emit',
              params: { event: { type: 'NOTIFICATION', message: 'hello' } },
            },
            {
              type: 'xstate.emit',
              params: { event: '{{ { "type": "PROGRESS", "value": context.progress } }}' },
            },
          ],
        },
      },
    });
  });

  test('custom action', () => {
    parseMachine({
      initial: 'a',
      states: {
        a: {
          entry: [
            { type: 'myCustomAction', params: { foo: 'bar' } },
          ],
        },
      },
    });
  });

  test('profile-prefixed action types are structural only', () => {
    parseMachine({
      initial: 'a',
      states: {
        a: {
          entry: [{ type: 'xstate.assign' }],
        },
      },
    });
  });

  // --- Tags ---

  test('state tags', () => {
    parseMachine({
      initial: 'loading',
      states: {
        loading: { tags: ['busy', 'pending'] },
        idle: { tags: ['ready'] },
      },
    });
  });

  // --- Output ---

  test('final state output', () => {
    parseMachine({
      initial: 'active',
      states: {
        active: {
          on: { DONE: { target: 'complete' } },
        },
        complete: {
          type: 'final',
          output: '{{ { "result": $context.data } }}',
        },
      },
    });
  });

  test('final state static output', () => {
    parseMachine({
      initial: 'active',
      states: {
        active: { on: { DONE: { target: 'complete' } } },
        complete: {
          type: 'final',
          output: { status: 'ok' },
        },
      },
    });
  });

  // --- Invoke extensions ---

  test('invoke with input, onSnapshot, timeout', () => {
    parseMachine({
      initial: 'processing',
      states: {
        processing: {
          invoke: [
            {
              id: 'worker',
              src: 'processOrder',
              input: '{{ { "orderId": $context.orderId } }}',
              timeout: 'PT30S',
              heartbeat: 'PT5S',
              onDone: { target: 'done' },
              onError: [
                { target: 'processing', guard: '{{ $context.retries < 3 }}' },
                { target: 'failed' },
              ],
              onSnapshot: {
                actions: [
                  {
                    type: 'xstate.assign',
                    params: { progress: '{{ $event.snapshot }}' },
                  },
                ],
              },
            },
          ],
        },
        done: { type: 'final' },
        failed: { type: 'final' },
      },
    });
  });

  test('state onDone transitions', () => {
    parseMachine({
      initial: 'parent',
      states: {
        parent: {
          initial: 'complete',
          states: {
            complete: { type: 'final' },
          },
          onDone: { target: 'done' },
        },
        done: { type: 'final' },
      },
    });
  });

  test('invoke with retry policy', () => {
    parseMachine({
      initial: 'loading',
      states: {
        loading: {
          invoke: [
            {
              src: 'fetchData',
              retry: { maxAttempts: 3, interval: 1000, backoff: 2 },
              onDone: { target: 'success' },
              onError: { target: 'failed' },
            },
          ],
        },
        success: { type: 'final' },
        failed: { type: 'final' },
      },
    });
  });

  test('invoke with retry ISO duration interval', () => {
    parseMachine({
      initial: 'loading',
      states: {
        loading: {
          invoke: [
            {
              src: 'fetchData',
              retry: { maxAttempts: 5, interval: 'PT5S', backoff: 1.5 },
              onDone: { target: 'success' },
            },
          ],
        },
        success: { type: 'final' },
      },
    });
  });

  test('profile invokes may define extra JSON fields', () => {
    parseMachine({
      initial: 'loading',
      states: {
        loading: {
          invoke: [
            {
              src: 'fetchData',
              profileData: { mode: 'fast' },
              onDone: { target: 'done' },
            },
          ],
        },
        done: { type: 'final' },
      },
    });
    assert.throws(() =>
      parseMachine({
        initial: 'loading',
        states: {
          loading: {
            invoke: [
              {
                src: 'fetchData',
                bad: () => undefined,
              },
            ],
          },
        },
      })
    );
  });

  // --- After with ISO 8601 ---

  test('after with ISO 8601 duration', () => {
    parseMachine({
      initial: 'waiting',
      states: {
        waiting: {
          after: {
            PT30S: { target: 'timeout' },
          },
        },
        timeout: { type: 'final' },
      },
    });
  });

  // --- History states ---

  test('history state', () => {
    parseMachine({
      initial: 'active',
      states: {
        active: {
          initial: 'a',
          states: {
            a: {},
            b: {},
            hist: { type: 'history', history: 'deep', target: 'a' },
          },
        },
      },
    });
  });

  // --- Parallel states ---

  test('parallel state', () => {
    parseMachine({
      type: 'parallel',
      states: {
        upload: {
          initial: 'idle',
          states: { idle: {}, uploading: {} },
        },
        download: {
          initial: 'idle',
          states: { idle: {}, downloading: {} },
        },
      },
    });
  });

  // --- Full integration ---

  test('full order flow machine', () => {
    parseMachine({
      version: '1.0.0',
      id: 'orderFlow',
      queryLanguage: 'jsonata',
      context: { retries: 0, result: null, items: [] },
      schemas: {
        input: {
          type: 'object',
          properties: { orderId: { type: 'string' } },
        },
        context: {
          retries: { type: 'number' },
          result: {},
          items: { type: 'array' },
        },
        events: {
          SUBMIT: {
            type: 'object',
            properties: {
              paymentMethod: { type: 'string' },
            },
          },
        },
      },
      initial: 'pending',
      states: {
        pending: {
          tags: ['idle'],
          entry: [
            {
              type: 'xstate.assign',
              params: { retries: '{{ $context.retries + 1 }}' },
            },
          ],
          on: {
            SUBMIT: {
              target: 'processing',
              guard: '{{ $context.items.length > 0 }}',
              actions: [
                {
                  type: 'xstate.log',
                  params: {
                    message: "{{ 'Order ' & $event.orderId }}",
                  },
                },
              ],
            },
            CANCEL: { target: 'cancelled' },
          },
        },
        processing: {
          invoke: [
            {
              id: 'processOrder',
              src: 'orderProcessor',
              input:
                "{{ { 'orderId': $context.orderId, 'items': $context.items } }}",
              timeout: 'PT30S',
              retry: { maxAttempts: 3, interval: 'PT2S', backoff: 2 },
              onDone: {
                target: 'complete',
                actions: [
                  {
                    type: 'xstate.assign',
                    params: { result: '{{ $event.output }}' },
                  },
                ],
              },
              onError: [
                {
                  target: 'pending',
                  guard: '{{ $context.retries < 3 }}',
                },
                { target: 'failed' },
              ],
              onSnapshot: {
                actions: [
                  {
                    type: 'xstate.assign',
                    params: { progress: '{{ $event.snapshot }}' },
                  },
                ],
              },
            },
          ],
        },
        complete: {
          type: 'final',
          output: "{{ { 'result': $context.result } }}",
        },
        cancelled: { type: 'final' },
        failed: { type: 'final' },
      },
    });
  });
});
