import type { LayoutDocument } from './types';

/** 五区布局的区名。 */
export type FiveZoneName = 'top' | 'center' | 'bottom' | 'left' | 'right';

/** 五区布局选项。 */
export type FiveZoneLayoutOptions = {
  /** 标识前缀（默认 `five`）；多份模板共存时避免 id 冲突。 */
  prefix?: string;
  /** 各区权重（相对值，自动归一化）。 */
  weights?: Partial<Record<FiveZoneName, number>>;
  /** 是否生成左/右区（省略则为三区：上/中/下）。 */
  withSides?: boolean;
};

type ZoneSpec = {
  name: FiveZoneName;
  groupId: string;
  leafId: string;
  weight: number;
};

/**
 * 五区布局模板（上 / 中 / 下 / 左 / 右）。
 *
 * ## 为什么内置
 *
 * 「游戏舞台型」与「编辑器型」宿主反复手工拼同一个布局树：一条水平主分割，
 * 中间再竖着切三块，左右各一条细边。手拼的问题不是难，而是**每仓拼出来的
 * 权重与最小尺寸都不一样**，用户体验因此不一致；而且新宿主每次都要重读一遍
 * `LayoutDocument` 的形状定义。
 *
 * 这是**模板**不是机制 —— 它只生成一份普通的 `LayoutDocument`，装配后与用户
 * 手工拖出来的布局完全等价（同样可拖拽、可持久化、可重置）。
 *
 * ## 形状
 *
 * ```
 * split(horizontal)                      ← 只在 withSides 时存在
 * ├── split(vertical) [left]
 * ├── split(vertical)                    ← 主区
 * │   ├── [top]
 * │   ├── [center]                       ← activeGroup
 * │   └── [bottom]
 * └── split(vertical) [right]
 * ```
 *
 * 省略左右区时直接返回主区的竖向三分割（等价于旧三区布局，但 id 命名不同）。
 *
 * @param options 选项。
 * @returns 可直接用于 `applyLayout` / workspace `createDefaultLayout` 的布局文档。
 * @example
 * ```ts
 * const layout = createFiveZoneLayout({ weights: { top: 0.1, bottom: 0.2 } });
 * layout.activeGroupId; // 'five-group-center'
 * ```
 */
export const createFiveZoneLayout = (options: FiveZoneLayoutOptions = {}): LayoutDocument => {
  const prefix = options.prefix ?? 'five';
  const withSides = options.withSides ?? true;
  const w = options.weights ?? {};

  const zones: ZoneSpec[] = [
    { name: 'top', groupId: `${prefix}-group-top`, leafId: `${prefix}-leaf-top`, weight: w.top ?? 0.15 },
    { name: 'center', groupId: `${prefix}-group-center`, leafId: `${prefix}-leaf-center`, weight: w.center ?? 0.7 },
    { name: 'bottom', groupId: `${prefix}-group-bottom`, leafId: `${prefix}-leaf-bottom`, weight: w.bottom ?? 0.15 },
  ];

  const sideZones: ZoneSpec[] = withSides
    ? [
      { name: 'left', groupId: `${prefix}-group-left`, leafId: `${prefix}-leaf-left`, weight: w.left ?? 0.16 },
      { name: 'right', groupId: `${prefix}-group-right`, leafId: `${prefix}-leaf-right`, weight: w.right ?? 0.16 },
    ]
    : [];

  const mainSplitId = `${prefix}-split-main`;
  const groups: LayoutDocument['groups'] = {};
  const nodes: LayoutDocument['nodes'] = {};

  for (const zone of [...zones, ...sideZones]) {
    groups[zone.groupId] = {
      id: zone.groupId,
      tabIds: [],
      activeTabId: null,
      lastActiveTabId: null,
    };
    nodes[zone.leafId] = { id: zone.leafId, type: 'leaf', groupId: zone.groupId };
  }

  // 主区竖向三分割；中间区权重由 center 承担
  const mainChildren = [zones[0].leafId, zones[1].leafId, zones[2].leafId];
  const mainWeights = normalize([zones[0].weight, zones[1].weight, zones[2].weight]);
  nodes[mainSplitId] = {
    id: mainSplitId,
    type: 'split',
    orientation: 'vertical',
    children: mainChildren,
    weights: mainWeights,
  };

  const centerGroupId = `${prefix}-group-center`;

  if (!withSides) {
    return {
      version: 1,
      rootNodeId: mainSplitId,
      nodes,
      groups,
      activeGroupId: centerGroupId,
      maximizedNodeId: null,
    };
  }

  const rootSplitId = `${prefix}-split-root`;
  const children = [`${prefix}-leaf-left`, mainSplitId, `${prefix}-leaf-right`];
  const rootWeights = normalize([sideZones[0].weight, 1, sideZones[1].weight]);
  nodes[rootSplitId] = {
    id: rootSplitId,
    type: 'split',
    orientation: 'horizontal',
    children,
    weights: rootWeights,
  };

  return {
    version: 1,
    rootNodeId: rootSplitId,
    nodes,
    groups,
    activeGroupId: centerGroupId,
    maximizedNodeId: null,
  };
};

/** 权重归一化（和不为正时回退均分，避免除零与零尺寸区）。 */
const normalize = (weights: number[]): number[] => {
  const sum = weights.reduce((acc, value) => acc + Math.max(0, value), 0);
  if (sum <= 0) return weights.map(() => 1 / weights.length);
  return weights.map((value) => Math.max(0, value) / sum);
};

/** 内置布局模板清单（供宿主做「布局模板选择器」）。 */
export const LAYOUT_TEMPLATES = [
  { id: 'single', title: 'Single', create: () => createFiveZoneLayout({ withSides: false, prefix: 'single', weights: { top: 0, bottom: 0, center: 1 } }) },
  { id: 'three-zone', title: 'Top / Center / Bottom', create: () => createFiveZoneLayout({ withSides: false }) },
  { id: 'five-zone', title: 'Five Zone', create: () => createFiveZoneLayout() },
] as const;
