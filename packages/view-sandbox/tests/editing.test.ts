/**
 * view-sandbox 编辑能力 —— 内核必须被**视图层消费**。
 *
 * 守护目标（design-main-ui §二十一 8「内核必须被消费」）：
 * 内核提供完整编辑 API，但视图层调用次数为零时，表现为「数据能改、画面不动」。
 * 本文件用源码静态检查挡住这一类回归。
 */
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createSandboxKernel } from '../src/sandbox-kernel';
import type { SandboxDocument, SandboxElement } from '../src/types';

const viewSource = readFileSync(
  fileURLToPath(new URL('../src/SandboxView.ts', import.meta.url)),
  'utf8',
);

const makeText = (id: string, x = 0, y = 0): SandboxElement => ({
  id, type: 'text', x, y, width: 100, height: 40, rotation: 0,
  text: { content: `text-${id}` },
});

const emptyDoc = (): SandboxDocument => ({ elements: [], connections: [] });

describe('内核编辑能力被视图层消费（静态检查）', () => {
  test('视图层调用 moveElement', () => {
    expect(viewSource).toContain('moveElement(');
  });

  test('视图层调用 resizeElement', () => {
    expect(viewSource).toContain('resizeElement(');
  });

  test('视图层调用 rotateElement', () => {
    expect(viewSource).toContain('rotateElement(');
  });

  test('视图层调用 addConnection（连线可建）', () => {
    expect(viewSource).toContain('addConnection(');
  });

  test('视图层调用 updateElementContent（内联编辑可提交）', () => {
    expect(viewSource).toContain('updateElementContent(');
  });

  test('视图层消费 undo / redo', () => {
    expect(viewSource).toContain('undo()');
    expect(viewSource).toContain('redo()');
  });

  test('嵌入视图由插槽渲染，不再只画占位文字', () => {
    expect(viewSource).toContain("slots['embed-view']");
  });

  test('元素拖拽经世界坐标换算（避免位移被放大 1/scale 倍）', () => {
    expect(viewSource).toContain('screenToWorld(');
  });
});

describe('内核编辑 API 行为', () => {
  test('moveElement / resizeElement / rotateElement 生效', () => {
    const kernel = createSandboxKernel({ elements: [makeText('a')], connections: [] });
    kernel.moveElement('a', 50, 60);
    expect(kernel.document.elements[0]).toMatchObject({ x: 50, y: 60 });
    kernel.resizeElement('a', 200, 80);
    expect(kernel.document.elements[0]).toMatchObject({ width: 200, height: 80 });
    kernel.rotateElement('a', 45);
    expect(kernel.document.elements[0].rotation).toBe(45);
  });

  test('updateElementContent 只覆盖传入字段，不动位置', () => {
    const kernel = createSandboxKernel({ elements: [makeText('a', 10, 20)], connections: [] });
    kernel.updateElementContent('a', { text: { content: '改过了' } });
    const el = kernel.document.elements[0];
    expect(el.text?.content).toBe('改过了');
    expect(el.x).toBe(10); // 位置未被影响
    expect(el.y).toBe(20);
  });

  test('addConnection 校验端点存在性', () => {
    const kernel = createSandboxKernel({ elements: [makeText('a'), makeText('b', 200)], connections: [] });
    kernel.addConnection({ id: 'c1', source: { elementId: 'a' }, target: { elementId: 'b' } });
    expect(kernel.document.connections).toHaveLength(1);
    // 不存在的端点：静默拒绝
    kernel.addConnection({ id: 'c2', source: { elementId: 'a' }, target: { elementId: 'zzz' } });
    expect(kernel.document.connections).toHaveLength(1);
  });
});

describe('撤销 / 重做', () => {
  test('初始不可撤销不可重做', () => {
    const kernel = createSandboxKernel(emptyDoc());
    expect(kernel.canUndo()).toBe(false);
    expect(kernel.canRedo()).toBe(false);
  });

  test('拖拽可撤销、可重做', () => {
    const kernel = createSandboxKernel({ elements: [makeText('a')], connections: [] });
    kernel.moveElement('a', 99, 99);
    expect(kernel.canUndo()).toBe(true);
    kernel.undo();
    expect(kernel.document.elements[0]).toMatchObject({ x: 0, y: 0 });
    kernel.redo();
    expect(kernel.document.elements[0]).toMatchObject({ x: 99, y: 99 });
  });

  test('相机变更不入历史（撤销不该把视口拉回去）', () => {
    const kernel = createSandboxKernel(emptyDoc());
    kernel.setCamera({ scale: 3 });
    expect(kernel.canUndo()).toBe(false);
  });

  test('新操作会清空重做栈', () => {
    const kernel = createSandboxKernel({ elements: [makeText('a')], connections: [] });
    kernel.moveElement('a', 10, 10);
    kernel.undo();
    expect(kernel.canRedo()).toBe(true);
    kernel.moveElement('a', 30, 30);
    expect(kernel.canRedo()).toBe(false);
  });

  test('删除可撤销', () => {
    const kernel = createSandboxKernel({ elements: [makeText('a'), makeText('b', 200)], connections: [] });
    kernel.removeElements(['a']);
    expect(kernel.document.elements).toHaveLength(1);
    kernel.undo();
    expect(kernel.document.elements).toHaveLength(2);
  });

  test('fromJSON 清空历史（防止撤销把文档换回上一份）', () => {
    const kernel = createSandboxKernel({ elements: [makeText('a')], connections: [] });
    kernel.moveElement('a', 50, 50);
    expect(kernel.canUndo()).toBe(true);
    kernel.fromJSON({ document: { elements: [makeText('b')], connections: [] } });
    expect(kernel.canUndo()).toBe(false);
    expect(kernel.document.elements[0].id).toBe('b');
  });

  test('clearHistory 后不可撤销', () => {
    const kernel = createSandboxKernel({ elements: [makeText('a')], connections: [] });
    kernel.moveElement('a', 1, 1);
    kernel.clearHistory();
    expect(kernel.canUndo()).toBe(false);
  });

  test('撤销恢复嵌入元素后重新注册（否则子视图空白）', () => {
    const doc: SandboxDocument = {
      elements: [{ id: 'e1', type: 'embed-view', x: 0, y: 0, width: 100, height: 100, rotation: 0, embedViewRef: { viewType: 'view-table' } }],
      connections: [],
    };
    const kernel = createSandboxKernel(doc);
    expect(kernel.embeddedHost.has('e1')).toBe(true);
    kernel.removeElements(['e1']);
    expect(kernel.embeddedHost.has('e1')).toBe(false);
    kernel.undo();
    expect(kernel.embeddedHost.has('e1')).toBe(true);
  });
});
