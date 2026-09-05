/**
 * @main-ui/core/rendering —— 渲染基础设施（吸收自原 viewport-2d-kit，包名已消灭）。
 *
 * 独立子路径导出：仅画布类视图（view-world / view-sandbox）import，
 * DOM 类视图（view-form / view-table 等）不会因此引入 PixiJS。
 *
 * - camera：相机数学纯函数（screenToWorld / worldToScreen / fit / pan / zoom / serialize）
 * - constraints：相机约束（缩放范围 + 平移边界）
 * - interactions：框架无关视口交互控制器
 * - pixiViewport：PixiJS WebGL 渲染内核（唯一 2D 渲染核心）
 */
export * from './camera';
export * from './constraints';
export * from './interactions';
export { PixiViewport, type PixiViewportOptions } from './pixiViewport';
