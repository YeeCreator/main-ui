/**
 * demo 模板编辑器注册 —— v0.3 P2-1「模拟后端适配层」示范的接入端。
 *
 * 每个一期官方视图模板走同一条链路：
 *   1. registerXxxEditor 一键注册 descriptor + renderer 适配器；
 *   2. `resolveProps` 从模拟后端取数（经 presetViewStore 缓存与三态管理），
 *      转成模板包契约后经 Props 注入；
 *   3. `extraProps` 消费模板抛出的意图（Emits）：裁决后回写仓库 → 受控回流。
 */
import { Graphics, Text } from 'pixi.js';
import type { Component } from 'vue';
import type { EditorDescriptor } from 'main-ui/core';
import type { PixiViewport } from '@main-ui/viewport-2d-kit/pixi';
import { registerTreeViewEditor, type ViewTreeNode } from '@main-ui/view-tree';
import {
  registerInspectorViewEditor,
  type InspectorChangePayload,
  type InspectorSchema,
  type InspectorValues,
} from '@main-ui/view-inspector';
import { registerTableViewEditor, type TableCellEditIntent, type TableColumn, type TableRow } from '@main-ui/view-table';
import { registerView2dEditor, DEFAULT_VIEW_2D_VIEWBOX, type View2dViewBox } from '@main-ui/view-2d';
import { hostProfileWorkspaceIds } from '../runtime/hostProfiles';
import { fetchOrderTable, fetchProjectTree, fetchSceneGraph, fetchSceneInspector, type SceneGraphData } from './mockApi';
import { ensureViewData, getViewRecord, patchViewData } from './presetViewStore';

type DemoPresetRuntime = {
  core: { registerEditor: (descriptor: EditorDescriptor) => void };
  vue: { registerEditorRenderer: (rendererKey: string, component: Component) => void };
};

const isPending = (status?: string): boolean => status === 'loading' || status === undefined;

/** 把模拟后端的场景图谱画进 2d 内核的 world 容器（世界坐标）。 */
const drawSceneGraph = (viewport: PixiViewport, editorInstanceId: string): void => {
  const record = getViewRecord(editorInstanceId);
  const data = record?.data as Partial<SceneGraphData> | undefined;
  const nodes = data?.nodes ?? [];
  const edges = data?.edges ?? [];
  if (nodes.length === 0) return;

  const world = viewport.world;
  world.removeChildren();
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const edgeGraphics = new Graphics();
  for (const edge of edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;
    edgeGraphics.moveTo(source.x + source.width / 2, source.y + source.height / 2);
    edgeGraphics.lineTo(target.x + target.width / 2, target.y + target.height / 2);
  }
  edgeGraphics.stroke({ width: 2, color: 0x64748b, alpha: 0.9 });
  world.addChild(edgeGraphics);

  for (const node of nodes) {
    const box = new Graphics();
    box.roundRect(node.x, node.y, node.width, node.height, 8);
    box.fill(0xd9ebff);
    box.stroke({ width: 1, color: 0x475569 });
    world.addChild(box);

    const label = new Text({
      text: node.label,
      style: { fontSize: 12, fill: '#1e293b', fontFamily: 'inherit' },
    });
    label.anchor.set(0.5);
    label.position.set(node.x + node.width / 2, node.y + node.height / 2);
    world.addChild(label);
  }
};

export const registerDemoPresetViewEditors = (runtime: DemoPresetRuntime): void => {
  const allowedWorkspaceIds = [...hostProfileWorkspaceIds];

  // ---------- 虚拟滚动树 ----------
  registerTreeViewEditor(
    runtime,
    { allowedWorkspaceIds, title: 'Project Tree' },
    (context) => {
      const id = context.editor.id;
      ensureViewData(id, () => fetchProjectTree().then((items) => ({ items })));
      const record = getViewRecord(id);
      return {
        items: (record?.data.items as ViewTreeNode[] | undefined) ?? [],
        loading: isPending(record?.status),
        error: record?.status === 'error' ? record.error : null,
      };
    },
    (context) => ({
      onSelect: (nodeId: string) => {
        console.info(`[demo adapter] tree ${context.editor.id} selected ${nodeId}`);
      },
    }),
  );

  // ---------- schema 检查器（变更意图裁决后回写，受控回流） ----------
  registerInspectorViewEditor(
    runtime,
    { allowedWorkspaceIds, title: 'Scene Inspector' },
    (context) => {
      const id = context.editor.id;
      ensureViewData(id, () => fetchSceneInspector().then((data) => ({ ...data })));
      const record = getViewRecord(id);
      return {
        schema: (record?.data.schema as InspectorSchema | undefined) ?? [],
        values: (record?.data.values as InspectorValues | undefined) ?? null,
        loading: isPending(record?.status),
        error: record?.status === 'error' ? record.error : null,
      };
    },
    (context) => ({
      onChange: (payload: InspectorChangePayload) => {
        const record = getViewRecord(context.editor.id);
        if (!record || record.status !== 'ready') return;
        const values = { ...(record.data.values as InspectorValues), [payload.key]: payload.value };
        patchViewData(context.editor.id, { data: { ...record.data, values } });
      },
    }),
  );

  // ---------- 2D 画布（相机进视图状态；世界绘制在宿主侧） ----------
  registerView2dEditor(
    runtime,
    { allowedWorkspaceIds, title: 'Scene Graph' },
    (context) => {
      const id = context.editor.id;
      ensureViewData(id, () => fetchSceneGraph().then((data) => ({ ...data })));
      const record = getViewRecord(id);
      return {
        viewBox: (record?.data.viewBox as View2dViewBox | undefined) ?? DEFAULT_VIEW_2D_VIEWBOX,
        loading: isPending(record?.status),
        error: record?.status === 'error' ? record.error : null,
      };
    },
    (context) => ({
      onReady: (viewport: PixiViewport) => drawSceneGraph(viewport, context.editor.id),
    }),
  );

  // ---------- 虚拟滚动表格（编辑意图裁决后回写行数据） ----------
  registerTableViewEditor(
    runtime,
    { allowedWorkspaceIds, title: 'Order Table' },
    (context) => {
      const id = context.editor.id;
      ensureViewData(id, () => fetchOrderTable().then((data) => ({ ...data })));
      const record = getViewRecord(id);
      return {
        columns: (record?.data.columns as TableColumn[] | undefined) ?? [],
        rows: (record?.data.rows as TableRow[] | undefined) ?? [],
        loading: isPending(record?.status),
        error: record?.status === 'error' ? record.error : null,
      };
    },
    (context) => ({
      onCellEditIntent: (intent: TableCellEditIntent) => {
        const record = getViewRecord(context.editor.id);
        if (!record || record.status !== 'ready') return;
        const rows = ((record.data.rows as TableRow[] | undefined) ?? []).map((row) => {
          if (String(row.id) !== intent.rowId) return row;
          const original = row[intent.columnKey];
          const value = typeof original === 'number' ? Number(intent.value) || 0 : intent.value;
          return { ...row, [intent.columnKey]: value };
        });
        patchViewData(context.editor.id, { data: { ...record.data, rows } });
      },
    }),
  );
};
