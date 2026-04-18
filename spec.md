# Stately Machine Specification

**Version:** 0.1.0 (Draft)

This document defines a JSON-based format for describing state machines, statecharts, and workflows. The core format is runtime-agnostic: it defines document structure, references, transitions, expressions, schemas, and extension points, but it does not define built-in actions, built-in named guards, or actor implementations.

## Overview

A machine document is a JSON object. The root object is a **machine**, which is a state node with additional machine-level fields such as `key`, `version`, `profile`, `queryLanguage`, `context`, and `schemas`.

Machines are hierarchical. States can contain child states, transitions move between states, actions describe side effects, guards conditionally select transitions, invokes describe child actors, and expressions describe runtime-computed values.

### Design Principles

1. **JSON-native.** Documents MUST be representable as JSON. Freeform data fields contain JSON values only.
2. **Runtime-agnostic core.** The core spec defines structure and common statechart concepts. Execution details for action names, named guard names, and actor sources are profile-defined.
3. **Profile-extensible.** A machine MAY declare a profile that gives semantics to `Action.type`, named `Guard.type`, and `Invoke.src`.
4. **Expression-agnostic.** Expressions are strings wrapped in `{{ }}`. `queryLanguage` declares which expression language interprets them.
5. **Permissive first pass.** This draft favors structural validity and local invariants over deep logical validation. Recognized but vestigial constructs are generally warnings rather than errors.

## Conformance

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as described in RFC 2119.

A conforming implementation:

- MUST accept any well-formed machine document as defined by this specification.
- MUST reject malformed JSON and documents that violate structural error conditions.
- MUST reject unknown properties on closed core objects.
- SHOULD report warnings for recognized but vestigial, ignored, or suspicious constructs.
- MAY reject documents that are well-formed but unsupported by the implementation, such as documents using an unsupported profile or query language.
- MAY preserve and round-trip unknown profile-defined semantics when it can do so without changing core meaning.

### Errors And Warnings

An **error** means the document is not well-formed. A **warning** means the document is well-formed, but contains content that may be ignored, redundant, or suspicious.

Errors include:

- missing the required root `key`
- unknown fields on closed objects
- malformed event descriptors
- invalid local `initial` references
- duplicate explicit IDs
- collisions between explicit IDs and canonical path IDs
- unknown short profile names

Warnings include:

- `initial` on a parallel state
- transition fields on final states if an implementation ignores them
- state fields on history states that an implementation ignores
- other recognized but vestigial constructs

Redundant encodings such as `target: []`, `target: ["foo"]`, duplicate target entries, and empty transition arrays are well-formed and do not require warnings.

## JSON Values

A **JSON value** is one of: `null`, boolean, number, string, array of JSON values, or object whose property values are JSON values.

Unless a field is specifically described as a JSON Schema document, expression, or another spec-defined object, freeform values in this specification are JSON values.

## Machine

A machine is a state node with additional machine-level fields.

| Property | Type | Required | Description |
|---|---|---|---|
| `key` | `string` | Yes | Root key used as the first canonical path segment. MUST be non-empty, MUST NOT contain `.`, and MUST NOT start with `#`. |
| `version` | `string` | No | Opaque machine version identifier. |
| `profile` | `string` | No | Execution profile short name or URI. |
| `queryLanguage` | `string` | No | Expression language. Standard values are `jsonata`, `jmespath`, and `jsonpath`; implementations MAY support additional values. |
| `context` | `Record<string, JSON value>` | No | Initial context. |
| `schemas` | `Schemas` | No | JSON Schema declarations for input, context, events, and output. |

The root machine is also a state node. Unless otherwise stated, state-node fields such as `id`, `description`, `type`, `initial`, `states`, `on`, `after`, `always`, `onDone`, `entry`, `exit`, `invoke`, `tags`, `output`, and `meta` MAY appear on the root.

The only required root field is `key`. A machine with only `key` is well-formed.

## Profiles

The core spec defines no built-in action names, named guard names, or actor source names.

A profile MAY define semantics for:

- `Action.type`
- named `Guard.type`
- `Invoke.src`

A profile MUST NOT redefine the core document shape, reference grammar, event descriptor grammar, or `initial` semantics. In this version, profile-specific behavior is expressed through names and `params`; profile-specific extra fields are not part of the core format.

`profile` is a single optional string. Its value MUST be either:

- a registered short profile name, such as `xstate`
- a URI profile identifier

Unknown short profile names are errors. Unknown URI profile identifiers are well-formed but MAY be unsupported by an implementation.

### Registered Profiles

| Short name | Canonical URI | Reference |
|---|---|---|
| `xstate` | Deferred | Deferred XState profile document |

## States

A state represents a distinct mode or situation of the machine.

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | No | Optional explicit global alias. MUST NOT start with `#`. |
| `description` | `string` | No | Human-readable description. |
| `type` | `"parallel" \| "history" \| "final"` | No | State type. Omit for atomic or compound states. |
| `initial` | `string` | No | Key of an immediate child state. If present, it MUST name a key in this state's `states` object. |
| `states` | `Record<string, State>` | No | Child states. Child object keys are canonical path segments. |
| `on` | `Record<EventDescriptor, Transition>` | No | Event-driven transitions. |
| `after` | `Record<string, Transition>` | No | Delayed transitions. Keys are delay values. |
| `always` | `Transition` | No | Eventless transitions. |
| `onDone` | `Transition` | No | Transitions taken when this state reaches done status. |
| `entry` | `Action[]` | No | Actions executed on state entry. |
| `exit` | `Action[]` | No | Actions executed on state exit. |
| `invoke` | `Invoke[]` | No | Actors spawned while the state is active. |
| `tags` | `string[]` | No | Tags for categorizing this state. Duplicates are well-formed. |
| `output` | `expression \| JSON value` | No | Output associated with final machine completion. |
| `history` | `"shallow" \| "deep"` | No | History mode for history states. |
| `target` | `StateReference` | No | Default target for history states. |
| `meta` | `Record<string, JSON value>` | No | Semantically opaque metadata. |

### State Types

**Atomic state.** A state with no child `states`.

**Compound state.** A state with child `states`. If `initial` is present, it selects an immediate child key.

**Parallel state.** A state with `type: "parallel"`. Its child states are orthogonal regions. An `initial` field on a parallel state is vestigial and SHOULD produce a warning.

**Final state.** A state with `type: "final"`. It represents completion of its parent state, or machine completion when the root itself is final or the final state participates in completing the root. Transition fields on final states MAY be ignored and SHOULD produce warnings if ignored.

**History state.** A state with `type: "history"`. It records and restores the previously active child state of its parent. Recognized fields that are meaningless for a history state MAY be ignored and SHOULD produce warnings if ignored.

## Reference Resolution

Every state has a canonical path ID.

- The root machine's canonical path ID is its `key`.
- A child state's canonical path ID is its parent's canonical path ID, followed by `.`, followed by the key used for that child in the parent's `states` object.
- Nested state objects do not have a `key` field; their keys are implicit from the containing `states` object.

Explicit `id` values are optional aliases. Explicit IDs MUST be globally unique and MUST NOT collide with any canonical path ID. Root `id`, when present, participates in the same rules.

A `StateReference` is a string using one of these forms:

- `#ref`: global reference by explicit `id` or canonical path ID
- `.child` or `.child.grandchild`: descendant of the current source state
- `sibling` or `sibling.grandchild`: state in the containing parent scope

There is no `..` syntax. Upward or remote targets SHOULD use `#...`.

When resolving `#ref`, `ref` is looked up in the global namespace of explicit IDs and canonical path IDs. If a reference is ambiguous because of an ID collision, the document is not well-formed.

`initial` is not a general state reference. It is a local child-key selector only.

## Events And Descriptors

Every event processed by a machine MUST be an object with a string `type` property. Transition matching uses only `event.type`; guards and actions MAY inspect other event fields.

An **event type** is a concrete runtime string, such as `feedback.good`.

An **event descriptor** is a key in an `on` object. Descriptors are case-sensitive and use plain dot-separated strings. There is no escape syntax.

Descriptor forms:

- exact descriptor: `feedback.good`
- catch-all wildcard: `*`
- partial wildcard: `feedback.*`

Partial wildcards are valid only as a final segment after a dot. Invalid descriptors include `mouse*`, `*.click`, `mouse.*.click`, and `mouse.*.*`.

`feedback.*` matches both `feedback` and descendant event types such as `feedback.good`. Exact descriptors are considered before partial wildcards, more specific partial wildcards are considered before less specific partial wildcards, and `*` is considered last.

## Transitions

A transition is either a transition object or an array of transition objects:

```
Transition = TransitionObject | TransitionObject[]
```

Transition arrays MAY be empty.

| Property | Type | Required | Description |
|---|---|---|---|
| `target` | `StateReference \| StateReference[]` | No | Target state reference or references. `[]` is equivalent to no target. |
| `guard` | `expression \| NamedGuard` | No | Condition for selecting the transition. |
| `context` | `Record<string, expression \| JSON value>` | No | Context assignments applied when this transition is selected. |
| `actions` | `Action[]` | No | Actions executed when this transition is selected. |
| `reenter` | `boolean` | No | Whether selected target states are re-entered. Defaults to `false`. |
| `description` | `string` | No | Human-readable description. |
| `meta` | `Record<string, JSON value>` | No | Semantically opaque metadata. |
| `order` | `number` | No | Explicit priority among transition alternatives. Lower values are considered first. |

Target arrays are intended for transitions that enter multiple orthogonal regions. This draft does not require validators to prove full multi-target configuration validity.

Targetless transitions preserve the active state configuration. Empty transition objects are well-formed and act as event-consuming forbidden transitions when selected.

`order` affects only transition selection among alternatives. `reenter` affects only execution after a transition is selected.

## Transition Selection

For an event:

1. Starting from the deepest active states and walking toward ancestors, find matching event descriptors.
2. Within a state, prefer exact descriptors, then more specific partial wildcards, then less specific partial wildcards, then `*`.
3. Normalize a single transition object to a one-element transition array.
4. Sort transition alternatives by `order` when present, preserving document order otherwise.
5. Select the first transition whose guard is absent or truthy.

Eventless `always` transitions and delayed `after` transitions use the same transition object selection rules, but they are triggered by state entry/microsteps or delays rather than event descriptor matching.

## Reentry

Selected transitions with `reenter: true` re-enter their target states according to ordinary statechart exit/entry semantics. This includes stopping actors in exited states and starting actors in entered states.

Selected transitions with `reenter` absent or `false` use normal least-common-ancestor transition semantics and do not forcibly re-enter unaffected ancestors.

If a self-targeting transition is selected, it does not restart the state unless `reenter: true` is set.

`reenter: true` with no target is structurally well-formed but vestigial.

## Done Transitions

The `onDone` property defines transitions taken when a state reaches done status.

- A compound state reaches done status when its active child state is final.
- A parallel state reaches done status when all child regions have reached done status.
- A final state signals completion to its parent.
- The root machine completes when the root itself is final or when its active configuration reaches root completion.

Machine output is the output associated with the final configuration that completes the machine. `schemas.output`, when present, describes the machine output contract. This draft intentionally does not fully specify output-completeness validation for all nested completion structures.

## Actions

An action is a closed object:

```
{
  type: string
  params?: JSON value
}
```

The core spec defines no built-in action names. The `type` selects behavior according to the active profile or implementation. `params` is opaque profile-defined data.

## Guards

Guards determine whether a transition alternative is selected.

An expression guard is an expression string:

```json
"{{ context.count > 0 }}"
```

A named guard is a closed object:

```
{
  type: string
  params?: JSON value
}
```

The core spec defines no built-in named guard names. Profiles MAY define semantics for named guard `type` values and their `params`.

## Invoke

An invoke configuration is a closed object that describes an actor spawned while the containing state is active.

| Property | Type | Required | Description |
|---|---|---|---|
| `src` | `string` | Yes | Actor source name. Semantics are profile-defined. |
| `id` | `string` | No | Actor instance ID. |
| `input` | `expression \| JSON value` | No | Input passed to the actor. |
| `onDone` | `Transition` | No | Transition when the actor completes successfully. |
| `onError` | `Transition` | No | Transition when the actor fails. |
| `onSnapshot` | `Transition` | No | Transition when the actor emits a snapshot. |
| `timeout` | `string` | No | ISO 8601 duration for invocation timeout. |
| `heartbeat` | `string` | No | ISO 8601 duration for heartbeat interval. |
| `retry` | `RetryPolicy` | No | Retry policy for failed invocations. |
| `meta` | `Record<string, JSON value>` | No | Semantically opaque metadata. |

### Retry Policy

```
{
  maxAttempts: integer
  interval?: number | string
  backoff?: number
}
```

`interval` is a delay in milliseconds or an ISO 8601 duration string.

## Expressions

Expressions are dynamic values evaluated at runtime. They are strings wrapped in `{{ }}` delimiters:

```
{{ context.count + 1 }}
```

`queryLanguage` declares which expression language is used. Standard values are:

| Language | Description |
|---|---|
| `jsonata` | JSONata expression language. |
| `jmespath` | JMESPath expression language. |
| `jsonpath` | JSONPath expression language. |

Implementations MAY support additional query language strings.

All expressions receive a data object with at least:

| Property | Description |
|---|---|
| `context` | Current machine context. |
| `event` | Current event being processed. |

Expressions MAY appear in:

- guard expressions
- transition `context` values
- invoke `input`
- state `output`
- profile-defined action or guard `params`

A value is an expression if and only if it is a string matching `^{{[\s\S]*}}$`.

## Context

Context is the extended state of a machine. It is a root-level record of JSON values:

```json
{
  "context": {
    "count": 0,
    "items": [],
    "user": null
  }
}
```

Transition `context` is a keyed assignment record. Each value MAY be static JSON or an expression.

## Schemas

`schemas` is an optional closed object containing JSON Schema documents.

| Property | Type | Description |
|---|---|---|
| `input` | `JSONSchema` | Schema for the machine input value. |
| `context` | `Record<string, JSONSchema>` | Schemas for individual context property values. |
| `events` | `Record<EventType, JSONSchema>` | Schemas for event payloads, excluding the required `type` field. Keys MUST be exact event types, not wildcard descriptors. |
| `output` | `JSONSchema` | Schema for the machine output value. |

`schemas.events` keys MUST NOT contain wildcard descriptors such as `*` or `feedback.*`.

When `schemas.events[event.type]` exists, the event payload excluding `type` is validated against that schema. Additional payload fields are allowed or rejected according to the JSON Schema itself.

This version defines `schemas.*` values as JSON Schema documents. Alternative schema languages are deferred.

## Delayed Transitions

The `after` property defines transitions scheduled when the state is entered. Keys are delay values; values are transitions.

Delay keys MAY be:

- millisecond strings, such as `"1000"`
- ISO 8601 durations, such as `"PT30S"`, `"PT1M"`, `"PT1H30M"`, or `"P1D"`

When a state exits, pending delayed transitions for that state MUST be cancelled.

## Closed Objects

The following core objects are closed. Unknown properties are errors:

- `Machine`
- `State`
- `TransitionObject`
- `Action`
- named `Guard`
- `Invoke`
- `RetryPolicy`
- `Schemas`

Embedded JSON Schema documents are exempt from the closed-object rule and are governed by JSON Schema.

## Type Definitions

```
JSONValue =
  null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue }

StateReference = string

EventDescriptor = string

Transition = TransitionObject | TransitionObject[]

TransitionObject = {
  target?: StateReference | StateReference[]
  guard?: string | { type: string, params?: JSONValue }
  context?: Record<string, string | JSONValue>
  actions?: Action[]
  reenter?: boolean
  description?: string
  meta?: Record<string, JSONValue>
  order?: number
}

Action = {
  type: string
  params?: JSONValue
}

Invoke = {
  src: string
  id?: string
  input?: string | JSONValue
  onDone?: Transition
  onError?: Transition
  onSnapshot?: Transition
  timeout?: string
  heartbeat?: string
  retry?: { maxAttempts: number, interval?: number | string, backoff?: number }
  meta?: Record<string, JSONValue>
}

State = {
  id?: string
  description?: string
  type?: "parallel" | "history" | "final"
  initial?: string
  states?: Record<string, State>
  on?: Record<EventDescriptor, Transition>
  after?: Record<string, Transition>
  always?: Transition
  onDone?: Transition
  entry?: Action[]
  exit?: Action[]
  invoke?: Invoke[]
  tags?: string[]
  output?: string | JSONValue
  history?: "shallow" | "deep"
  target?: StateReference
  meta?: Record<string, JSONValue>
}

Machine = State & {
  key: string
  version?: string
  profile?: string
  queryLanguage?: string
  context?: Record<string, JSONValue>
  schemas?: {
    input?: JSONSchema
    context?: Record<string, JSONSchema>
    events?: Record<string, JSONSchema>
    output?: JSONSchema
  }
}
```
