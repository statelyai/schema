# XState Profile

This document defines the `xstate` profile for the Stately Machine Specification.

## Identifier

- Short name: `xstate`
- Canonical URI: `https://stately.ai/specifications/xstate`

## Purpose

The `xstate` profile defines action and invoke semantics intended for conversion to
and execution by [XState](https://stately.ai/docs/xstate).

The core specification still applies. This profile only defines meanings for
profile-scoped action types and invoke sources.

The root-level `triggers` field is also preserved when converting a machine to an
XState config object. XState-oriented runtimes MAY use those trigger objects as
metadata, but this profile does not define their execution semantics.

## Support Boundary

This repository currently provides built-in XState-oriented support through
`convertSpecToConfig()`, `convertSpecToMachine()`, and the XState support helper
APIs.

That built-in support currently means:

- machines with no declared profile are accepted
- machines declaring the `xstate` profile are accepted by short name or canonical URI
- built-in query language support is limited to synchronous evaluators such as `jmespath` and `jsonpath`
- `jsonata` requires a caller-provided synchronous `evaluate` function
- invoke-level `timeout`, `heartbeat`, and `retry` semantics are rejected by the built-in converter

The converter and support helpers are the repository's executable support
boundary for this profile.

## Actions

The profile defines these action types:

- `xstate.raise`
- `xstate.sendTo`
- `xstate.log`
- `xstate.emit`

`core.assign` remains the standard built-in assignment action and is not redefined
by this profile.

### `xstate.raise`

Raises an event back into the current machine.

```json
{
  "type": "xstate.raise",
  "params": {
    "event": { "type": "DONE" }
  }
}
```

`params.event` MAY be a static event object or an expression that evaluates to an
event object.

### `xstate.sendTo`

Sends an event to another actor.

```json
{
  "type": "xstate.sendTo",
  "params": {
    "actorRef": "worker",
    "event": { "type": "PING" },
    "delay": 1000
  }
}
```

- `actorRef` identifies the target actor
- `event` is the event to send
- `delay`, when present, is a delay value supported by the target runtime

### `xstate.log`

Logs a message.

```json
{
  "type": "xstate.log",
  "params": {
    "message": "hello"
  }
}
```

`params.message` MAY be static or expression-based. `params` MAY be omitted.

### `xstate.emit`

Emits an external event.

```json
{
  "type": "xstate.emit",
  "params": {
    "event": { "type": "NOTIFY" }
  }
}
```

`params.event` MAY be static or expression-based.

## Named Guards

Named guards are passed through using:

```json
{
  "type": "guardName",
  "params": { "threshold": 5 },
  "config": { "strict": true }
}
```

The XState profile does not reserve specific named guard types. Implementations
typically resolve them through XState `setup({ guards })`. Because named guard
objects are open-shaped, implementations MAY also use additional JSON-valued
fields beyond `params`.

## Invokes

`Invoke.src` is interpreted as an XState actor source identifier.

```json
{
  "src": "fetchUser"
}
```

The profile does not currently define standard extra invoke fields. Because the
core invoke shape is open, implementations MAY accept additional JSON-valued
invoke fields and pass them through to the underlying runtime.

## Conversion Notes

This repository's XState converter:

- supports `core.assign`
- supports the action types listed above
- passes named guards through
- passes `src` through for invokes
- rejects `timeout`, `heartbeat`, and `retry` invoke semantics because they
  require a runtime wrapper that is not implemented by the converter
