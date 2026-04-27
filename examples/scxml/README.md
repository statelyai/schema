# SCXML Examples

These files demonstrate the semantic SCXML JSON profile. They are not lowered
core-machine examples; they preserve SCXML constructs directly with `kind`
discriminators, keyed `states`, optional state `order` metadata, executable
`actions`, datamodel fields, and SCXML-specific transition/invoke/send
semantics.

Each file validates against `scxmlDocumentSchema` and the generated
`schemas/scxml.json` file.
