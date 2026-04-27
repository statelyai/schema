import { describe, test } from 'node:test';
import assert from 'node:assert';
import {
  scxmlCancelSchema,
  scxmlDocumentSchema,
  scxmlParamSchema,
  scxmlSendSchema,
} from './scxmlSchema';
import { getRegisteredProfile, normalizeRegisteredProfile } from './profiles';

describe('scxmlSchema', () => {
  test('validates a minimal semantic SCXML document', () => {
    scxmlDocumentSchema.parse({
      profile: 'scxml',
      version: '1.0',
      states: {
        ready: { kind: 'state' },
      },
    });
  });

  test('preserves keyed states and SCXML executable semantics', () => {
    const result = scxmlDocumentSchema.parse({
      version: '1.0',
      initial: 'ready',
      datamodel: 'ecmascript',
      binding: 'late',
      data: [{ kind: 'data', id: 'count', expr: '0' }],
      states: {
        ready: {
          kind: 'state',
          order: 1,
          onEntry: [{ kind: 'log', label: 'entry', expr: 'count' }],
          transitions: [
            {
              kind: 'transition',
              event: ['error', 'error.*'],
              target: 'failed',
              actions: [{ kind: 'raise', event: 'ENTERED_FAILED_PATH' }],
            },
          ],
        },
        failed: {
          kind: 'final',
          order: 2,
          donedata: {
            kind: 'donedata',
            content: {
              kind: 'content',
              value: { code: 'E_FAIL' },
            },
          },
        },
      },
    });

    assert.strictEqual(result.states?.ready?.kind, 'state');
    assert.strictEqual(result.states?.failed?.kind, 'final');
  });

  test('keeps SCXML type attributes as semantic type fields', () => {
    scxmlDocumentSchema.parse({
      version: '1.0',
      states: {
        ready: {
          kind: 'state',
          transitions: [
            {
              kind: 'transition',
              type: 'internal',
              event: 'PING',
              target: 'ready',
            },
          ],
          invokes: [
            {
              kind: 'invoke',
              type: 'scxml',
              src: 'worker.scxml',
              autoforward: true,
            },
          ],
        },
      },
    });
  });

  test('validates SCXML mutually exclusive expression groups', () => {
    assert.throws(() =>
      scxmlSendSchema.parse({
        kind: 'send',
        event: 'PING',
        eventexpr: 'dynamicEvent',
      })
    );

    assert.throws(() =>
      scxmlCancelSchema.parse({
        kind: 'cancel',
      })
    );

    assert.throws(() =>
      scxmlParamSchema.parse({
        kind: 'param',
        name: 'payload',
        expr: 'payload',
        location: 'payload',
      })
    );
  });

  test('supports custom executable content without falling back to XML shape', () => {
    scxmlDocumentSchema.parse({
      version: '1.0',
      states: {
        ready: {
          kind: 'state',
          onEntry: [
            {
              kind: 'customAction',
              name: 'trace',
              namespace: 'https://example.com/scxml/custom',
              data: { value: 'entered' },
            },
          ],
        },
      },
    });
  });

  test('registers the SCXML profile', () => {
    assert.strictEqual(
      normalizeRegisteredProfile('https://www.w3.org/TR/scxml/'),
      'scxml'
    );
    assert.strictEqual(
      getRegisteredProfile('scxml')?.docsPath,
      './profiles/scxml.md'
    );
  });
});
