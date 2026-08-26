import React from 'react';
import InfiniteViewer from 'react-infinite-viewer';
import type { InfiniteViewerRef } from 'react-infinite-viewer';
import type { Camera2D } from '../../viewportMath';
import { clamp } from '../../viewportMath';
import { createLiteModeController } from './createLiteModeController';
import type { ViewportLiteProps, ViewportLiteRenderArgs } from './types';

/**
 * 轻量视口组件（react-infinite-viewer 适配层）。
 *
 * 说明：
 * - 该组件用于替代自研 2D 视口底层在轻量场景的实现。
 * - 业务可通过 mode 选择器在 lite 与 game/map 之间切换。
 *
 * @param props 组件属性。
 * @returns React 节点。
 */
export function ViewportLite(props: ViewportLiteProps) {
  const {
    width = '100%',
    height = '100%',
    background = '#ffffff',
    viewBox,
    minScale = 0.25,
    maxScale = 8,
    zoomStep = 0.1,
    paddingPx = 12,
    autoFitOnViewBoxChange = true,
    style,
    onCamera,
    controllerRef,
    overlay,
    children,
  } = props;

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const viewerRef = React.useRef<InfiniteViewerRef | null>(null);

  const [camera, setCamera] = React.useState<Camera2D>(() => {
    const initial = props.initialCamera ?? {
      scale: 1,
      pan: { x: 0, y: 0 },
    };
    return {
      ...initial,
      scale: clamp(initial.scale, minScale, maxScale),
    };
  });
  const cameraRef = React.useRef<Camera2D>(camera);

  React.useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  /**
   * 读取当前容器尺寸。
   *
   * @returns 像素尺寸。
   */
  const getViewportSize = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return null;
    return { width: el.clientWidth, height: el.clientHeight };
  }, []);

  const controller = React.useMemo(
    () =>
      createLiteModeController({
        viewerRef,
        getCamera: () => cameraRef.current,
        setCamera,
        getViewportSize,
        viewBox,
        minScale,
        maxScale,
        paddingPx,
      }),
    [getViewportSize, maxScale, minScale, paddingPx, viewBox]
  );

  React.useEffect(() => {
    onCamera?.(camera);
  }, [camera, onCamera]);

  React.useEffect(() => {
    if (!autoFitOnViewBoxChange) return;
    controller.fitToCenter();
    // 仅在 viewBox 改变后重置。
  }, [autoFitOnViewBoxChange, controller, viewBox.height, viewBox.width, viewBox.x, viewBox.y]);

  // 对外暴露 controller，便于与旧工具栏/快捷键逻辑对接。
  React.useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = controller;
    return () => {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    };
  }, [controller, controllerRef]);

  /**
   * 处理 scroll 事件，同步 pan。
   *
   * @param event 事件对象。
   */
  const handleScroll = (event: { scrollLeft?: number; scrollTop?: number }) => {
    setCamera((prev) => ({
      ...prev,
      pan: {
        x: event.scrollLeft ?? prev.pan.x,
        y: event.scrollTop ?? prev.pan.y,
      },
    }));
  };

  /**
   * 处理 pinch 事件，同步 scale。
   *
   * @param event 事件对象。
   */
  const handlePinch = (event: { zoom?: number }) => {
    setCamera((prev) => {
      const nextScale = clamp(event.zoom ?? prev.scale, minScale, maxScale);
      if (nextScale === prev.scale) return prev;
      return { ...prev, scale: nextScale };
    });
  };

  const renderArgs: ViewportLiteRenderArgs = {
    camera,
    fitToCenter: controller.fitToCenter,
  };

  const content = typeof children === 'function' ? children(renderArgs) : children;
  const overlayNode = typeof overlay === 'function' ? overlay(renderArgs) : overlay;

  const InfiniteViewerAny = InfiniteViewer as any;

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
        background,
        ...style,
      }}
    >
      <InfiniteViewerAny
        ref={viewerRef}
        zoom={camera.scale}
        zoomMin={minScale}
        zoomMax={maxScale}
        usePinch={true}
        zoomOffsetX={zoomStep}
        zoomOffsetY={zoomStep}
        onScroll={handleScroll}
        onPinch={handlePinch}
        style={{ width: '100%', height: '100%' }}
      >
        {content}
      </InfiniteViewerAny>
      {overlayNode ? <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>{overlayNode}</div> : null}
    </div>
  );
}
