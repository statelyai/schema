# @statelyai/schema

A JSON specification for statecharts and workflows. Expressive enough for real-world state machines, with built-in expression evaluation and converters to [XState](https://stately.ai/docs).

## Install

```bash
npm install @statelyai/schema
```

## Quick example

```json
{
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
const machine = convertSpecToMachine(spec, { queryLanguage: 'jsonata' });

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

### States

| Property | Type | Description |
|---|---|---|
| `id` | `string` | State node ID |
| `type` | `"parallel" \| "history" \| "final"` | State type (omit for normal states) |
| `initial` | `string` | Initial child state |
| `states` | `Record<string, State>` | Child states |
| `on` | `Record<string, Transition>` | Event-driven transitions |
| `after` | `Record<string, Transition>` | Delayed transitions (ms or ISO 8601 duration) |
| `always` | `Transition` | Eventless transitions |
| `entry` | `Action[]` | Actions run on state entry |
| `exit` | `Action[]` | Actions run on state exit |
| `invoke` | `Invoke[]` | Actors spawned on entry |
| `tags` | `string[]` | State tags |
| `output` | `expression \| any` | Output for final states |
| `history` | `"shallow" \| "deep"` | History type (when `type: "history"`) |
| `target` | `string` | Default target for history states |
| `description` | `string` | Human-readable description |
| `meta` | `Record<string, any>` | Arbitrary metadata |

### Machine (root state)

Extends State with:

| Property | Type | Description |
|---|---|---|
| `version` | `string` | Machine version |
| `queryLanguage` | `"jsonata" \| "jmespath" \| "jsonpath"` | Expression language |
| `context` | `Record<string, any>` | Initial context values |
| `input` | `JSONSchema` | JSON Schema for machine input |
| `schemas` | `{ context?, events? }` | JSON Schema definitions for context and events |

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
| `target` | `string` | Target state |
| `guard` | `expression \| NamedGuard` | Condition for taking transition |
| `context` | `Record<string, expression \| any>` | Context assignments (appended as `xstate.assign`) |
| `actions` | `Action[]` | Actions to execute |
| `description` | `string` | Human-readable description |
| `meta` | `Record<string, any>` | Arbitrary metadata |
| `order` | `number` | Explicit transition priority |

### Actions

Built-in actions are prefixed with `xstate.`:

```json
{ "type": "xstate.assign", "params": { "count": "{{ context.count + 1 }}" } }
{ "type": "xstate.raise", "params": { "event": { "type": "DONE" } } }
{ "type": "xstate.sendTo", "params": { "actorRef": "worker", "event": { "type": "PING" } } }
{ "type": "xstate.log", "params": { "message": "{{ context.status }}" } }
{ "type": "xstate.emit", "params": { "event": { "type": "NOTIFY" } } }
```

Custom actions pass through to xstate (resolved via `setup()`):

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
{ "guard": { "type": "isValid", "params": { "min": 5 } } }
```

### Invoke

| Property | Type | Description |
|---|---|---|
| `src` | `string` | Actor source (resolved via `setup()`) |
| `id` | `string` | Actor ID |
| `input` | `expression \| any` | Input passed to actor |
| `onDone` | `Transition` | Transition when actor completes |
| `onError` | `Transition` | Transition when actor fails |
| `onSnapshot` | `Transition` | Transition on actor snapshot |
| `timeout` | `string` | ISO 8601 duration |
| `heartbeat` | `string` | ISO 8601 duration |
| `retry` | `{ maxAttempts, interval?, backoff? }` | Retry policy on error |

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
