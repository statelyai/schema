import { describe, test } from 'node:test';
import assert from 'node:assert';
import { machineToGraph } from './machineToGraph';
import type { StateMachine } from './machineSchema';
import { getNode, getEdgesOf, getChildren } from '@statelyai/graph';

describe('machineToGraph', () => {
  test('empty machine', () => {
    const graph = machineToGraph({});
    assert.strictEqual(graph.nodes.length, 0);
    assert.strictEqual(graph.edges.length, 0);
  });

  test('single state', () => {
    const graph = machineToGraph({
      initial: 'idle',
      states: { idle: {} },
    });
    assert.strictEqual(graph.nodes.length, 1);
    assert.ok(getNode(graph, 'idle'));
  });

  test('event transitions become edges', () => {
    const spec: StateMachine = {
      initial: 'a',
      states: {
        a: { on: { GO: { target: 'b' } } },
        b: {},
      },
    };
    const graph = machineToGraph(spec);
    assert.strictEqual(graph.nodes.length, 2);
    assert.strictEqual(graph.edges.length, 1);
    assert.strictEqual(graph.edges[0].sourceId, 'a');
    assert.strictEqual(graph.edges[0].targetId, 'b');
    assert.strictEqual(graph.edges[0].label, 'GO');
  });

  test('branching transitions create multiple edges', () => {
    const spec: StateMachine = {
      initial: 'a',
      states: {
        a: {
          on: {
            CHECK: [
              { target: 'b', guard: '{{ context.ready }}' },
              { target: 'c' },
            ],
          },
        },
        b: {},
        c: {},
      },
    };
    const graph = machineToGraph(spec);
    const edgesFromA = getEdgesOf(graph, 'a');
    assert.strictEqual(edgesFromA.length, 2);
  });

  test('delayed transitions', () => {
    const spec: StateMachine = {
      initial: 'waiting',
      states: {
        waiting: {
          after: { PT30S: { target: 'timeout' } },
        },
        timeout: {},
      },
    };
    const graph = machineToGraph(spec);
    assert.strictEqual(graph.edges.length, 1);
    assert.strictEqual(graph.edges[0].label, 'after PT30S');
  });

  test('always transitions', () => {
    const spec: StateMachine = {
      initial: 'check',
      states: {
        check: {
          always: { target: 'done', guard: '{{ context.ready }}' },
        },
        done: {},
      },
    };
    const graph = machineToGraph(spec);
    assert.strictEqual(graph.edges.length, 1);
    assert.strictEqual(graph.edges[0].label, 'always');
  });

  test('invoke onDone/onError transitions', () => {
    const spec: StateMachine = {
      initial: 'loading',
      states: {
        loading: {
          invoke: [
            {
              src: 'fetchData',
              onDone: { target: 'success' },
              onError: { target: 'failure' },
            },
          ],
        },
        success: {},
        failure: {},
      },
    };
    const graph = machineToGraph(spec);
    assert.strictEqual(graph.edges.length, 2);
    const labels = graph.edges.map((e) => e.label).sort();
    assert.deepStrictEqual(labels, ['fetchData.onDone', 'fetchData.onError']);
  });

  test('nested states use dot-separated IDs with parentId', () => {
    const spec: StateMachine = {
      initial: 'parent',
      states: {
        parent: {
          initial: 'child1',
          states: {
            child1: { on: { NEXT: { target: 'child2' } } },
            child2: {},
          },
        },
      },
    };
    const graph = machineToGraph(spec);
    assert.strictEqual(graph.nodes.length, 3); // parent, child1, child2

    const child1 = getNode(graph, 'parent.child1');
    assert.ok(child1);
    assert.strictEqual(child1.parentId, 'parent');

    const children = getChildren(graph, 'parent');
    assert.strictEqual(children.length, 2);

    // Edge within parent resolves relative target
    assert.strictEqual(graph.edges[0].sourceId, 'parent.child1');
    assert.strictEqual(graph.edges[0].targetId, 'parent.child2');
  });

  test('preserves state metadata in node data', () => {
    const spec: StateMachine = {
      initial: 'idle',
      states: {
        idle: {
          description: 'Waiting',
          tags: ['ready'],
          meta: { color: 'green' },
        },
      },
    };
    const graph = machineToGraph(spec);
    const node = getNode(graph, 'idle');
    assert.ok(node);
    assert.strictEqual(node.label, 'Waiting');
    assert.deepStrictEqual(node.data.tags, ['ready']);
    assert.deepStrictEqual(node.data.meta, { color: 'green' });
  });

  test('state type preserved in node data', () => {
    const spec: StateMachine = {
      initial: 'a',
      states: {
        a: { on: { GO: { target: 'done' } } },
        done: { type: 'final' },
      },
    };
    const graph = machineToGraph(spec);
    const done = getNode(graph, 'done');
    assert.ok(done);
    assert.strictEqual(done.data.type, 'final');
  });
});
