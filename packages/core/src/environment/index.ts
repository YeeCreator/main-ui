/**
 * @main-ui/core/environment —— 运行环境抽象（浏览器 / Electron）。
 *
 * 三层：
 * - **探测** `detectEnvironment()`：preload 合约 → 覆盖 → 启发式。
 * - **策略** `resolveShellPolicy()` + `installShellPolicy()`：手势/缩放/右键/快捷键差异的单一真相源。
 * - **桥** `getNativeBridge()`：原生能力（窗口/文件/菜单），浏览器降级为 `none`。
 *
 * 目标：下游**切换浏览器/Electron 外壳时，`src/` 业务代码零改动**。
 */
export * from './types';
export {
  MAIN_UI_RUNTIME_KEY,
  detectEnvironment,
  normalizePlatform,
  readRuntimePayload,
  resetEnvironmentCache,
  setEnvironmentProvider,
} from './detect';
export {
  BROWSER_SHELL_POLICY,
  ELECTRON_SHELL_POLICY,
  installShellPolicy,
  createContextMenuHandler,
  resolveShellPolicy,
  type ShellPolicyDisposer,
} from './policy';
export { getNativeBridge, hasNativeBridge } from './bridge';
