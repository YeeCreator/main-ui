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
