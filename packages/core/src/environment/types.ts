/**
 * environment/types —— 运行环境抽象（浏览器 / Electron）的公共类型。
 *
 * MUI 以 Vue3 + 浏览器渲染为主，同时面向后续 Electron 独立应用模式。
 * 本模块把「环境差异」收敛为**单一真相源**，使下游切换外壳时 **src/ 业务代码零改动**。
 *
 * 三层结构：
 * 1. `RuntimeEnvironment`（环境探测，纯前端自动判定）
 * 2. `ShellPolicy`（外壳策略：手势/缩放/右键/快捷键差异集中于此）
 * 3. `NativeBridge`（原生能力桥，Electron 经 preload 注入，浏览器降级为 none）
 */

/** 运行环境类型。 */
export type RuntimeKind = 'browser' | 'electron';

/** 操作系统平台（与键位适配共用一套口径）。 */
export type RuntimePlatform = 'mac' | 'windows' | 'linux';

/** 探测得到的运行环境。 */
export type RuntimeEnvironment = {
  /** 外壳类型：浏览器 / Electron。 */
  kind: RuntimeKind;
  /** 操作系统平台。 */
  platform: RuntimePlatform;
  /** 是否具备原生能力（Electron 且已注入桥）。 */
  native: boolean;
  /** Electron 版本（仅 kind==='electron' 时存在）。 */
  electronVersion?: string;
  /** 判定来源，便于排障：'preload' | 'heuristic' | 'override'。 */
  source: 'preload' | 'heuristic' | 'override';
};

/**
 * 外壳策略：把「浏览器须屏蔽、Electron 可放宽」的行为差异集中为一组开关。
 *
 * 组件与下游只需消费本策略，**不再各自判断环境**。
 */
export type ShellPolicy = {
  /** 抑制页面缩放（Ctrl/Cmd+wheel 与 Safari gesture 事件）。 */
  preventPageZoom: boolean;
  /** 抑制原生右键菜单。 */
  suppressContextMenu: boolean;
  /** 抑制文本选区（拖拽拖影）。 */
  suppressTextSelection: boolean;
  /** 抑制图片拖拽。 */
  suppressImageDrag: boolean;
  /** 需在应用层拦截的浏览器默认快捷键（如 Cmd+W / Ctrl+P）。 */
  interceptShortcuts: string[];
  /** 画布类模板是否启用内置手势隔离（view-world / view-canvas 缺省取此值）。 */
  canvasGestureGuard: boolean;
};

/** 窗口控制桥（Electron 专有）。 */
export type NativeWindowApi = {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
};

/** 文件读写桥（Electron 专有，同步读用于启动配置）。 */
export type NativeFsApi = {
  readText: (path: string) => Promise<string>;
  writeText: (path: string, content: string) => Promise<void>;
};

/** 菜单桥（Electron 专有）。 */
export type NativeMenuApi = {
  set: (items: unknown[]) => void;
};

/**
 * 原生能力桥。
 *
 * 浏览器环境为 `{ kind: 'none' }`；Electron 环境由 preload 注入具体实现。
 * MUI 只定义**合约**，实现由下游宿主在 preload 中提供（Electron 安全模型决定）。
 */
export type NativeBridge = {
  kind: 'none' | 'electron';
  window?: NativeWindowApi;
  fs?: NativeFsApi;
  menu?: NativeMenuApi;
};

/** preload 注入到 `window.__mainUiRuntime` 的合约载荷。 */
export type MainUiRuntimePayload = {
  /** 固定标识，用于校验注入来源。 */
  kind: 'electron';
  /** Electron 版本。 */
  electronVersion?: string;
  /** 操作系统平台。 */
  platform?: string;
  /** 原生能力（按需暴露；缺省表示该能力不可用）。 */
  native?: {
    window?: NativeWindowApi;
    fs?: NativeFsApi;
    menu?: NativeMenuApi;
  };
};
