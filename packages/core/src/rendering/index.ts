/**
 * @main-ui/core/rendering —— 渲染基础设施（吸收自原 viewport-2d-kit，包名已消灭）。
 *
 * 独立子路径导出：仅画布类视图（view-world / view-sandbox）import，
 * DOM 类视图（view-form / view-table 等）不会因此引入 PixiJS。
 *
 * - camera：相机数学纯函数（screenToWorld / worldToScreen / fit / pan / zoom / serialize）
 * - camera-bridge：二维相机 ↔ 三维轨道相机的统一表示与换算（坐标约定翻转单点）
 * - backend：`ViewportBackend` 后端接口（渲染库无关，`render-*` 包实现）
 * - backend-registry：已装后端注册表（维度能力运行时探测的唯一真相源）
 * - constraints：相机约束（缩放范围 + 平移边界）
 * - interactions：框架无关视口交互控制器
 * - pointer-gesture：指针「轻点 / 拖拽」判别的唯一真相源
 * - pixiViewport：PixiJS WebGL 渲染内核（唯一 2D 渲染核心）
 * - pixiBackend：二维后端对 `ViewportBackend` 的参照实现
 */
export * from './camera';
export * from './camera-bridge';
export * from './backend';
export * from './backend-registry';
export * from './constraints';
export * from './interactions';
export * from './pointer-gesture';
export { installPreventPageZoom } from './preventPageZoom';
export { PixiViewport, type PixiViewportOptions } from './pixiViewport';
export { PixiViewportBackend, defaultDpr, type PixiBackendOptions } from './pixiBackend';
