/**
 * demo 模板编辑器注册 —— 模拟后端适配层示范的接入端（一期 + 二期）。
 *
 * 每个官方视图模板走同一条链路：
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
import {
  registerFormViewEditor,
  type FormApplyPresetIntentPayload,
  type FormChangePayload,
  type FormSavePresetIntentPayload,
  type FormSchema,
  type FormSubmitPayload,
  type FormValues,
} from '@main-ui/view-form';
import {
  registerNodeViewEditor,
  type NodeConnectIntentPayload,
  type NodeGraphData,
  type NodeGraphEdgeData,
  type NodeMoveIntentPayload,
} from '@main-ui/view-node';
import { registerConsoleViewEditor, type ConsoleEntry } from '@main-ui/view-console';
import { hostProfileWorkspaceIds } from '../runtime/hostProfiles';
import {
  createConsoleEntry,
  fetchConsoleLogs,
  fetchNodeGraph,
  fetchOrderTable,
  fetchProjectTree,
  fetchSceneGraph,
  fetchSceneInspector,
  fetchSettingsForm,
  type SceneGraphData,
} from './mockApi';
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

  // ---------- 配置面板（v0.4 P2-1 链路：提交 → 模拟适配层落库 → 回填） ----------
  registerFormViewEditor(
    runtime,
    { allowedWorkspaceIds, title: 'Host Settings' },
    (context) => {
      const id = context.editor.id;
      ensureViewData(id, () => fetchSettingsForm().then((data) => ({ ...data })));
      const record = getViewRecord(id);
      return {
        schema: (record?.data.schema as FormSchema | undefined) ?? {},
        values: (record?.data.values as FormValues | undefined) ?? null,
        loading: isPending(record?.status),
        error: record?.status === 'error' ? record.error : null,
        presets: Object.keys(formPresetStore),
      };
    },
    (context) => ({
      onChange: (payload: FormChangePayload) => {
        const record = getViewRecord(context.editor.id);
        if (!record || record.status !== 'ready') return;
        const values = { ...(record.data.values as FormValues), [payload.key]: payload.value };
        patchViewData(context.editor.id, { data: { ...record.data, values } });
      },
      onSubmit: (payload: FormSubmitPayload) => {
        // 裁决：非法提交不落库（阻断由宿主裁决，视图只呈现）
        if (!payload.valid) {
          console.warn(`[demo adapter] settings ${context.editor.id} submit rejected: invalid values`);
          return;
        }
        // 模拟异步落库后回填（受控回流：视图值与“后端”值始终一致）
        setTimeout(() => {
          const record = getViewRecord(context.editor.id);
          if (!record || record.status !== 'ready') return;
          patchViewData(context.editor.id, { data: { ...record.data, values: { ...payload.values } } });
          console.info(`[demo adapter] settings ${context.editor.id} persisted & refilled`);
        }, 300);
      },
      onSavePresetIntent: (payload: FormSavePresetIntentPayload) => {
        formPresetStore[payload.name] = { ...payload.values };
        const record = getViewRecord(context.editor.id);
        if (record) patchViewData(context.editor.id, { data: { ...record.data } }); // 触发 presets 列表回流
      },
      onApplyPresetIntent: (payload: FormApplyPresetIntentPayload) => {
        const preset = formPresetStore[payload.name];
        if (!preset) return;
        const record = getViewRecord(context.editor.id);
        if (!record || record.status !== 'ready') return;
        patchViewData(context.editor.id, { data: { ...record.data, values: { ...preset } } });
      },
    }),
  );

  // ---------- 节点图（移动/连线意图裁决后回写，视口进视图状态） ----------
  registerNodeViewEditor(
    runtime,
    { allowedWorkspaceIds, title: 'Pipeline Graph' },
    (context) => {
      const id = context.editor.id;
      ensureViewData(id, () => fetchNodeGraph().then((data) => ({ ...data })));
      const record = getViewRecord(id);
      return {
        nodes: (record?.data.nodes as NodeGraphData[] | undefined) ?? [],
        edges: (record?.data.edges as NodeGraphEdgeData[] | undefined) ?? [],
        loading: isPending(record?.status),
        error: record?.status === 'error' ? record.error : null,
      };
    },
    (context) => ({
      onNodeMoveIntent: (payload: NodeMoveIntentPayload) => {
        const record = getViewRecord(context.editor.id);
        if (!record || record.status !== 'ready') return;
        const nodes = ((record.data.nodes as NodeGraphData[] | undefined) ?? []).map((node) =>
          node.id === payload.nodeId ? { ...node, position: { ...payload.position } } : node,
        );
        patchViewData(context.editor.id, { data: { ...record.data, nodes } });
      },
      onNodeConnectIntent: (payload: NodeConnectIntentPayload) => {
        const record = getViewRecord(context.editor.id);
        if (!record || record.status !== 'ready') return;
        const edges = (record.data.edges as NodeGraphEdgeData[] | undefined) ?? [];
        // 裁决：重复连线丢弃（仅示范，真实宿主可弹提示）
        if (edges.some((edge) => edge.source === payload.source && edge.target === payload.target)) return;
        const nextEdge: NodeGraphEdgeData = {
          id: `e-${Date.now()}-${edges.length}`,
          source: payload.source,
          target: payload.target,
        };
        patchViewData(context.editor.id, { data: { ...record.data, edges: [...edges, nextEdge] } });
      },
    }),
  );

  // ---------- 控制台（日志流模拟追加；清空以意图裁决） ----------
  registerConsoleViewEditor(
    runtime,
    { allowedWorkspaceIds, title: 'Log Stream' },
    (context) => {
      const id = context.editor.id;
      ensureViewData(id, async () => {
        const entries = await fetchConsoleLogs();
        startConsoleStream(id); // 模拟宿主侧日志流推送（非网络）
        return { entries };
      });
      const record = getViewRecord(id);
      return {
        entries: (record?.data.entries as ConsoleEntry[] | undefined) ?? [],
        loading: isPending(record?.status),
        error: record?.status === 'error' ? record.error : null,
      };
    },
    (context) => ({
      onClearIntent: () => {
        const record = getViewRecord(context.editor.id);
        if (!record) return;
        patchViewData(context.editor.id, { data: { ...record.data, entries: [] } });
      },
    }),
  );
};

// ---------- 二期模板的宿主侧模拟存储（均在适配层，模板包零存储零网络） ----------
/** 表单预设模板存储（名称 → 值表）。 */
const formPresetStore: Record<string, FormValues> = {};

/** 日志流定时器（按实例隔离，上限 4000 条防内存增长）。 */
const consoleStreams = new Map<string, ReturnType<typeof setInterval>>();

const startConsoleStream = (editorInstanceId: string): void => {
  if (consoleStreams.has(editorInstanceId)) return;
  const timer = setInterval(() => {
    const record = getViewRecord(editorInstanceId);
    if (!record || record.status !== 'ready') return;
    const entries = (record.data.entries as ConsoleEntry[] | undefined) ?? [];
    const next = [...entries, createConsoleEntry()];
    patchViewData(editorInstanceId, { data: { ...record.data, entries: next.length > 4000 ? next.slice(next.length - 4000) : next } });
  }, 900);
  consoleStreams.set(editorInstanceId, timer);
};
