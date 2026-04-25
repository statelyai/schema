# Serverless Workflow Profile

This document describes the profile used by the converted Serverless Workflow
examples in this repository.

## Identifier

- Short name: `serverlessworkflow`
- Canonical URI: `https://serverlessworkflow.io/specification/1.0.3`

This document is informative for the current repository. It describes how the
example translations use the Stately Machine Specification; it does not claim to
be the upstream Serverless Workflow specification.

## Purpose

The profile maps Serverless Workflow task-oriented runtime semantics onto the
core machine format without adding those task kinds to the core specification.

## Invoke Sources

The converted examples use these invoke sources:

- `serverlessworkflow.schedule`
- `serverlessworkflow.call`
- `serverlessworkflow.run`
- `serverlessworkflow.listen`
- `serverlessworkflow.wait`
- `serverlessworkflow.fork`
- `serverlessworkflow.for`
- `serverlessworkflow.try`

For these invoke sources, the original Serverless Workflow task configuration is
stored in `invoke.input`.

Example:

```json
{
  "src": "serverlessworkflow.call",
  "input": {
    "call": "http",
    "with": {
      "method": "get",
      "endpoint": "https://example.com/api"
    }
  }
}
```

## Actions

The converted examples use:

- `core.assign` for keyed `set` tasks
- `serverlessworkflow.set` for whole-context `set` tasks
- `serverlessworkflow.emit`
- `serverlessworkflow.raise`
- `serverlessworkflow.output`
- `serverlessworkflow.export`

### `core.assign`

Used when a Serverless Workflow `set` task assigns individual keys.

```json
{
  "type": "core.assign",
  "assignments": {
    "startEvent": "{{ $workflow.input[0] }}"
  }
}
```

### `serverlessworkflow.set`

Used when a `set` task assigns a whole value rather than a keyed assignment
record.

```json
{
  "type": "serverlessworkflow.set",
  "params": "{{ $workflow.input[0] }}"
}
```

### `serverlessworkflow.emit`

Represents an emitted event payload from a Serverless Workflow `emit` task.

### `serverlessworkflow.raise`

Represents a raised workflow error payload from a Serverless Workflow `raise`
task.

### `serverlessworkflow.output`

Represents task-level output shaping that is not modeled as machine final
output.

### `serverlessworkflow.export`

Represents task-level exported data updates.

## Expressions

The converted examples use `queryLanguage: "jq"` and wrap expression slots using
the core `{{ ... }}` delimiter convention.

## Notes

This profile document matches the converted examples under
[`examples/serverlessworkflow`](../examples/serverlessworkflow). It is intended
to make those examples explicit and reviewable, not to constrain upstream
Serverless Workflow implementations.
