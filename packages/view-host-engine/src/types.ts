/**
 * @main-ui/view-host-engine 数据契约：外部引擎桥接模板。
 *
 * 第三方引擎「转播窗口」：布局归我方、渲染归外部引擎。
 * 模板零渲染零业务：不画任何内容，只做 DOM 容器与尺寸通知。
 * 约束：零网络语义字段；颜色消费 --mui-*。
 */

/** 外部引擎 API 接口（宿主实现）。 */
export type ExternalEngineApi = {
  /** 挂载到指定 DOM 容器。 */
  mount(container: HTMLElement): void;
  /** 尺寸变更通知。 */
  onResize(width: number, height: number): void;
  /** 销毁引擎实例（幂等）。 */
  destroy(): void;
};

/** 宿主注入 Props（引擎实例经此传入）。 */
export type HostEngineProps = {
  /** 外部引擎 API 实现（宿主提供）。 */
  engine: ExternalEngineApi | null;
  loading?: boolean;
  error?: string | null;
};

/** 视图状态契约（仅存容器尺寸）。 */
export type HostEngineViewState = {
  containerWidth: number;
  containerHeight: number;
};
