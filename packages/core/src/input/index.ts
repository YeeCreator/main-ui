/**
 * @main-ui/core/input —— 输入与手势引擎（框架无关、零 DOM 依赖）。
 *
 * 五段管线：
 *
 * ```text
 * 输入源（InputSource） → 归一化信号（InputSignal）
 *   → 识别器（Recognizer） → 手势（GesturePattern）
 *     → 匹配器（Matcher） → 唯一命中（Binding）
 *       → 路由器（InputRouter） → 触发（命令桥在 main-ui 主包）
 * ```
 *
 * 本子路径只做「输入 → 手势 → 绑定」的纯计算，不认识命令，也不接触 Vue。
 * 画布类模板（`view-world` / `view-canvas`）只依赖 `@main-ui/core`，
 * 因此它们可直接复用同一套判型与识别，不必各自实现一遍。
 */
export * from './types';
export * from './platform';
export * from './when';
export * from './binding-dsl';
export * from './wheel-session';
export * from './session';
export * from './recognizer';
export * from './matcher';
export * from './router';
export * from './provider';
export * from './dom';
