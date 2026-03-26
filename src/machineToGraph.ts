import { createGraph, addNode, addEdge } from '@statelyai/graph';
import type { Graph, NodeConfig, EdgeConfig } from '@statelyai/graph';
import type { StateMachine } from './machineSchema';

/**
 * Converts a Stately machine spec to a @statelyai/graph Graph.
 *
 * - Each state becomes a node (id = dot-separated path)
 * - Each transition becomes an edge (event name as label)
 * - Compound states have children via parentId
 * - Initial state is set on the graph and compound nodes
 */
export function machineToGraph(machine: StateMachine): Graph {
  const graph = createGraph({ type: 'directed' });
  const pendingEdges: EdgeConfig[] = [];

  // First pass: collect all nodes
  function collectNodes(
    states: Record<string, any> | undefined,
    parentId: string | null,
    pathPrefix: string
  ) {
    if (!states) return;

    for (const [key, state] of Object.entries(states)) {
      const nodeId = pathPrefix ? `${pathPrefix}.${key}` : key;

      const nodeConfig: NodeConfig = {
        id: nodeId,
        label: state.description || key,
        parentId,
        data: {
          type: state.type,
          tags: state.tags,
          meta: state.meta,
        },
      };

      if (state.initial) {
        nodeConfig.initialNodeId = `${nodeId}.${state.initial}`;
      }

      addNode(graph, nodeConfig);

      // Collect edges for event transitions
      if (state.on) {
        for (const [event, trans] of Object.entries(state.on)) {
          const transitions = normalizeTransitions(trans);
          for (let i = 0; i < transitions.length; i++) {
            const t = transitions[i];
            if (t.target) {
              const targetId = resolveTarget(t.target, pathPrefix);
              pendingEdges.push({
                id: `${nodeId}|${event}|${targetId}|${i}`,
                sourceId: nodeId,
                targetId,
                label: event,
                data: {
                  event,
                  guard: t.guard,
                  description: t.description,
                  meta: t.meta,
                },
              });
            }
          }
        }
      }

      // Delayed transitions
      if (state.after) {
        for (const [delay, trans] of Object.entries(state.after)) {
          const transitions = normalizeTransitions(trans);
          for (let i = 0; i < transitions.length; i++) {
            const t = transitions[i];
            if (t.target) {
              const targetId = resolveTarget(t.target, pathPrefix);
              pendingEdges.push({
                id: `${nodeId}|after:${delay}|${targetId}|${i}`,
                sourceId: nodeId,
                targetId,
                label: `after ${delay}`,
                data: {
                  delay,
                  guard: t.guard,
                  description: t.description,
                  meta: t.meta,
                },
              });
            }
          }
        }
      }

      // Always transitions
      if (state.always) {
        const transitions = normalizeTransitions(state.always);
        for (let i = 0; i < transitions.length; i++) {
          const t = transitions[i];
          if (t.target) {
            const targetId = resolveTarget(t.target, pathPrefix);
            pendingEdges.push({
              id: `${nodeId}|always|${targetId}|${i}`,
              sourceId: nodeId,
              targetId,
              label: 'always',
              data: {
                guard: t.guard,
                description: t.description,
                meta: t.meta,
              },
            });
          }
        }
      }

      // Invoke onDone/onError/onSnapshot
      if (state.invoke) {
        for (const inv of state.invoke) {
          for (const invKey of ['onDone', 'onError', 'onSnapshot'] as const) {
            if (inv[invKey]) {
              const transitions = normalizeTransitions(inv[invKey]);
              for (let i = 0; i < transitions.length; i++) {
                const t = transitions[i];
                if (t.target) {
                  const targetId = resolveTarget(t.target, pathPrefix);
                  const label = `${inv.src}.${invKey}`;
                  pendingEdges.push({
                    id: `${nodeId}|${label}|${targetId}|${i}`,
                    sourceId: nodeId,
                    targetId,
                    label,
                    data: {
                      invoke: inv.src,
                      invokeEvent: invKey,
                      guard: t.guard,
                      description: t.description,
                      meta: t.meta,
                    },
                  });
                }
              }
            }
          }
        }
      }

      // Recurse into children
      if (state.states) {
        collectNodes(state.states, nodeId, nodeId);
      }
    }
  }

  // Collect all nodes first
  if (machine.states) {
    collectNodes(machine.states, null, '');
  }

  // Then add all edges (all nodes now exist)
  for (const edge of pendingEdges) {
    addEdge(graph, edge);
  }

  // Set initial node on the graph
  if (machine.initial) {
    (graph as any).initialNodeId = machine.initial;
  }

  return graph;
}

function normalizeTransitions(
  transitions: any
): Array<{ target?: string; guard?: any; description?: string; meta?: any }> {
  if (!transitions) return [];
  if (Array.isArray(transitions)) return transitions;
  return [transitions];
}

function resolveTarget(target: string, pathPrefix: string): string {
  if (target.startsWith('#')) return target.slice(1);
  if (pathPrefix) return `${pathPrefix}.${target}`;
  return target;
}
