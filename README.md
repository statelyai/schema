# @statelyai/schema

A JSON specification for statecharts and workflows. Expressive enough for real-world state machines, with built-in expression evaluation and converters to [XState](https://stately.ai/docs).

## Install

```bash
npm install @statelyai/schema
```

## Quick example

```json
{
  "key": "order",
  "id": "order",
  "version": "1.0.0",
  "queryLanguage": "jmespath",
  "initial": "pending",
  "context": { "retries": 0 },
  "states": {
    "pending": {
      "on": {
        "SUBMIT": {
          "target": "processing",
          "guard": "{{ context.items }}"
        }
      }
    },
    "processing": {
      "invoke": [{
        "src": "processOrder",
        "retry": { "maxAttempts": 3, "interval": "PT2S", "backoff": 2 },
        "onDone": { "target": "complete" },
        "onError": [
          { "target": "pending", "guard": "{{ context.retries < 3 }}" },
          { "target": "failed" }
        ]
      }]
    },
    "complete": { "type": "final" },
    "failed": { "type": "final" }
  }
}
```

## Expressions

Values wrapped in `{{ }}` are evaluated at runtime using the configured `queryLanguage`:

| Language | Package | Sync | Example |
|---|---|---|---|
| `jmespath` | [jmespath](https://www.npmjs.com/package/jmespath) | Yes | `{{ context.count }}` |
| `jsonpath` | [jsonpath-plus](https://www.npmjs.com/package/jsonpath-plus) | Yes | `{{ $.context.count }}` |
| `jsonata` | [jsonata](https://www.npmjs.com/package/jsonata) | No (async) | `{{ context.count + 1 }}` |

Expressions receive `{ context, event }` as their data root.

The built-in `convertSpecToMachine()` and `convertSpecToConfig()` helpers require synchronous evaluation because they target XState's synchronous guards/actions. That means the built-in `jsonata` evaluator is not supported there; use `jmespath`, `jsonpath`, or pass a custom synchronous `evaluate` implementation.

Those helpers also do not implement invoke-level `timeout`, `heartbeat`, or declarative `retry`; if those fields are present, conversion fails fast instead of silently dropping them.

## Converting to XState

The `queryLanguage` in the spec is used to automatically resolve the expression evaluator:

```ts
import { convertSpecToMachine } from '@statelyai/schema';
import { transition, initialTransition } from 'xstate';

const machine = convertSpecToMachine(spec);
const [state] = initialTransition(machine);
const [next] = transition(machine, state, { type: 'SUBMIT' });
```

You can override the query language or provide a custom evaluator:

```ts
import { convertSpecToMachine, convertSpecToConfig } from '@statelyai/schema';
import type { ExpressionEvaluator } from '@statelyai/schema';

// Override query language:
const machine = convertSpecToMachine(spec, { queryLanguage: 'jsonpath' });

// Bring your own evaluator:
const evaluate: ExpressionEvaluator = (expression, data) => { /* ... */ };
const machine = convertSpecToMachine(spec, { evaluate });
```

## Schema validation

Zod schemas for runtime validation (requires `zod` peer dependency):

```ts
import { machineSchema } from '@statelyai/schema';

const result = machineSchema.safeParse(json);
```

JSON Schema files are also available for editor tooling:

```ts
import machineJsonSchema from '@statelyai/schema/machine.json';
```

## Specification

See the full [Stately Machine Specification](./spec.md) for formal definitions, conformance requirements, and detailed semantics.

Profile documents:
- [XState profile](./profiles/xstate.md)
- [Serverless Workflow profile](./profiles/serverlessworkflow.md)

Registered short profile names exported by the package currently include `xstate`
and `serverlessworkflow`.

## Examples

Converted Serverless Workflow examples are available in [`examples/serverlessworkflow`](./examples/serverlessworkflow). They use a Serverless Workflow profile URI and profile-specific invokes/actions while staying valid against the core machine schema.

### States

<!-- state node properties aligned with spec.md and src/machineSchema.ts -->

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Optional explicit global alias |
| `type` | `"parallel" \| "history" \| "final"` | State type (omit for normal states) |
| `initial` | `string` | Immediate child key to enter first |
| `states` | `Record<string, State>` | Child states |
| `on` | `Record<EventDescriptor, Transition>` | Event-driven transitions |
| `after` | `Record<string, Transition>` | Delayed transitions (ms or ISO 8601 duration) |
| `always` | `Transition` | Eventless transitions |
| `onDone` | `Transition` | Transitions taken when the state reaches done status |
| `entry` | `Action[]` | Actions run on state entry |
| `exit` | `Action[]` | Actions run on state exit |
| `invoke` | `Invoke[]` | Actors spawned on entry |
| `tags` | `string[]` | State tags |
| `output` | `expression \| JSON value` | Output for final states |
| `history` | `"shallow" \| "deep"` | History type (when `type: "history"`) |
| `target` | `string` | Default target for history states |
| `description` | `string` | Human-readable description |
| `meta` | `Record<string, JSON value>` | Arbitrary metadata |

### Machine (root state)

Extends State with:

<!-- root machine properties aligned with spec.md and src/machineSchema.ts -->

| Property | Type | Description |
|---|---|---|
| `key` | `string` | Required root key used as the canonical path root |
| `version` | `string` | Machine version |
| `profile` | `string` | Execution profile short name or URI |
| `queryLanguage` | `string` | Expression language |
| `context` | `Record<string, JSON value>` | Initial context values |
| `triggers` | `Trigger[]` | Optional machine-level trigger metadata |
| `schemas` | `{ input?, context?, events?, output? }` | JSON Schema definitions for input, context, event payloads, and output |

### Triggers

Triggers are optional root-level metadata objects. The core spec preserves them
but does not interpret them.

```json
{
  "triggers": [
    { "type": "webhook", "path": "/api/orders" },
    { "type": "cron", "schedule": "0 9 * * *" }
  ]
}
```

Each trigger must have a string `type` and may include additional JSON-valued
fields defined by a profile or runtime.

### Transitions

A transition is an object or an array of objects (for branching):

```json
{
  "on": {
    "NEXT": { "target": "step2" },

    "SUBMIT": {
      "target": "processing",
      "guard": "{{ context.isValid }}",
      "context": { "submitted": true },
      "actions": [{ "type": "xstate.log" }]
    },

    "CHECK": [
      { "target": "high", "guard": "{{ context.value > 100 }}" },
      { "target": "low" }
    ]
  }
}
```

| Property | Type | Description |
|---|---|---|
| `target` | `string \| string[]` | Target state reference(s) |
| `guard` | `expression \| NamedGuard` | Condition for taking transition |
| `context` | `Record<string, expression \| JSON value>` | Context assignments (equivalent to `core.assign`) |
| `actions` | `Action[]` | Actions to execute |
| `description` | `string` | Human-readable description |
| `meta` | `Record<string, JSON value>` | Arbitrary metadata |
| `order` | `number` | Explicit transition priority |
| `reenter` | `boolean` | Whether the transition re-enters target states |

### Actions

The core specification defines `core.assign` for keyed context assignment:

```json
{ "type": "core.assign", "assignments": { "count": "{{ context.count + 1 }}" } }
```

Other actions use `{ "type": string, "params"?: JSON value, ...profileFields }`; profiles or converters define their semantics and any additional JSON-valued fields.

The XState converter also recognizes `xstate.*` action types:

```json
{ "type": "xstate.raise", "params": { "event": { "type": "DONE" } } }
{ "type": "xstate.sendTo", "params": { "actorRef": "worker", "event": { "type": "PING" } } }
{ "type": "xstate.log", "params": { "message": "{{ context.status }}" } }
{ "type": "xstate.emit", "params": { "event": { "type": "NOTIFY" } } }
```

Other actions pass through to XState (resolved via `setup()`):

```json
{ "type": "trackAnalytics", "params": { "event": "checkout" } }
```

### Guards

Expression guard:
```json
{ "guard": "{{ context.count > 0 }}" }
```

Named guard (resolved via `setup()`):
```json
{ "guard": { "type": "isValid", "params": { "min": 5 }, "config": { "strict": true } } }
```

Profile-defined named guards may also include additional JSON-valued fields.

### Invoke

| Property | Type | Description |
|---|---|---|
| `src` | `string` | Actor source (resolved via `setup()`) |
| `id` | `string` | Actor ID |
| `input` | `expression \| JSON value` | Input passed to actor |
| `onDone` | `Transition` | Transition when actor completes |
| `onError` | `Transition` | Transition when actor fails |
| `onSnapshot` | `Transition` | Transition on actor snapshot |
| `timeout` | `string` | ISO 8601 duration |
| `heartbeat` | `string` | ISO 8601 duration |
| `retry` | `{ maxAttempts, interval?, backoff? }` | Retry policy on error |

Profile-defined invokes may also include additional JSON-valued fields.

### Delayed transitions (`after`)

Keys can be millisecond strings or ISO 8601 durations. The converter parses ISO 8601 to ms automatically:

```json
{
  "after": {
    "1000": { "target": "next" },
    "PT30S": { "target": "timeout" },
    "PT1H": { "target": "expired" }
  }
}
```

## License

MIT
