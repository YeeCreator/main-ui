import { describe, expect, test, vi } from 'vitest';
import { createSandboxKernel } from '../src/sandbox-kernel';
import type { SandboxConnection, SandboxDocument, SandboxElement } from '../src/types';

const makeShape = (id: string, x = 0, y = 0): SandboxElement => ({
  id, type: 'shape', x, y, width: 100, height: 60, rotation: 0,
  shape: { kind: 'rect', label: id },
});

const makeEmbed = (id: string, viewType: string): SandboxElement => ({
  id, type: 'embed-view', x: 0, y: 0, width: 200, height: 150, rotation: 0,
  embedViewRef: { viewType, payload: {} },
});

const makeConnection = (id: string, src: string, tgt: string): SandboxConnection => ({
  id, source: { elementId: src }, target: { elementId: tgt },
});

describe('SandboxKernel - elements', () => {
  test('addElement and read', () => {
    const kernel = createSandboxKernel();
    const el = makeShape('a', 10, 20);
    kernel.addElement(el);
    expect(kernel.document.elements).toHaveLength(1);
    expect(kernel.document.elements[0]).toEqual(el);
  });

  test('addElement is idempotent', () => {
    const kernel = createSandboxKernel();
    const el = makeShape('a');
    kernel.addElement(el);
    kernel.addElement(el);
    expect(kernel.document.elements).toHaveLength(1);
  });

  test('removeElements cascades connections', () => {
    const kernel = createSandboxKernel();
    kernel.addElement(makeShape('a'));
    kernel.addElement(makeShape('b'));
    kernel.addConnection(makeConnection('c1', 'a', 'b'));
    expect(kernel.document.connections).toHaveLength(1);
    kernel.removeElements(['a']);
    expect(kernel.document.elements).toHaveLength(1);
    expect(kernel.document.connections).toHaveLength(0);
  });

  test('moveElement updates position', () => {
    const kernel = createSandboxKernel();
    kernel.addElement(makeShape('a', 0, 0));
    kernel.moveElement('a', 50, 100);
    expect(kernel.document.elements[0].x).toBe(50);
    expect(kernel.document.elements[0].y).toBe(100);
  });

  test('resizeElement and rotateElement', () => {
    const kernel = createSandboxKernel();
    kernel.addElement(makeShape('a'));
    kernel.resizeElement('a', 200, 300);
    expect(kernel.document.elements[0].width).toBe(200);
    expect(kernel.document.elements[0].height).toBe(300);
    kernel.rotateElement('a', 45);
    expect(kernel.document.elements[0].rotation).toBe(45);
  });
});

describe('SandboxKernel - connections', () => {
  test('addConnection with endpoint validation', () => {
    const kernel = createSandboxKernel();
    kernel.addElement(makeShape('a'));
    kernel.addElement(makeShape('b'));
    kernel.addConnection(makeConnection('c1', 'a', 'b'));
    expect(kernel.document.connections).toHaveLength(1);
    // Non-existent endpoint → rejected
    kernel.addConnection(makeConnection('c2', 'a', 'nonexistent'));
    expect(kernel.document.connections).toHaveLength(1);
  });

  test('addConnection is idempotent', () => {
    const kernel = createSandboxKernel();
    kernel.addElement(makeShape('a'));
    kernel.addElement(makeShape('b'));
    const conn = makeConnection('c1', 'a', 'b');
    kernel.addConnection(conn);
    kernel.addConnection(conn);
    expect(kernel.document.connections).toHaveLength(1);
  });

  test('removeConnections', () => {
    const kernel = createSandboxKernel();
    kernel.addElement(makeShape('a'));
    kernel.addElement(makeShape('b'));
    kernel.addConnection(makeConnection('c1', 'a', 'b'));
    kernel.removeConnections(['c1']);
    expect(kernel.document.connections).toHaveLength(0);
  });
});

describe('SandboxKernel - camera', () => {
  test('setCamera merges a partial Camera2D update', () => {
    const kernel = createSandboxKernel();
    kernel.setCamera({ scale: 2 });
    expect(kernel.camera.scale).toBe(2);
    expect(kernel.camera.pan).toEqual({ x: 0, y: 0 }); // unchanged
  });
});

describe('SandboxKernel - serialization', () => {
  test('toJSON / fromJSON roundtrip', () => {
    const kernel = createSandboxKernel();
    kernel.addElement(makeShape('a', 10, 20));
    kernel.addElement(makeShape('b', 100, 200));
    kernel.addConnection(makeConnection('c1', 'a', 'b'));
    kernel.setCamera({ scale: 1.5, pan: { x: 50, y: 50 } });

    const json = kernel.toJSON();
    expect(json.document.elements).toHaveLength(2);
    expect(json.document.connections).toHaveLength(1);
    expect(json.camera.scale).toBe(1.5);

    const kernel2 = createSandboxKernel();
    kernel2.fromJSON(json);
    expect(kernel2.document.elements).toHaveLength(2);
    expect(kernel2.camera.scale).toBe(1.5);
    expect(kernel2.camera.pan).toEqual({ x: 50, y: 50 });
  });

  test('fromJSON migrates legacy { x, y, zoom } snapshot', () => {
    // 存量快照：旧版 getViewState 产出 { x, y, zoom }。
    // 若不归一化，camera.scale 为 undefined → 世界层变换串非法 → 画面静止。
    const kernel = createSandboxKernel();
    kernel.fromJSON({
      document: { elements: [], connections: [] },
      camera: { x: 30, y: 40, zoom: 2 } as never,
    });
    expect(kernel.camera).toEqual({ scale: 2, pan: { x: 30, y: 40 } });
  });
});

describe('SandboxKernel - nesting protection', () => {
  test('embed-view elements within limit', () => {
    const kernel = createSandboxKernel(undefined, undefined, { maxNestingDepth: 8 });
    for (let i = 0; i < 5; i++) {
      kernel.addElement(makeEmbed(`embed-${i}`, 'view-flow-canvas'));
    }
    expect(kernel.document.elements).toHaveLength(5);
    const result = kernel.checkNesting();
    expect(result.status).toBe('ok');
  });

  test('exceeding nesting depth blocks addition', () => {
    const kernel = createSandboxKernel(undefined, undefined, { maxNestingDepth: 3 });
    kernel.addElement(makeEmbed('e1', 'view-flow-canvas'));
    kernel.addElement(makeEmbed('e2', 'view-node-canvas'));
    kernel.addElement(makeEmbed('e3', 'view-table'));
    // 4th should be blocked
    const result = kernel.addElement(makeEmbed('e4', 'view-form'));
    expect(result.status).toBe('exceeded');
    expect(kernel.document.elements).toHaveLength(3);
  });

  test('destroy is idempotent', () => {
    const kernel = createSandboxKernel();
    kernel.addElement(makeShape('a'));
    kernel.destroy();
    kernel.destroy(); // no error
    kernel.addElement(makeShape('b')); // ignored after destroy
    expect(kernel.document.elements).toHaveLength(1);
  });
});

describe('SandboxKernel - change events', () => {
  test('onChange fires on element operations', () => {
    const kernel = createSandboxKernel();
    const listener = vi.fn();
    kernel.onChange(listener);
    kernel.addElement(makeShape('a'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].type).toBe('element');
  });

  test('unsubscribe removes listener', () => {
    const kernel = createSandboxKernel();
    const listener = vi.fn();
    const unsub = kernel.onChange(listener);
    unsub();
    kernel.addElement(makeShape('a'));
    expect(listener).not.toHaveBeenCalled();
  });
});
