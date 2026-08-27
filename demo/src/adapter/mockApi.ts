/**
 * demo 模拟后端 API —— v0.3 P2-1「模拟后端适配层」示范的数据源端。
 *
 * 职责边界：只模拟「异步取数」（延迟 + 可配置失败率），产出领域数据；
 * 把领域数据转成模板包契约、注入 props、消费意图，全部在适配层
 * （./presetViewStore.ts + ./registerPresetViewEditors.ts）完成。
 * 模板包与 main-ui 核心均不触碰本文件。
 */
import type { ViewTreeNode } from '@main-ui/view-tree';
import type { InspectorSchema, InspectorValues } from '@main-ui/view-inspector';
import type { TableColumn, TableRow } from '@main-ui/view-table';
import type { View2dViewBox } from '@main-ui/view-2d';
import type { FormSchema, FormValues } from '@main-ui/view-form';
import type { NodeGraphData, NodeGraphEdgeData } from '@main-ui/view-node';
import type { ConsoleEntry, ConsoleLevel } from '@main-ui/view-console';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 模拟网络延迟 + 失败率（默认 0；调高可演示 error 三态）。 */
const simulateRequest = async (ms: number, failRate = 0): Promise<void> => {
  await delay(ms);
  if (failRate > 0 && Math.random() < failRate) {
    throw new Error(`Mock backend failed (simulated fail rate ${failRate})`);
  }
};

// ---------- 项目树：生成嵌套节点，验证虚拟滚动 ----------
export const fetchProjectTree = async (): Promise<ViewTreeNode[]> => {
  await simulateRequest(450);
  const roots: ViewTreeNode[] = [];
  for (let module = 1; module <= 24; module += 1) {
    const children: ViewTreeNode[] = [];
    for (let file = 1; file <= 80; file += 1) {
      children.push({ id: `m${module}-f${file}`, label: `file-${file}.ts` });
    }
    roots.push({ id: `m${module}`, label: `module-${module}`, children });
  }
  return roots;
};

// ---------- 订单表格：列定义 + 行数据，验证虚拟滚动与编辑意图 ----------
export type OrderTableData = { columns: TableColumn[]; rows: TableRow[] };

const ORDER_STATUSES = ['paid', 'pending', 'shipped', 'cancelled'] as const;

export const fetchOrderTable = async (): Promise<OrderTableData> => {
  await simulateRequest(600);
  const columns: TableColumn[] = [
    { key: 'id', title: 'Order', width: 90 },
    { key: 'customer', title: 'Customer', sortable: true },
    { key: 'amount', title: 'Amount', width: 100, align: 'right', sortable: true },
    { key: 'status', title: 'Status', width: 110, sortable: true },
  ];
  const rows: TableRow[] = [];
  for (let index = 0; index < 3000; index += 1) {
    rows.push({
      id: `O-${String(index + 1).padStart(5, '0')}`,
      customer: `Customer ${((index * 37) % 200) + 1}`,
      amount: Math.round(((index * 137) % 9000) + 120),
      status: ORDER_STATUSES[index % ORDER_STATUSES.length],
    });
  }
  return { columns, rows };
};

// ---------- 场景对象检查器：schema + 值 ----------
export type SceneInspectorData = { schema: InspectorSchema; values: InspectorValues };

export const fetchSceneInspector = async (): Promise<SceneInspectorData> => {
  await simulateRequest(350);
  return {
    schema: [
      { kind: 'string', key: 'name', label: 'Name', defaultValue: 'Scene object' },
      { kind: 'number', key: 'x', label: 'Position X', min: -1000, max: 1000, step: 1, defaultValue: 0 },
      { kind: 'number', key: 'y', label: 'Position Y', min: -1000, max: 1000, step: 1, defaultValue: 0 },
      { kind: 'number', key: 'scale', label: 'Scale', min: 0.1, max: 10, step: 0.1, defaultValue: 1 },
      { kind: 'boolean', key: 'visible', label: 'Visible', defaultValue: true },
      {
        kind: 'select',
        key: 'blend',
        label: 'Blend mode',
        options: [
          { value: 'normal', label: 'Normal' },
          { value: 'multiply', label: 'Multiply' },
          { value: 'screen', label: 'Screen' },
        ],
        defaultValue: 'normal',
      },
    ],
    values: { name: 'Demo sprite', x: 120, y: -40, scale: 1.5, visible: true, blend: 'normal' },
  };
};

// ---------- 场景图谱：2D 画布世界数据（viewBox + 节点 + 边） ----------
export type SceneGraphData = {
  viewBox: View2dViewBox;
  nodes: Array<{ id: string; label: string; x: number; y: number; width: number; height: number }>;
  edges: Array<{ source: string; target: string }>;
};

export const fetchSceneGraph = async (): Promise<SceneGraphData> => {
  await simulateRequest(500);
  return {
    viewBox: { x: -200, y: -160, width: 760, height: 480 },
    nodes: [
      { id: 'root', label: 'Scene root', x: -20, y: -100, width: 140, height: 52 },
      { id: 'actors', label: 'Actors', x: -160, y: 40, width: 120, height: 52 },
      { id: 'props', label: 'Props', x: 20, y: 40, width: 120, height: 52 },
      { id: 'lights', label: 'Lights', x: 200, y: 40, width: 120, height: 52 },
      { id: 'camera', label: 'Camera', x: 20, y: 180, width: 120, height: 52 },
    ],
    edges: [
      { source: 'root', target: 'actors' },
      { source: 'root', target: 'props' },
      { source: 'root', target: 'lights' },
      { source: 'props', target: 'camera' },
    ],
  };
};

// ---------- 配置面板：分组表单（view-form 契约），验证提交→适配层→回填链路 ----------
export type SettingsFormData = { schema: FormSchema; values: FormValues };

export const fetchSettingsForm = async (): Promise<SettingsFormData> => {
  await simulateRequest(400);
  return {
    schema: {
      groups: [
        {
          id: 'general',
          title: 'General',
          fields: [
            { kind: 'string', key: 'appName', label: 'App name', required: true, maxLength: 40, defaultValue: 'Demo Host' },
            {
              kind: 'select',
              key: 'theme',
              label: 'Theme',
              options: [
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ],
              defaultValue: 'system',
            },
            { kind: 'boolean', key: 'telemetry', label: 'Enable telemetry', defaultValue: false },
          ],
        },
        {
          id: 'render',
          title: 'Rendering',
          description: 'Host-side render pipeline tuning.',
          fields: [
            { kind: 'number', key: 'targetFps', label: 'Target FPS', min: 15, max: 240, step: 15, required: true, defaultValue: 60 },
            { kind: 'number', key: 'renderScale', label: 'Render scale', min: 0.5, max: 2, step: 0.25, defaultValue: 1 },
            { kind: 'textarea', key: 'bootNote', label: 'Boot note', rows: 3, maxLength: 200, placeholder: 'Optional startup note', defaultValue: '' },
          ],
        },
      ],
    },
    values: { appName: 'Demo Host', theme: 'system', telemetry: false, targetFps: 60, renderScale: 1, bootNote: '' },
  };
};

// ---------- 节点图：依赖关系图（view-node 契约），验证移动/连线意图与视口状态 ----------
export type NodeGraphDemoData = { nodes: NodeGraphData[]; edges: NodeGraphEdgeData[] };

export const fetchNodeGraph = async (): Promise<NodeGraphDemoData> => {
  await simulateRequest(420);
  return {
    nodes: [
      { id: 'input', label: 'Input', position: { x: 0, y: 120 } },
      { id: 'parse', label: 'Parser', position: { x: 180, y: 40 } },
      { id: 'validate', label: 'Validator', position: { x: 180, y: 200 } },
      { id: 'transform', label: 'Transform', position: { x: 380, y: 120 } },
      { id: 'render', label: 'Renderer', position: { x: 560, y: 60 } },
      { id: 'output', label: 'Output', position: { x: 560, y: 200 } },
    ],
    edges: [
      { id: 'e1', source: 'input', target: 'parse' },
      { id: 'e2', source: 'input', target: 'validate', label: 'raw' },
      { id: 'e3', source: 'parse', target: 'transform' },
      { id: 'e4', source: 'validate', target: 'transform', label: 'ok' },
      { id: 'e5', source: 'transform', target: 'render' },
      { id: 'e6', source: 'transform', target: 'output' },
    ],
  };
};

// ---------- 控制台日志流：初始批次 + 追加条目工厂（验证虚拟滚动与自动跟随） ----------
const CONSOLE_SAMPLE_LEVELS: ConsoleLevel[] = ['debug', 'info', 'info', 'info', 'warn', 'error', 'success'];
const CONSOLE_SAMPLE_MESSAGES = [
  'Asset loaded: sprites/player.png',
  'Frame budget exceeded by 3.2ms',
  'Scene transition completed',
  'Shader compiled: post-fx-bloom',
  'Input mapping reloaded',
  'Cache miss: audio/bgm-main.ogg',
  'Worker pool resized to 4',
  'Checkpoint saved',
];

let consoleLogSeq = 0;

/** 追加条目工厂：适配层模拟日志流推送时调用（非网络）。 */
export const createConsoleEntry = (): ConsoleEntry => {
  consoleLogSeq += 1;
  return {
    id: `log-${consoleLogSeq}`,
    level: CONSOLE_SAMPLE_LEVELS[consoleLogSeq % CONSOLE_SAMPLE_LEVELS.length],
    message: `${CONSOLE_SAMPLE_MESSAGES[consoleLogSeq % CONSOLE_SAMPLE_MESSAGES.length]} (#${consoleLogSeq})`,
    timestamp: Date.now(),
  };
};

export const fetchConsoleLogs = async (): Promise<ConsoleEntry[]> => {
  await simulateRequest(380);
  const entries: ConsoleEntry[] = [];
  for (let index = 0; index < 1500; index += 1) {
    entries.push(createConsoleEntry());
  }
  return entries;
};
