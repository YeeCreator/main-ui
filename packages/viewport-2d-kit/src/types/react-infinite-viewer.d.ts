declare module 'react-infinite-viewer' {
  import * as React from 'react';

  /**
   * Infinite Viewer 事件对象。
   */
  export type InfiniteViewerEvent<T = Record<string, unknown>> = T & {
    /** 阻止默认行为。 */
    stop?: () => void;
    /** 触发事件名。 */
    eventType?: string;
  };

  /**
   * Infinite Viewer 实例最小方法集合。
   */
  export interface InfiniteViewerRef {
    /**
     * 设置缩放。
     *
     * @param zoom 缩放值。
     * @param options 可选项。
     */
    setZoom?: (zoom: number, options?: Record<string, unknown>) => void;
    /**
     * 滚动到目标位置。
     *
     * @param left 横向滚动值。
     * @param top 纵向滚动值。
     */
    scrollTo?: (left: number, top: number) => void;
    /** 获取横向滚动值。 */
    getScrollLeft?: () => number;
    /** 获取纵向滚动值。 */
    getScrollTop?: () => number;
    /** 获取当前缩放。 */
    getZoom?: () => number;
  }

  /**
   * Infinite Viewer 组件属性（宽松类型，适配不同版本）。
   */
  export interface InfiniteViewerProps extends React.HTMLAttributes<HTMLDivElement> {
    /** 缩放初始值。 */
    zoom?: number;
    /** 是否启用 pinch。 */
    usePinch?: boolean;
    /** 最小缩放。 */
    zoomMin?: number;
    /** 最大缩放。 */
    zoomMax?: number;
    /** 缩放变化回调。 */
    onPinch?: (event: InfiniteViewerEvent<{ zoom?: number }>) => void;
    /** 滚动回调。 */
    onScroll?: (event: InfiniteViewerEvent<{ scrollLeft?: number; scrollTop?: number }>) => void;
    /** 子元素。 */
    children?: React.ReactNode;
    /** 兼容不同版本扩展属性。 */
    [key: string]: unknown;
  }

  const InfiniteViewer: React.ForwardRefExoticComponent<
    InfiniteViewerProps & React.RefAttributes<InfiniteViewerRef>
  >;

  export default InfiniteViewer;
}
