/**
 * environment/policy —— 外壳策略解析与安装（单一真相源）。
 *
 * 「浏览器须屏蔽、Electron 可放宽」的差异**只在这里表达一次**；
 * 组件与下游只消费 `ShellPolicy`，不再各自判断环境。
 */
import { detectEnvironment } from './detect';
import type { RuntimeEnvironment, ShellPolicy } from './types';

/** 浏览器默认策略：全面屏蔽原生交互干扰。 */
export const BROWSER_SHELL_POLICY: ShellPolicy = {
  preventPageZoom: true,
  suppressContextMenu: true,
  suppressTextSelection: true,
  suppressImageDrag: true,
  interceptShortcuts: ['cmd+w', 'ctrl+w', 'cmd+p', 'ctrl+p', 'ctrl+shift+i'],
  canvasGestureGuard: true,
};

/** Electron 默认策略：原生外壳已接管多数行为，仅保留画布手势隔离。 */
export const ELECTRON_SHELL_POLICY: ShellPolicy = {
  preventPageZoom: true, // 应用内不应有页面缩放
  suppressContextMenu: false, // 交给原生菜单/应用自决
  suppressTextSelection: false, // 桌面应用需要文本选择/复制
  suppressImageDrag: true, // 图片拖拽在桌面应用同样无意义
  interceptShortcuts: [],
  canvasGestureGuard: true,
};

/**
 * 按环境解析外壳策略。
 *
 * @param env 环境（缺省自动探测）。
 * @param overrides 宿主覆盖（部分字段）。
 * @returns 合并后的策略。
 * @example
 * const policy = resolveShellPolicy(detectEnvironment());
 */
export function resolveShellPolicy(env?: RuntimeEnvironment, overrides?: Partial<ShellPolicy>): ShellPolicy {
  const environment = env ?? detectEnvironment();
  const base = environment.kind === 'electron' ? ELECTRON_SHELL_POLICY : BROWSER_SHELL_POLICY;
  return overrides ? { ...base, ...overrides } : { ...base };
}

/**
 * 构造右键处理器（Web 端「类 App」行为的核心）。
 *
 * 行为：屏蔽浏览器原生菜单，并派发 `main-ui-contextmenu` 自定义事件供宿主接管。
 * 豁免：目标元素或其祖先声明 `data-main-ui-contextmenu="own"` 时放行
 * （宿主自管菜单的场景，例如自定义菜单容器内部再次右键）。
 *
 * 抽成导出函数是为了可独立单测——`installShellPolicy` 依赖真实 `document`
 * 注入样式，在 node 测试环境下不便验证事件路径。
 *
 * @param win 事件派发目标（通常为 `window`）。
 * @returns 可挂到 `contextmenu` 的处理器。
 * @example
 * window.addEventListener('contextmenu', createContextMenuHandler(window));
 */
export function createContextMenuHandler(win: Window): (event: MouseEvent) => void {
  return (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (target && typeof target.closest === 'function' && target.closest('[data-main-ui-contextmenu="own"]')) {
      return;
    }
    event.preventDefault();
    win.dispatchEvent(
      new CustomEvent('main-ui-contextmenu', {
        detail: {
          clientX: event.clientX,
          clientY: event.clientY,
          target,
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
        },
      }),
    );
  };
}

/** 安装句柄：调用即卸载。 */
export type ShellPolicyDisposer = () => void;

/**
 * 安装外壳策略到 `document` / `window`。
 *
 * - `preventPageZoom`：拦截 Ctrl/Cmd+wheel（非 passive）与 Safari gesture 事件。
 * - `suppressContextMenu`：全局 `contextmenu` 阻止默认，并派发 `main-ui-contextmenu`
 *   自定义事件供宿主接管（Web 构建因此表现得像桌面 App，不露出浏览器菜单）。
 * - `suppressTextSelection` / `suppressImageDrag`：注入基础样式。
 * - `interceptShortcuts`：拦截指定浏览器快捷键。
 *
 * @param policy 已解析策略（见 `resolveShellPolicy`）。
 * @param target 目标作用域（测试用；缺省为 window/document）。
 * @returns 卸载函数。
 * @example
 * const dispose = installShellPolicy(resolveShellPolicy());
 */
export function installShellPolicy(
  policy: ShellPolicy,
  target: { window?: Window; document?: Document } = {},
): ShellPolicyDisposer {
  const win = target.window ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = target.document ?? (typeof document !== 'undefined' ? document : undefined);
  const cleanups: Array<() => void> = [];

  if (win) {
    if (policy.preventPageZoom) {
      const onWheel = (event: WheelEvent) => {
        if (event.ctrlKey || event.metaKey) event.preventDefault();
      };
      win.addEventListener('wheel', onWheel, { passive: false });
      cleanups.push(() => win.removeEventListener('wheel', onWheel));

      const prevent = (event: Event) => event.preventDefault();
      for (const name of ['gesturestart', 'gesturechange', 'gestureend']) {
        win.addEventListener(name, prevent, { passive: false } as AddEventListenerOptions);
        cleanups.push(() => win.removeEventListener(name, prevent));
      }
    }

    if (policy.suppressContextMenu) {
      const onContextMenu = createContextMenuHandler(win);
      win.addEventListener('contextmenu', onContextMenu);
      cleanups.push(() => win.removeEventListener('contextmenu', onContextMenu));
    }

    if (policy.interceptShortcuts.length > 0) {
      const wanted = new Set(policy.interceptShortcuts.map((k) => k.toLowerCase()));
      const onKeyDown = (event: KeyboardEvent) => {
        const parts: string[] = [];
        const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform ?? '');
        if (isMac ? event.metaKey : event.ctrlKey) parts.push(isMac ? 'cmd' : 'ctrl');
        if (isMac ? event.ctrlKey : false) parts.push('ctrl');
        if (event.shiftKey) parts.push('shift');
        if (event.altKey) parts.push('alt');
        parts.push((event.key ?? '').toLowerCase());
        if (wanted.has(parts.join('+'))) event.preventDefault();
      };
      win.addEventListener('keydown', onKeyDown);
      cleanups.push(() => win.removeEventListener('keydown', onKeyDown));
    }
  }

  if (doc) {
    const chunks: string[] = [];
    if (policy.suppressTextSelection) chunks.push('body { user-select: none; }');
    if (policy.suppressImageDrag) chunks.push('img { -webkit-user-drag: none; user-drag: none; }');
    if (chunks.length > 0) {
      const style = doc.createElement('style');
      style.setAttribute('data-main-ui-shell-policy', '');
      style.textContent = chunks.join('\n');
      doc.head.appendChild(style);
      cleanups.push(() => style.remove());
    }
  }

  return () => {
    for (const cleanup of cleanups) cleanup();
    cleanups.length = 0;
  };
}
