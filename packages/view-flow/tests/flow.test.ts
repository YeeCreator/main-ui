import { describe, expect, test } from 'vitest';
import {
  addNode, removeNodes, moveNode, updateNodeContent,
  addEdge, removeEdges, pruneDanglingEdges,
  dedupeNodes, dedupeEdges,
  hasCycle, topologicalSort,
} from '../src/flow';
import type { FlowDocument, FlowNodeData, FlowNodeLayout, FlowEdgeData } from '../src/types';

const makeNode = (id: string, ports: FlowNodeData['ports'] = []): FlowNodeData => ({
  id, node_type: 'state', label: id, ports,
});

const makeLayout = (id: string, x = 0, y = 0): FlowNodeLayout => ({ id, x, y });

const makeEdge = (id: string, srcNode: string, srcPort: string, tgtNode: string, tgtPort: string, signal: 'data' | 'control' = 'control'): FlowEdgeData => ({
  id, source: { nodeId: srcNode, portId: srcPort }, target: { nodeId: tgtNode, portId: tgtPort }, signal,
});

const emptyDoc: FlowDocument = { nodes: [], edges: [], node_layouts: [] };

describe('node operations', () => {
  test('addNode is idempotent', () => {
    const node = makeNode('a');
    const layout = makeLayout('a', 10, 20);
    const d1 = addNode(emptyDoc, node, layout);
    expect(d1.nodes).toHaveLength(1);
    const d2 = addNode(d1, node, layout); // duplicate
    expect(d2.nodes).toHaveLength(1);
  });

  test('removeNodes cascades to edges', () => {
    const nodeA = makeNode('a', [{ id: 'a:out', direction: 'output', signal: 'control' }]);
    const nodeB = makeNode('b', [{ id: 'b:in', direction: 'input', signal: 'control' }]);
    const edge = makeEdge('e1', 'a', 'a:out', 'b', 'b:in');
    let doc: FlowDocument = { nodes: [nodeA, nodeB], edges: [edge], node_layouts: [makeLayout('a'), makeLayout('b')] };
    doc = removeNodes(doc, ['a']);
    expect(doc.nodes).toHaveLength(1);
    expect(doc.edges).toHaveLength(0);
    expect(doc.node_layouts).toHaveLength(1);
  });

  test('moveNode updates layout only', () => {
    let doc: FlowDocument = { nodes: [makeNode('a')], edges: [], node_layouts: [makeLayout('a', 0, 0)] };
    doc = moveNode(doc, 'a', { x: 100, y: 200 });
    expect(doc.node_layouts[0]).toEqual({ id: 'a', x: 100, y: 200 });
    expect(doc.nodes[0]).toEqual(makeNode('a')); // unchanged
  });

  test('updateNodeContent merges shallowly', () => {
    const node = { ...makeNode('a'), content: { foo: 1, bar: 'x' } };
    let doc: FlowDocument = { nodes: [node], edges: [], node_layouts: [] };
    doc = updateNodeContent(doc, 'a', { bar: 'y', baz: true });
    expect(doc.nodes[0].content).toEqual({ foo: 1, bar: 'y', baz: true });
  });
});

describe('edge operations', () => {
  test('addEdge validates port direction', () => {
    const nodeA = makeNode('a', [{ id: 'a:out', direction: 'output', signal: 'control' }]);
    const nodeB = makeNode('b', [{ id: 'b:in', direction: 'input', signal: 'control' }]);
    let doc: FlowDocument = { nodes: [nodeA, nodeB], edges: [], node_layouts: [] };
    // Valid: output → input
    doc = addEdge(doc, makeEdge('e1', 'a', 'a:out', 'b', 'b:in'));
    expect(doc.edges).toHaveLength(1);
    // Invalid: input → output
    const doc2 = addEdge(doc, makeEdge('e2', 'b', 'b:in', 'a', 'a:out'));
    expect(doc2.edges).toHaveLength(1); // not added
  });

  test('addEdge is idempotent', () => {
    const nodeA = makeNode('a', [{ id: 'a:out', direction: 'output', signal: 'control' }]);
    const nodeB = makeNode('b', [{ id: 'b:in', direction: 'input', signal: 'control' }]);
    const edge = makeEdge('e1', 'a', 'a:out', 'b', 'b:in');
    let doc: FlowDocument = { nodes: [nodeA, nodeB], edges: [], node_layouts: [] };
    doc = addEdge(doc, edge);
    doc = addEdge(doc, edge);
    expect(doc.edges).toHaveLength(1);
  });

  test('removeEdges and pruneDanglingEdges', () => {
    const nodeA = makeNode('a');
    const nodeB = makeNode('b');
    const edge = makeEdge('e1', 'a', 'x', 'b', 'y');
    let doc: FlowDocument = { nodes: [nodeA, nodeB], edges: [edge], node_layouts: [] };
    expect(removeEdges(doc, ['e1']).edges).toHaveLength(0);
    // Prune: remove nodeA, then prune dangling
    doc = { ...doc, nodes: [nodeB] };
    const pruned = pruneDanglingEdges(doc);
    expect(pruned.edges).toHaveLength(0);
  });
});

describe('dedupe', () => {
  test('dedupeNodes keeps first occurrence', () => {
    const result = dedupeNodes([makeNode('a'), makeNode('b'), makeNode('a')]);
    expect(result).toHaveLength(2);
    expect(result.map((n) => n.id)).toEqual(['a', 'b']);
  });

  test('dedupeEdges keeps first occurrence', () => {
    const edge = makeEdge('e1', 'a', 'x', 'b', 'y');
    const result = dedupeEdges([edge, edge]);
    expect(result).toHaveLength(1);
  });
});

describe('cycle detection and topological sort', () => {
  test('no cycle in linear chain', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [
      makeEdge('e1', 'a', 'x', 'b', 'y'),
      makeEdge('e2', 'b', 'x', 'c', 'y'),
    ];
    const doc: FlowDocument = { nodes, edges, node_layouts: [] };
    expect(hasCycle(doc)).toBe(false);
    expect(topologicalSort(doc)).toEqual(['a', 'b', 'c']);
  });

  test('detects cycle', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [
      makeEdge('e1', 'a', 'x', 'b', 'y'),
      makeEdge('e2', 'b', 'x', 'c', 'y'),
      makeEdge('e3', 'c', 'x', 'a', 'y'), // cycle!
    ];
    const doc: FlowDocument = { nodes, edges, node_layouts: [] };
    expect(hasCycle(doc)).toBe(true);
    expect(topologicalSort(doc)).toEqual([]); // cycle → empty
  });

  test('data-flow edges ignored for cycle check', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [
      makeEdge('e1', 'a', 'x', 'b', 'y', 'control'),
      makeEdge('e2', 'b', 'x', 'a', 'y', 'data'), // data edge, not checked
    ];
    const doc: FlowDocument = { nodes, edges, node_layouts: [] };
    expect(hasCycle(doc)).toBe(false);
  });
});
