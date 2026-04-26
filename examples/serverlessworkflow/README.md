# Serverless Workflow Examples

These files translate the upstream Serverless Workflow examples from
<https://github.com/serverlessworkflow/specification/tree/main/examples> into
the Stately Machine Specification draft format.

The translation uses `profile: "https://serverlessworkflow.io/specification/1.0.3"` and `queryLanguage: "jq"`.
Serverless Workflow task kinds that are runtime-defined, such as `call`, `run`,
`listen`, `wait`, `fork`, `for`, and `try`, are represented as profile-specific
invokes (`serverlessworkflow.<kind>`) with their original task configuration in
`input`. Keyed `set` tasks are represented as `core.assign`. Whole-context
`set`, `emit`, `raise`, `output`, and `export` are represented as
profile-specific actions.

This keeps each example valid against the core structural schema without adding
Serverless Workflow built-ins to the core specification.

These examples are structural translations, not executable examples for the
built-in XState conversion helpers. In this repository they are intended to
validate the document shape and the profile mapping, not to run through
`convertSpecToConfig()` or `convertSpecToMachine()`.
