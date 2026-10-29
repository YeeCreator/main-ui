/**
 * view-canvas/types —— DOM/SVG 2D 画布视口的公共类型。
 *
 * view-canvas 是 MUI 的 **DOM/SVG 画布视口**模板：只做「相机 + 指针/滚轮交互 +
 * 坐标系换算」，把世界内容绘制交给宿主的默认插槽（宿主自绘 SVG/DOM）。
 * 与 PixiJS 渲染的 `@main-ui/view-world` 互补——前者面向「宿主自绘」，后者面向「图元自动渲染/手动 PixiJS」。
 *
 * 取代已废弃的 `viewport-2d-kit/vue`（RenderTarget 无关，纯 DOM）。
 */
import type { Camera2D, CssTransform, SvgTransform, Vec2, ViewBox } from '@main-ui/core/rendering';

export type { Camera2D, CssTransform, SvgTransform, Vec2, ViewBox };

/** 视口容器尺寸（CSS 像素）。 */
export type ViewportContainerSize = {
  width: number;
  height: number;
};

/**
 * 默认插槽回传的渲染上下文。
 *
 * **两种介质各有专名**：`svgTransform` 用于 SVG 的 `transform` **属性**，
 * `cssTransform` 用于元素的 `style.transform`。二者不可互换 —— 旧版只给一个
 * 裸名 `cameraTransform`（SVG 语法、无单位），宿主放进 CSS 位时浏览器
 * **静默丢弃整条声明**，表现为「相机在变、画面不动」。
 */
export type ViewportCanvasSlotContext = {
  /** 容器宽度（CSS 像素）。 */
  width: number;
  /** 容器高度（CSS 像素）。 */
  height: number;
  /** SVG 介质：可直接用于 `<g :transform="...">`。 */
  svgTransform: SvgTransform;
  /** CSS 介质：可直接用于 `:style="{ transform: cssTransform, transformOrigin: '0 0' }"`。 */
  cssTransform: CssTransform;
  /**
   * @deprecated **歧义源头**。这是 SVG 语法（无单位）的串，放在 CSS 位会被静默丢弃。
   *   改用 {@link svgTransform} 或 {@link cssTransform}。兼容期 1 个 minor 后移除。
   */
  cameraTransform: SvgTransform;
  /** 当前缩放系数。 */
  scale: number;
  /** 当前相机（纯值快照）。 */
  camera: Camera2D;
};

/** 组件 exposes 的命令式 API（经模板 ref 调用）。 */
export type ViewportCanvasExpose = {
  /** 适配 viewBox 到容器（居中 + 等比缩放）。 */
  fitToBounds: () => void;
  /** 放大一档（以容器中心为锚点）。 */
  zoomIn: () => void;
  /** 缩小一档（以容器中心为锚点）。 */
  zoomOut: () => void;
  /** 读取当前相机（纯值副本）。 */
  getCamera: () => Camera2D;
  /** 设置相机（会被 minScale/maxScale 约束）。 */
  setCamera: (camera: Camera2D) => void;
  /** 屏幕坐标（相对容器左上角）-> 世界坐标。 */
  screenToWorld: (point: Vec2) => Vec2;
  /** 世界坐标 -> 屏幕坐标（相对容器左上角）。 */
  worldToScreen: (point: Vec2) => Vec2;
  /** 读取容器渲染尺寸（CSS 像素）。 */
  getSize: () => ViewportContainerSize;
};

/** 宿主自绘用的坐标桥（client 事件 -> world）。 */
export type ViewportHostBridge = {
  /** SVG viewBox 字符串（`0 0 w h`）。 */
  viewBoxText: string;
  /** 世界容器样式（固定 viewBox 尺寸）。 */
  worldStyle: { width: string; height: string };
  /** 把 client 坐标换算为世界坐标（需当前相机）。 */
  clientEventToWorld: (camera: Camera2D, event: { clientX: number; clientY: number }) => Vec2;
  /** 把屏幕位移换算为世界位移。 */
  screenDeltaToWorld: (camera: Camera2D, deltaScreen: Vec2) => Vec2;
};
