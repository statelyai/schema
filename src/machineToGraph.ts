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
            const targets = normalizeTargets(t.target);
            for (let targetIndex = 0; targetIndex < targets.length; targetIndex++) {
              const targetId = resolveTarget(targets[targetIndex], pathPrefix, nodeId);
              pendingEdges.push({
                id: `${nodeId}|${event}|${targetId}|${i}|${targetIndex}`,
                sourceId: nodeId,
                targetId,
                label: event,
                data: {
                  event,
                  guard: t.guard,
                  description: t.description,
                  meta: t.meta,
                  order: t.order,
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
            const targets = normalizeTargets(t.target);
            for (let targetIndex = 0; targetIndex < targets.length; targetIndex++) {
              const targetId = resolveTarget(targets[targetIndex], pathPrefix, nodeId);
              pendingEdges.push({
                id: `${nodeId}|after:${delay}|${targetId}|${i}|${targetIndex}`,
                sourceId: nodeId,
                targetId,
                label: `after ${delay}`,
                data: {
                  delay,
                  guard: t.guard,
                  description: t.description,
                  meta: t.meta,
                  order: t.order,
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
          const targets = normalizeTargets(t.target);
          for (let targetIndex = 0; targetIndex < targets.length; targetIndex++) {
            const targetId = resolveTarget(targets[targetIndex], pathPrefix, nodeId);
            pendingEdges.push({
              id: `${nodeId}|always|${targetId}|${i}|${targetIndex}`,
              sourceId: nodeId,
              targetId,
              label: 'always',
              data: {
                guard: t.guard,
                description: t.description,
                meta: t.meta,
                order: t.order,
              },
            });
          }
        }
      }

      // Done transitions
      if (state.onDone) {
        const transitions = normalizeTransitions(state.onDone);
        for (let i = 0; i < transitions.length; i++) {
          const t = transitions[i];
          const targets = normalizeTargets(t.target);
          for (let targetIndex = 0; targetIndex < targets.length; targetIndex++) {
            const targetId = resolveTarget(targets[targetIndex], pathPrefix, nodeId);
            pendingEdges.push({
              id: `${nodeId}|onDone|${targetId}|${i}|${targetIndex}`,
              sourceId: nodeId,
              targetId,
              label: 'onDone',
              data: {
                guard: t.guard,
                description: t.description,
                meta: t.meta,
                order: t.order,
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
                const targets = normalizeTargets(t.target);
                for (
                  let targetIndex = 0;
                  targetIndex < targets.length;
                  targetIndex++
                ) {
                  const targetId = resolveTarget(
                    targets[targetIndex],
                    pathPrefix,
                    nodeId
                  );
                  const label = `${inv.src}.${invKey}`;
                  pendingEdges.push({
                    id: `${nodeId}|${label}|${targetId}|${i}|${targetIndex}`,
                    sourceId: nodeId,
                    targetId,
                    label,
                    data: {
                      invoke: inv.src,
                      invokeEvent: invKey,
                      guard: t.guard,
                      description: t.description,
                      meta: t.meta,
                      order: t.order,
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
): Array<{
  target?: string | string[];
  guard?: any;
  description?: string;
  meta?: any;
  order?: number;
}> {
  if (!transitions) return [];
  if (Array.isArray(transitions)) {
    return transitions
      .map((transition, index) => ({ transition, index }))
      .sort((a, b) => {
        const orderA =
          typeof a.transition.order === 'number'
            ? a.transition.order
            : Number.POSITIVE_INFINITY;
        const orderB =
          typeof b.transition.order === 'number'
            ? b.transition.order
            : Number.POSITIVE_INFINITY;

        if (orderA !== orderB) {
          return orderA - orderB;
        }

        return a.index - b.index;
      })
      .map(({ transition }) => transition);
  }
  return [transitions];
}

function normalizeTargets(target: string | string[] | undefined): string[] {
  if (target == null) return [];
  return Array.isArray(target) ? target : [target];
}

function resolveTarget(
  target: string,
  pathPrefix: string,
  sourceId: string
): string {
  if (target.startsWith('#')) return target.slice(1);
  if (target.startsWith('.')) return `${sourceId}${target}`;
  if (pathPrefix) return `${pathPrefix}.${target}`;
  return target;
}
