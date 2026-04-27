# SCXML Profile

This document defines the `scxml` profile for a semantic JSON representation of
W3C SCXML 1.0 documents.

## Identifier

- Short name: `scxml`
- Canonical URI: `https://www.w3.org/TR/scxml/`

## Purpose

The SCXML profile is not a lowered XState/core-machine profile. It represents
SCXML constructs directly as typed JSON objects while using the same keyed
`states` shape as the core machine schema.

The profile is intentionally separate from the core Stately machine schema. A
faithful SCXML document may use SCXML-specific syntax and semantics that do not
fit the normalized core shape, including `<initial>` transition content,
event descriptor lists, data-model expressions, `<content>`, `<script>`,
`<finalize>`, and custom executable content.

## JSON Shape

SCXML documents validate with `scxmlDocumentSchema` and the generated
`schemas/scxml.json` file.

```json
{
  "profile": "scxml",
  "version": "1.0",
  "initial": "ready",
  "states": {
    "ready": {
      "kind": "state"
    }
  }
}
```

`kind` identifies the SCXML construct. This leaves SCXML's own semantic `type`
fields available on constructs such as transitions, sends, invokes, and history
states.

State children are stored in `states`. When source order matters to a processor,
state nodes may carry an `order` number. Executable content is ordered with
`onEntry`, `onExit`, transition `actions`, `finalize.actions`, and other
SCXML-specific action arrays.

Custom executable content is represented with `kind: "customAction"` so
processor-specific semantics can be preserved without falling back to an XML AST.

## Support Boundary

This repository currently provides structural validation for the JSON
representation. It does not yet provide a complete SCXML interpreter or a
lossless SCXML-to-core-machine lowering pass.
