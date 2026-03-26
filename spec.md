# Stately Machine Specification

**Version:** 0.1.0 (Draft)

This document defines the Stately Machine Specification, a JSON-based format for describing state machines, statecharts, and workflows. The format is designed to be runtime-agnostic while being expressive enough for real-world state machines, including hierarchical states, parallel regions, guarded transitions, delayed transitions, actor invocation, and expression-based evaluation.

## Table of Contents

- [Overview](#overview)
- [Conformance](#conformance)
- [Machine](#machine)
- [States](#states)
- [Transitions](#transitions)
- [Actions](#actions)
- [Guards](#guards)
- [Invoke](#invoke)
- [Expressions](#expressions)
- [Context](#context)
- [Schemas](#schemas)
- [Delayed Transitions](#delayed-transitions)
- [Type Definitions](#type-definitions)

## Overview

A machine document is a JSON object that describes a state machine or statechart. The root object is a **machine**, which is a state with additional top-level properties (`version`, `queryLanguage`, `context`, `input`, `schemas`).

Machines are hierarchical: states can contain child states, forming a tree. Transitions move between states in response to events. Actions produce side effects on state entry, exit, or during transitions. Guards conditionally allow or block transitions. Expressions enable dynamic evaluation of guards, assignments, and action parameters.

### Design Principles

1. **JSON-native.** The entire machine is representable as JSON. No code, no functions, no host language dependencies.
2. **Expression-agnostic.** Expressions are opaque strings wrapped in `{{ }}` delimiters. The `queryLanguage` field declares which evaluator interprets them. The spec does not mandate a specific expression language.
3. **Statechart-complete.** The format supports the full statechart formalism: hierarchy, orthogonal regions, history states, eventless transitions, and delayed transitions.
4. **Metadata-extensible.** The `meta` property on states, transitions, and invocations carries arbitrary key-value data without polluting the core schema.

## Conformance

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

A conforming implementation:

- MUST accept any valid machine document as defined by this specification.
- MUST reject documents that violate required constraints (e.g., missing `src` on invoke).
- SHOULD support at least one expression language.
- MAY extend the format via `meta` properties without breaking conformance.

## Machine

The root object. A machine is a [state](#states) extended with the following properties:

| Property | Type | Required | Description |
|---|---|---|---|
| `version` | `string` | No | Machine version identifier. |
| `queryLanguage` | `string` | No | Expression language: `"jsonata"`, `"jmespath"`, or `"jsonpath"`. Implementations MAY support additional languages. |
| `context` | `Record<string, any>` | No | Initial context (extended state). Keys are property names, values are initial values. |
| `input` | `JSONSchema` | No | JSON Schema describing the expected input when the machine is instantiated. |
| `schemas` | `object` | No | JSON Schema definitions for context properties and event types. See [Schemas](#schemas). |

## States

A state represents a distinct mode or situation of the system.

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | No | Unique identifier for this state node. |
| `description` | `string` | No | Human-readable description. |
| `type` | `string` | No | One of `"parallel"`, `"history"`, `"final"`. Omit for atomic or compound states. |
| `initial` | `string` | No | Key of the initial child state. Required when the state has children and is not `"parallel"`. |
| `states` | `Record<string, State>` | No | Child states. A state with children is a **compound state**. |
| `on` | `Record<string, Transition>` | No | Event-driven transitions. Keys are event names. |
| `after` | `Record<string, Transition>` | No | Delayed transitions. Keys are delay values. See [Delayed Transitions](#delayed-transitions). |
| `always` | `Transition` | No | Eventless transitions evaluated immediately on state entry and after every microstep. |
| `entry` | `Action[]` | No | Actions executed when this state is entered. |
| `exit` | `Action[]` | No | Actions executed when this state is exited. |
| `invoke` | `Invoke[]` | No | Actors to spawn when this state is entered. See [Invoke](#invoke). |
| `tags` | `string[]` | No | Tags for categorizing this state. |
| `output` | `expression \| any` | No | Output data produced when this final state is reached. Only meaningful when `type` is `"final"`. |
| `meta` | `Record<string, any>` | No | Arbitrary metadata. |

### State Types

**Atomic state.** A state with no `states` property and no `type`. The simplest state.

**Compound state.** A state with `states` and an `initial` property. Exactly one child state is active at any time. The `initial` child is entered when the compound state is entered without a specific target.

**Parallel state.** A state with `type: "parallel"` and `states`. All child regions are active simultaneously. The state is complete when all child regions have reached a final state.

**Final state.** A state with `type: "final"`. Represents completion. When entered, the parent compound state is considered "done", triggering any `onDone` transitions on invoke configurations or parent states. A final state MUST NOT have `on`, `after`, `always`, or `states` properties.

**History state.** A state with `type: "history"`. Records and restores the previously active child state of its parent.

| Property | Type | Description |
|---|---|---|
| `history` | `"shallow" \| "deep"` | `"shallow"` restores the immediate child. `"deep"` restores the full nested state configuration. |
| `target` | `string` | Default target if no history exists (first entry). |

## Transitions

A transition describes a state change. The value of an event in `on`, a delay in `after`, or the `always` property is either a single transition object or an array of transition objects (for branching).

When an array is provided, the transitions are evaluated in order. The first transition whose guard evaluates to true (or has no guard) is taken.

| Property | Type | Required | Description |
|---|---|---|---|
| `target` | `string` | No | Target state key. If omitted, the transition is a self-transition (re-enters the current state if actions or context are specified). |
| `guard` | `expression \| NamedGuard` | No | Condition for taking this transition. See [Guards](#guards). |
| `context` | `Record<string, expression \| any>` | No | Context assignments applied when this transition is taken. Each entry is equivalent to an `xstate.assign` action. |
| `actions` | `Action[]` | No | Actions executed when this transition is taken. |
| `description` | `string` | No | Human-readable description of this transition. |
| `meta` | `Record<string, any>` | No | Arbitrary metadata. |
| `order` | `number` | No | Explicit priority. Lower numbers are evaluated first. When omitted, transitions are evaluated in document order. |

### Transition Evaluation Order

1. **Eventless transitions** (`always`) are evaluated after every microstep — after entry actions complete and after any event is processed.
2. **Event transitions** (`on`) are evaluated when a matching event is received.
3. **Delayed transitions** (`after`) are scheduled when the state is entered and cancelled when the state is exited.
4. Within each category, transitions in an array are evaluated in order (or by `order` if specified).
5. The first transition whose guard passes (or has no guard) is taken. Remaining transitions are skipped.

## Actions

Actions are side effects. They are executed on state entry (`entry`), state exit (`exit`), or during a transition (`actions`).

An action is an object with a `type` string and optional `params`.

### Built-in Actions

Built-in actions are prefixed with `xstate.` to distinguish them from custom actions.

#### `xstate.assign`

Updates the machine's context.

```json
{
  "type": "xstate.assign",
  "params": {
    "count": "{{ context.count + 1 }}",
    "name": "static value"
  }
}
```

Each key in `params` is a context property. Values MAY be expressions (evaluated at runtime) or static values.

#### `xstate.raise`

Sends an event to the machine itself, placed on the internal event queue.

```json
{
  "type": "xstate.raise",
  "params": { "event": { "type": "RETRY" } }
}
```

The `event` value MAY be an expression.

#### `xstate.sendTo`

Sends an event to another actor.

```json
{
  "type": "xstate.sendTo",
  "params": {
    "actorRef": "workerActor",
    "event": { "type": "PROCESS" },
    "delay": 1000
  }
}
```

| Param | Type | Required | Description |
|---|---|---|---|
| `actorRef` | `expression \| string` | Yes | Target actor reference. |
| `event` | `expression \| any` | Yes | Event to send. |
| `delay` | `expression \| string \| number` | No | Delay in ms or ISO 8601 duration. |

#### `xstate.log`

Logs a message.

```json
{ "type": "xstate.log", "params": { "message": "{{ context.status }}" } }
```

`params` is optional. If omitted, logs without a message.

#### `xstate.emit`

Emits an event to subscribers/observers of the machine.

```json
{
  "type": "xstate.emit",
  "params": { "event": { "type": "PROGRESS", "value": 50 } }
}
```

The `event` value MAY be an expression.

### Custom Actions

Any action with a `type` that does not start with `xstate.` is a custom action. Custom actions are passed through to the runtime as-is and MUST be resolved by the execution environment.

```json
{ "type": "trackAnalytics", "params": { "category": "checkout" } }
```

## Guards

Guards are conditions that determine whether a transition is taken.

### Expression Guard

A string expression wrapped in `{{ }}` delimiters. The expression MUST evaluate to a truthy or falsy value.

```json
{ "guard": "{{ context.count > 0 }}" }
```

### Named Guard

An object with a `type` and optional `params`. Named guards are resolved by the execution environment.

```json
{ "guard": { "type": "isValid", "params": { "min": 5 } } }
```

## Invoke

An invoke configuration spawns an actor (child process, service, promise, etc.) when its parent state is entered. The actor is stopped when the parent state is exited.

| Property | Type | Required | Description |
|---|---|---|---|
| `src` | `string` | Yes | Actor source identifier, resolved by the execution environment. |
| `id` | `string` | No | Unique ID for this actor instance. |
| `input` | `expression \| any` | No | Input passed to the actor on creation. |
| `onDone` | `Transition` | No | Transition taken when the actor completes successfully. |
| `onError` | `Transition` | No | Transition taken when the actor fails. |
| `onSnapshot` | `Transition` | No | Transition taken when the actor emits a state snapshot. |
| `timeout` | `string` | No | ISO 8601 duration. If the actor has not completed within this duration, it is considered failed. |
| `heartbeat` | `string` | No | ISO 8601 duration. If no snapshot is received within this interval, the actor is considered failed. |
| `retry` | `RetryPolicy` | No | Retry policy applied when the actor fails. See below. |
| `meta` | `Record<string, any>` | No | Arbitrary metadata. |

### Retry Policy

Declarative retry configuration for failed invocations.

| Property | Type | Required | Description |
|---|---|---|---|
| `maxAttempts` | `integer` | Yes | Maximum number of retry attempts (minimum 1). |
| `interval` | `number \| string` | No | Delay between retries in ms (number) or ISO 8601 duration (string). |
| `backoff` | `number` | No | Multiplier applied to the interval after each retry attempt. |

## Expressions

Expressions are dynamic values evaluated at runtime. They are strings wrapped in `{{ }}` delimiters:

```
{{ context.count + 1 }}
```

The `queryLanguage` property on the machine root declares which expression language is used. The specification defines three standard languages:

| Language | Description |
|---|---|
| `jsonata` | [JSONata](https://jsonata.org/) — expressive JSON query and transformation. |
| `jmespath` | [JMESPath](https://jmespath.org/) — JSON query language. |
| `jsonpath` | [JSONPath Plus](https://github.com/JSONPath-Plus/JSONPath) — XPath-like JSON traversal. |

Implementations MAY support additional expression languages.

### Evaluation Context

All expressions receive a data object with two properties:

| Property | Description |
|---|---|
| `context` | The current machine context (extended state). |
| `event` | The current event being processed. |

### Where Expressions Are Allowed

Expressions MAY appear in:

- `xstate.assign` params values
- `xstate.raise` event
- `xstate.sendTo` actorRef, event, delay
- `xstate.log` message
- `xstate.emit` event
- Guard conditions (expression guards)
- Invoke `input`
- State `output`
- Transition `context` values

A value is an expression if and only if it is a string matching the pattern `^{{[\s\S]*}}$`.

## Context

Context represents the extended state (quantitative data) of a machine. It is a key-value record declared at the machine root:

```json
{
  "context": {
    "count": 0,
    "items": [],
    "user": null
  }
}
```

Context is updated via:

1. **`xstate.assign` actions** — explicitly listed in `entry`, `exit`, or transition `actions`.
2. **Transition `context` property** — shorthand that appends an assign action. `"context": { "count": "{{ context.count + 1 }}" }` is equivalent to including `{ "type": "xstate.assign", "params": { "count": "{{ context.count + 1 }}" } }` in the transition's actions.

When both `actions` and `context` are present on a transition, the `context` assignment is appended after explicit actions.

## Schemas

Optional JSON Schema definitions for context and events, used for validation and tooling.

```json
{
  "schemas": {
    "context": {
      "count": { "type": "number" },
      "name": { "type": "string" }
    },
    "events": {
      "INCREMENT": {
        "amount": { "type": "number" }
      }
    }
  }
}
```

## Delayed Transitions

The `after` property defines transitions that are scheduled when the state is entered. Keys are delay values; values are transitions.

Delay keys MAY be:

- **Millisecond strings**: `"1000"` (1 second)
- **ISO 8601 durations**: `"PT30S"` (30 seconds), `"PT1M"` (1 minute), `"PT1H30M"` (1 hour 30 minutes), `"P1D"` (1 day)

```json
{
  "after": {
    "PT30S": { "target": "timeout" },
    "1000": { "target": "retry" }
  }
}
```

When the state is exited (by any transition), all pending delayed transitions MUST be cancelled.

## Type Definitions

### Transition

```
Transition = TransitionObject | TransitionObject[]
```

### TransitionObject

```
{
  target?: string
  guard?: string | { type: string, params?: Record<string, any> }
  context?: Record<string, any>
  actions?: Action[]
  description?: string
  meta?: Record<string, any>
  order?: number
}
```

### Action

```
{
  type: string
  params?: Record<string, any>
}
```

### Invoke

```
{
  src: string
  id?: string
  input?: any
  onDone?: Transition
  onError?: Transition
  onSnapshot?: Transition
  timeout?: string
  heartbeat?: string
  retry?: { maxAttempts: number, interval?: number | string, backoff?: number }
  meta?: Record<string, any>
}
```

### State

```
{
  id?: string
  description?: string
  type?: "parallel" | "history" | "final"
  initial?: string
  states?: Record<string, State>
  on?: Record<string, Transition>
  after?: Record<string, Transition>
  always?: Transition
  entry?: Action[]
  exit?: Action[]
  invoke?: Invoke[]
  tags?: string[]
  output?: any
  history?: "shallow" | "deep"
  target?: string
  meta?: Record<string, any>
}
```

### Machine

```
State & {
  version?: string
  queryLanguage?: "jsonata" | "jmespath" | "jsonpath"
  context?: Record<string, any>
  input?: JSONSchema
  schemas?: {
    context?: Record<string, JSONSchema>
    events?: Record<string, Record<string, JSONSchema>>
  }
}
```
